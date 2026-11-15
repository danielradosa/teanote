import { storage } from '@/helpers/storage'
import { mergeRecords } from '@/helpers/merge'
import supabase from '@/utils/supa'
import { useAuthStore } from '@/stores/useAuthStore'
import { useSyncStore } from '@/stores/useSyncStore'

/**
 * Rows asked for per request. The server may send fewer (its max-rows cap);
 * the pull advances by the rows it actually got and stops at an empty page,
 * so it relies on neither number.
 */
const PAGE_SIZE = 1000

type SyncRow = { id: string; updated_at: string; deleted_at?: string | null; user_id?: string }

export interface SyncResult<T> {
    /** The merged rows, tombstones included; null when nothing could be pulled. */
    records: T[] | null
    /** True only when the pull and every write for this table succeeded. */
    ok: boolean
}

/** Every row of the user's table, page by page in id order. Throws on any failed page. */
async function pullAll<T extends SyncRow>(table: string, userId: string): Promise<T[]> {
    const byId = new Map<string, T>()
    let offset = 0
    for (;;) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', userId)
            .order('id', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1)

        if (error) throw error
        const page = (data as T[] | null) ?? []
        if (page.length === 0) return [...byId.values()]

        for (const row of page) byId.set(row.id, row)
        offset += page.length
    }
}

/**
 * Pulls the table, merges it with the local copy (a tombstone wins, otherwise
 * the newer updated_at), pushes what is newer here, and stores the result.
 * Never throws. A failed write leaves the local data as it is, so a later sync
 * sends it again, and makes the result report failure.
 *
 * `toRecord` (helpers/records) is applied to every stored record before the
 * merge, so a record an older version stored in a shape the table refuses is
 * repaired, sent, and stored repaired. It must leave updated_at alone.
 *
 * A stored record whose user_id is another account's (left in this browser by
 * a session that ended without signOut) is never sent, as an upsert or as a
 * tombstone, and is not a failed write; it stays in localStorage exactly as
 * stored, and is returned in `records` like any other. A record without a
 * user_id is sent as the signed-in user's.
 */
export async function syncData<T extends SyncRow>(
    table: string,
    key: string,
    toRecord: (record: T) => T = record => record
): Promise<SyncResult<T>> {
    const { user } = useAuthStore.getState()
    const { startSync, finishSync } = useSyncStore.getState()

    if (!user) {
        console.warn('⚠️ No user, cannot sync %s', table)
        return { records: null, ok: false }
    }

    const isOtherAccount = (record: T) => !!record.user_id && record.user_id !== user.id

    startSync()
    try {
        const stored = storage.get<T[]>(key) || []
        const local = stored.map(toRecord)
        const remoteData = await pullAll<T>(table, user.id)
        const remoteById = new Map(remoteData.map(r => [r.id, r]))

        const merged = mergeRecords(local, remoteData)
        let failedWrites = 0

        for (const item of merged) {
            if (item.deleted_at || isOtherAccount(item)) continue
            const remoteItem = remoteById.get(item.id)
            const localTime = new Date(item.updated_at).getTime()
            const remoteTime = remoteItem ? new Date(remoteItem.updated_at).getTime() : 0

            if (!remoteItem || localTime > remoteTime) {
                const { error } = await supabase
                    .from(table)
                    .upsert([{ ...item, user_id: user.id }], { onConflict: 'id' })
                if (error) {
                    failedWrites++
                    // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
                    console.warn('⚠️ Failed upsert for %s id=%s', table, item.id, error)
                }
            }
        }

        // Tombstones the server rejected stay on this device, so the next sync sends them again.
        const unsentTombstones = new Set<string>()
        for (const del of merged) {
            if (!del.deleted_at || isOtherAccount(del)) continue
            // Only a row the server has, and has not already marked deleted, needs its tombstone.
            const remoteItem = remoteById.get(del.id)
            if (!remoteItem || remoteItem.deleted_at) continue

            const { error: delErr } = await supabase
                .from(table)
                .update({ deleted_at: del.deleted_at, updated_at: del.updated_at })
                .eq('id', del.id)
                .eq('user_id', user.id)
            if (delErr) {
                failedWrites++
                unsentTombstones.add(del.id)
                // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
                console.warn('⚠️ Failed remote delete for %s id=%s', table, del.id, delErr)
            }
        }

        // Another account's records stay exactly as stored, tombstones included.
        const storedById = new Map(stored.map(r => [r.id, r]))
        storage.set(key, merged
            .filter(t => !t.deleted_at || unsentTombstones.has(t.id) || isOtherAccount(t))
            .map(t => (isOtherAccount(t) ? storedById.get(t.id) ?? t : t)))

        const ok = failedWrites === 0
        finishSync(ok)
        return { records: merged, ok }
    } catch (err) {
        // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
        console.error('❌ Sync failed for %s:', table, err)
        finishSync(false)
        return { records: null, ok: false }
    }
}

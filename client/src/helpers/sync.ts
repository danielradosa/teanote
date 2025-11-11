import { storage } from './storage'
import { mergeRecords } from './merge'
import supabase from '../utils/supa'
import { useAuthStore } from '../stores/useAuthStore'
import { useSyncStore } from '../stores/useSyncStore'

export async function syncData<
    T extends { id: string; updated_at: string; deleted_at?: string | null; user_id?: string }
>(
    table: string,
    key: string
): Promise<T[] | null> {
    const { user } = useAuthStore.getState()
    const { startSync, finishSync } = useSyncStore.getState()

    if (!user) {
        console.warn(`⚠️ No user, cannot sync ${table}`)
        return null
    }

    startSync()
    try {
        const local = storage.get<T[]>(key) || []

        const { data: remote, error } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id)

        if (error) throw error
        const remoteData = (remote as T[]) || []

        const merged = mergeRecords(local, remoteData)

        const toUpsert = merged.filter(item => !item.deleted_at)

        for (const item of toUpsert) {
            const remoteItem = remoteData.find(r => r.id === item.id)
            const localTime = new Date(item.updated_at).getTime()
            const remoteTime = remoteItem ? new Date(remoteItem.updated_at).getTime() : 0

            if (!remoteItem || localTime > remoteTime) {
                await supabase
                    .from(table)
                    .upsert([{ ...item, user_id: user.id }], { onConflict: 'id' })
            }
        }

        const toDeleteRemotely = merged.filter(item => item.deleted_at)
        for (const del of toDeleteRemotely) {
            const { error: delErr } = await supabase
                .from(table)
                .update({ deleted_at: del.deleted_at, updated_at: del.updated_at })
                .eq('id', del.id)
                .eq('user_id', user.id)
            if (delErr) console.warn(`⚠️ Failed remote delete for ${table} id=${del.id}`, delErr)
        }

        const visible = merged.filter(t => !t.deleted_at)
        storage.set(key, visible)

        finishSync(true)
        return merged
    } catch (err) {
        console.error(`❌ Sync failed for ${table}:`, err)
        finishSync(false)
        return null
    }
}
import supabase from '../utils/supa';
import { storage } from './storage';
import { mergeRecords } from './merge';
import { useAuthStore } from '../stores/useAuthStore';
import { useSyncStore } from '../stores/useSyncStore';

export async function syncData<T extends { id: string; updated_at: string; deleted_at?: string | null }>(
    table: string,
    key: string
): Promise<T[] | null> {
    const { user } = useAuthStore.getState();
    const { startSync, finishSync } = useSyncStore.getState();
    if (!user) return null;

    startSync();
    try {
        const local = storage.get<T[]>(key) || [];

        const { data: remote, error } = await supabase
            .from(table)
            .select('*')
            .eq('user_id', user.id);

        if (error) throw error;

        const remoteData = (remote as T[]) || [];
        const merged = mergeRecords(local, remoteData);

        for (const item of merged) {
            const remoteItem = remoteData.find(r => r.id === item.id);

            // If remote has deleted_at set, never overwrite with local null
            if (remoteItem?.deleted_at && !item.deleted_at) continue;

            // If local has deleted_at set and remote doesn't → push deletion
            if (item.deleted_at && (!remoteItem?.deleted_at || new Date(item.deleted_at).getTime() > new Date(remoteItem.deleted_at || 0).getTime())) {
                await supabase.from(table).upsert([{ ...item, user_id: user.id }], { onConflict: 'id' });
                continue;
            }

            // Otherwise, push if local updated_at is newer
            if (!remoteItem || new Date(item.updated_at).getTime() > new Date(remoteItem.updated_at).getTime()) {
                await supabase.from(table).upsert([{ ...item, user_id: user.id }], { onConflict: 'id' });
            }
        }

        storage.set(key, merged);
        finishSync(true);
        return merged;
    } catch (err) {
        console.error(`❌ Sync failed for ${table}:`, err);
        finishSync(false);
        return null;
    }
}
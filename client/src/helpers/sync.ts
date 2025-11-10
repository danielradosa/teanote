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

            if (remoteItem?.deleted_at && !item.deleted_at) {
                continue; 
            }

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
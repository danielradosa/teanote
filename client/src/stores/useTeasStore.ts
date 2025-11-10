import { create } from 'zustand';
import { storage } from '../helpers/storage';
import supabase from '../utils/supa';
import type { Tea } from '../types/Tea';
import { v4 as uuid } from 'uuid';
import { useAuthStore } from './useAuthStore';
import { useSyncStore } from './useSyncStore';
import { mergeRecords } from '../helpers/merge';

interface TeasState {
    teas: Tea[];
    lastSync: string | null;
    addTea: (tea: Omit<Tea, 'id' | 'user_id' | 'updated_at' | 'deleted_at'>) => void;
    updateTea: (id: string, updates: Partial<Tea>) => void;
    deleteTea: (id: string) => void;
    syncTeas: () => Promise<void>;
}

export const useTeasStore = create<TeasState>((set, get) => ({
    teas: storage.get<Tea[]>('teas') || [],
    lastSync: null,

    addTea: (tea) => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const now = new Date().toISOString();

        const newTea: Tea = {
            ...tea,
            id: uuid(),
            user_id: user.id,
            updated_at: now,
            deleted_at: null,
        };

        const updated = [...get().teas, newTea];
        storage.set('teas', updated);
        set({ teas: updated });

        if (navigator.onLine) get().syncTeas();
    },

    updateTea: (id, updates) => {
        const now = new Date().toISOString();
        const updated = get().teas.map(t =>
            t.id === id ? { ...t, ...updates, updated_at: now } : t
        );
        storage.set('teas', updated);
        set({ teas: updated });

        if (navigator.onLine) get().syncTeas();
    },

    deleteTea: (id) => {
        const now = new Date().toISOString();
        const updated = get().teas.map(t =>
            t.id === id ? { ...t, deleted_at: now, updated_at: now } : t
        );
        storage.set('teas', updated);
        set({ teas: updated });

        if (navigator.onLine) get().syncTeas();
    },

    syncTeas: async () => {
        const { user } = useAuthStore.getState();
        const { startSync, finishSync } = useSyncStore.getState();
        if (!user) return;

        startSync();
        try {
            const localTeas = storage.get<Tea[]>('teas') || [];

            for (const tea of localTeas) {
                await supabase.from('teas').upsert([{ ...tea, user_id: user.id }], { onConflict: 'id' });
            }

            const { data: dbTeas, error: fetchError } = await supabase
                .from('teas')
                .select('*')
                .eq('user_id', user.id);

            if (fetchError) throw fetchError;

            const merged = mergeRecords(localTeas, dbTeas || []);

            storage.set('teas', merged);
            set({ teas: merged, lastSync: new Date().toISOString() });

            finishSync(true);
        } catch (err) {
            console.error('❌ Sync failed:', err);
            finishSync(false);
        }
    },
}));
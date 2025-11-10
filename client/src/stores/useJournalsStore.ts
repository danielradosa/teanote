import { create } from 'zustand';
import { storage } from '../helpers/storage';
import supabase from '../utils/supa';
import type { Journal } from '../types/Journal';
import { v4 as uuid } from 'uuid';
import { useAuthStore } from './useAuthStore';
import { useSyncStore } from './useSyncStore';
import { mergeRecords } from '../helpers/merge';

interface JournalsState {
    journals: Journal[];
    lastSync: string | null;
    addJournal: (journal: Omit<Journal, 'id' | 'user_id' | 'updated_at' | 'deleted_at'>) => void;
    updateJournal: (id: string, updates: Partial<Journal>) => void;
    deleteJournal: (id: string) => void;
    syncJournals: () => Promise<void>;
}

export const useJournalsStore = create<JournalsState>((set, get) => ({
    journals: storage.get<Journal[]>('journals') || [],
    lastSync: null,

    addJournal: (journal) => {
        const { user } = useAuthStore.getState();
        if (!user) return;

        const now = new Date().toISOString();

        const newJournal: Journal = {
            ...journal,
            id: uuid(),
            user_id: user.id,
            updated_at: now,
            deleted_at: null,
        };

        const updated = [...get().journals, newJournal];
        storage.set('journals', updated);
        set({ journals: updated });

        if (navigator.onLine) get().syncJournals();
    },

    updateJournal: (id, updates) => {
        const now = new Date().toISOString();
        const updated = get().journals.map(j =>
            j.id === id ? { ...j, ...updates, updated_at: now } : j
        );
        storage.set('journals', updated);
        set({ journals: updated });

        if (navigator.onLine) get().syncJournals();
    },

    deleteJournal: (id) => {
        const now = new Date().toISOString();
        const updated = get().journals.map(j =>
            j.id === id ? { ...j, deleted_at: now, updated_at: now } : j
        );
        storage.set('journals', updated);
        set({ journals: updated });

        if (navigator.onLine) get().syncJournals();
    },

    syncJournals: async () => {
        const { user } = useAuthStore.getState();
        const { startSync, finishSync } = useSyncStore.getState();
        if (!user) return;

        startSync();
        try {
            const localJournals = storage.get<Journal[]>('journals') || [];

            for (const journal of localJournals) {
                await supabase.from('journals').upsert([{ ...journal, user_id: user.id }], { onConflict: 'id' });
            }

            const { data: dbJournals, error: fetchError } = await supabase
                .from('journals')
                .select('*')
                .eq('user_id', user.id);

            if (fetchError) throw fetchError;

            const remoteJournals = dbJournals as Journal[];
            const merged = mergeRecords(localJournals, remoteJournals);

            storage.set('journals', merged);
            set({ journals: merged, lastSync: new Date().toISOString() });

            finishSync(true);
        } catch (err) {
            console.error('❌ Sync failed:', err);
            finishSync(false);
        }
    },
}));
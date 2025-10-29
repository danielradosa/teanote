import { create } from 'zustand';
import { storage } from '../helpers/storage';
import { type Journal } from '../types/Journal';
import { v4 as uuid } from 'uuid';

interface JournalsState {
    journals: Journal[];
    addJournal: (journal: Omit<Journal, 'id' | 'dateAdded'>) => void;
    updateJournal: (id: string, updates: Partial<Journal>) => void;
    deleteJournal: (id: string) => void;
}

export const useJournalsStore = create<JournalsState>((set, get) => ({
    journals: storage.get<Journal[]>('journals') || [],

    addJournal: (journal) => {
        const newJournal: Journal = { ...journal, id: uuid(), dateAdded: new Date().toISOString() };
        const updated = [...get().journals, newJournal];
        storage.set('journals', updated);
        set({ journals: updated });
    },

    updateJournal: (id, updates) => {
        const updated = get().journals.map(t => t.id === id ? { ...t, ...updates } : t);
        storage.set('journals', updated);
        set({ journals: updated });
    },

    deleteJournal: (id) => {
        const updated = get().journals.filter(t => t.id !== id);
        storage.set('journals', updated);
        set({ journals: updated });
    }
}))
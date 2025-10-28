import { create } from 'zustand';
import { storage } from '../helpers/storage';
import { type Tea } from '../types/Tea';
import { v4 as uuid } from 'uuid';

interface TeasState {
    teas: Tea[];
    addTea: (tea: Omit<Tea, 'id' | 'dateAdded'>) => void;
    updateTea: (id: string, updates: Partial<Tea>) => void;
    deleteTea: (id: string) => void;
}

export const useTeasStore = create<TeasState>((set, get) => ({
    teas: storage.get<Tea[]>('teas') || [],

    addTea: (tea) => {
        const newTea: Tea = { ...tea, id: uuid(), dateAdded: new Date().toISOString() };
        const updated = [...get().teas, newTea];
        storage.set('teas', updated);
        set({ teas: updated });
    },

    updateTea: (id, updates) => {
        const updated = get().teas.map(t => t.id === id ? { ...t, ...updates } : t);
        storage.set('teas', updated);
        set({ teas: updated });
    },

    deleteTea: (id) => {
        const updated = get().teas.filter(t => t.id !== id);
        storage.set('teas', updated);
        set({ teas: updated });
    }
}));
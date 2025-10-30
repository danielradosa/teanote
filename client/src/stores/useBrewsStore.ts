import { create } from 'zustand'
import { storage } from '../helpers/storage'
import { v4 as uuid } from 'uuid'
import type { Brew, Infusion } from '../types/Brew'

interface BrewsState {
    brews: Brew[];
    addBrew: (brew: Omit<Brew, 'id' | 'startedAt' | 'finishedAt' | 'infusions'>) => string;
    updateBrew: (id: string, updates: Partial<Brew>) => void;
    deleteBrew: (id: string) => void;
    addInfusion: (brewId: string, infusion: Omit<Infusion, 'number'>) => void;
}

export const useBrewsStore = create<BrewsState>((set, get) => ({
    brews: storage.get<Brew[]>('brews') || [],

    addBrew: (brew) => {
        const newBrew: Brew = {
            ...brew,
            id: uuid(),
            startedAt: new Date(),
            infusions: [],
        }
        const updated = [...get().brews, newBrew];
        storage.set('brews', updated);
        set({ brews: updated });
        return newBrew.id;
    },

    updateBrew: (id, updates) => {
        const updated = get().brews.map(b =>
            b.id === id ? { ...b, ...updates } : b
        );
        storage.set('brews', updated);
        set({ brews: updated });
    },

    deleteBrew: (id) => {
        const updated = get().brews.filter(b => b.id !== id);
        storage.set('brews', updated);
        set({ brews: updated });
    },

    addInfusion: (brewId, infusion) => {
        const updated = get().brews.map(b => {
            if (b.id === brewId) {
                const nextNumber = b.infusions.length + 1;
                return {
                    ...b,
                    infusions: [...b.infusions, { ...infusion, number: nextNumber }],
                };
            }
            return b;
        });
        storage.set('brews', updated);
        set({ brews: updated });
    },
}))

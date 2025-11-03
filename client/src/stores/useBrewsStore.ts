import { create } from 'zustand'
import { storage } from '../helpers/storage'
import { v4 as uuid } from 'uuid'
import type { Brew, Infusion, Preset } from '../types/Brew'

interface BrewsState {
    brews: Brew[];
    presets: Preset[];

    addBrew: (brew: Omit<Brew, 'id' | 'startedAt' | 'finishedAt' | 'infusions'>) => string;
    updateBrew: (id: string, updates: Partial<Brew>) => void;
    deleteBrew: (id: string) => void;
    addInfusion: (brewId: string, infusion: Omit<Infusion, 'number'>) => void;

    addPreset: (preset: Omit<Preset, 'id'>) => string;
    updatePreset: (id: string, updates: Partial<Preset>) => void;
    deletePreset: (id: string) => void;
}

export const useBrewsStore = create<BrewsState>((set, get) => ({
    brews: storage.get<Brew[]>('brews') || [],
    presets: storage.get<Preset[]>('presets') || [],

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

    addPreset: (preset) => {
        const newPreset: Preset = {
            ...preset,
            id: uuid(),
        }
        const updated = [...get().presets, newPreset];
        storage.set('presets', updated);
        set({ presets: updated });
        return newPreset.id;
    },

    updatePreset: (id, updates) => {
        const updated = get().presets.map(p =>
            p.id === id ? { ...p, ...updates } : p
        );
        storage.set('presets', updated);
        set({ presets: updated });
    },

    deletePreset: (id) => {
        const updated = get().presets.filter(p => p.id !== id);
        storage.set('presets', updated);
        set({ presets: updated });
    }
}))

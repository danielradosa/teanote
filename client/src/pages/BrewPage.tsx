'use client'

import { useMemo, useState } from 'react'
import { useBrewsStore } from '@/stores/useBrewsStore'
import { useTeasStore } from '@/stores/useTeasStore'
import { useToggleFilters } from '@/hooks/toggleFilters'
import BrewFilters from '@/components/brew/BrewFilters'
import BrewList from '@/components/brew/BrewList'
import PresetForm from '@/components/brew/PresetForm'
import PresetList from '@/components/brew/PresetList'
import PresetEditForm from '@/components/brew/PresetEditForm'
import NewSessionForm from '@/components/brew/NewSessionForm'
import type { Brew, Preset } from '@/types/Brew'
import { t } from 'i18next'

function BrewPage() {
    const {
        visibleBrews,
        addBrew,
        deleteBrew,
        addPreset,
        updatePreset,
        deletePreset,
        visiblePresets,
    } = useBrewsStore()

    const { visibleTeas } = useTeasStore()
    const teas = visibleTeas()
    const brews = visibleBrews()
    const presets = visiblePresets()

    // Cross-cutting state — read by multiple children
    const [activeBrewId, setActiveBrewId] = useState<string | null>(null)
    const [liveInfusionNumber, setLiveInfusionNumber] = useState<number | null>(null)
    const [liveInfusionSecs, setLiveInfusionSecs] = useState<number | null>(null)
    const [isLiveRunning, setIsLiveRunning] = useState(false)
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null)

    // Filter state — shared between BrewFilters, BrewList and PresetList
    const [selectedInfusions, setSelectedInfusions] = useState<number | null>(null)
    const [selectedLength, setSelectedLength] = useState<number | null>(null)
    const [search, setSearch] = useState('')
    const { showFilters, toggleFilters } = useToggleFilters()

    const orderedBrews = useMemo(() => {
        const filtered = brews.filter(b => {
            const infusionCount = b.infusions.length
            const totalLength = b.infusions.reduce((sum, inf) => sum + inf.actualTime, 0)
            const tea = teas.find(t => t.id === b.teaId)
            const matchesSearch = !search || (tea && tea.name.toLowerCase().includes(search.toLowerCase()))
            if ((selectedInfusions || selectedLength) && infusionCount === 0) return false
            return (
                (!selectedInfusions || infusionCount === selectedInfusions) &&
                (!selectedLength || totalLength === selectedLength) &&
                matchesSearch
            )
        })
        return [...filtered].reverse()
    }, [brews, teas, selectedInfusions, selectedLength, search])

    const orderedPresets = useMemo(() => {
        const filtered = presets.filter(p =>
            !search
            || p.name.toLowerCase().includes(search.toLowerCase())
            || (p.teaId && teas.find(t => t.id === p.teaId)?.name?.toLowerCase().includes(search.toLowerCase()))
            || (p.teaType && p.teaType.toLowerCase().includes(search.toLowerCase()))
        )
        return [...filtered].sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
            return dateB - dateA
        })
    }, [presets, teas, search])

    const handleStartSession = (teaId: string, presetId: string | undefined) => {
        const newId = addBrew({ teaId, presetId })
        if (typeof newId === 'string') setActiveBrewId(newId)
    }

    const handleReportLive = (num: number, secs: number, running: boolean) => {
        setLiveInfusionNumber(num)
        setLiveInfusionSecs(secs)
        setIsLiveRunning(running)
    }

    const handleBrewToPreset = (brew: Brew) => {
        const tea = teas.find(t => t.id === brew.teaId)
        if (!tea) return alert('Tea not found for this brew')

        const newPreset: Omit<Preset, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'deleted_at'> = {
            name: `${tea.name} ${t('preset_from_brew')}`,
            teaId: brew.teaId,
            teaType: tea.type,
            infusionsAmount: brew.infusions.length || 1,
            infusionTimes: brew.infusions.map(i => i.actualTime),
        }

        addPreset(newPreset)
    }

    const editingPreset = editingPresetId ? presets.find(p => p.id === editingPresetId) : null

    return (
        <section className="page-wrap brew-page">
            <header className="page-header">
                <h1>{t('brews_title')}</h1>
                <p className="subtitle">{t('brews_subtitle')} 🍵</p>
            </header>

            <div className="brew-content">
                <BrewFilters
                    brews={brews}
                    selectedInfusions={selectedInfusions}
                    setSelectedInfusions={setSelectedInfusions}
                    selectedLength={selectedLength}
                    setSelectedLength={setSelectedLength}
                    search={search}
                    setSearch={setSearch}
                    showFilters={showFilters}
                    toggleFilters={toggleFilters}
                />

                <BrewList
                    brews={brews}
                    orderedBrews={orderedBrews}
                    teas={teas}
                    presets={presets}
                    activeBrewId={activeBrewId}
                    liveInfusionNumber={liveInfusionNumber}
                    liveInfusionSecs={liveInfusionSecs}
                    isLiveRunning={isLiveRunning}
                    onToPreset={handleBrewToPreset}
                    onDelete={deleteBrew}
                />

                <section className="new-preset">
                    <PresetForm teas={teas} onSubmit={addPreset} />
                    <PresetList
                        presets={orderedPresets}
                        teas={teas}
                        onEdit={(preset: Preset) => setEditingPresetId(preset.id)}
                        onDelete={deletePreset}
                        onSyncType={(presetId: string, newType: string) =>
                            updatePreset(presetId, { teaType: newType })
                        }
                    />
                </section>

                {editingPreset && (
                    <PresetEditForm
                        key={editingPreset.id}
                        preset={editingPreset}
                        teas={teas}
                        onSubmit={(id: string, updates: Partial<Preset>) => {
                            updatePreset(id, updates)
                            setEditingPresetId(null)
                        }}
                        onCancel={() => setEditingPresetId(null)}
                    />
                )}

                <NewSessionForm
                    teas={teas}
                    presets={presets}
                    activeBrewId={activeBrewId}
                    onStart={handleStartSession}
                    onClose={() => setActiveBrewId(null)}
                    reportLive={handleReportLive}
                />
            </div>
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.25; }
                    100% { opacity: 1; }
                }
            `}</style>
        </section>
    )
}

export default BrewPage

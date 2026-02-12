'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useTeasStore } from '../stores/useTeasStore'
import JournalFilters from '../components/journal/JournalFilters'
import JournalList from '../components/journal/JournalList'
import JournalForm from '../components/journal/JournalForm'
import { useToggleFilters } from '../hooks/toggleFilters'
import type { Journal } from '../types/Journal'
import { t } from 'i18next'

export default function JournalPage() {
    const { addJournal, deleteJournal, updateJournal, visibleJournals } = useJournalsStore()
    const journals = visibleJournals()

    const { visibleTeas } = useTeasStore()
    const teas = visibleTeas()

    const { visibleBrews, visiblePresets, getBrewName } = useBrewsStore()
    const brews = visibleBrews()
    const presets = visiblePresets()

    const { showFilters, toggleFilters } = useToggleFilters()
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null)

    const firstOpenRef = useRef(false)

    useEffect(() => {
        if (!editingJournal) {
            firstOpenRef.current = false
            return
        }

        if (window.innerWidth < 860) {
            setTimeout(() => {
                const el = document.querySelector('.edit-panel') as HTMLElement | null
                if (!el) return
                const y = el.getBoundingClientRect().top + window.scrollY - 150
                window.scrollTo({ top: y, behavior: 'smooth' })
            }, 0)
        }
    }, [editingJournal])

    const [typeFilter, setTypeFilter] = useState('')
    const [ratingFilter, setRatingFilter] = useState<number | ''>('')
    const [search, setSearch] = useState('')

    const orderedJournals = useMemo(() => {
        return [...journals]
            .filter(journal => {
                const tea = teas.find(t => t.id === journal.teaId)
                return (
                    (!typeFilter || tea?.type === typeFilter) &&
                    (!ratingFilter || journal.rating === ratingFilter) &&
                    (!search ||
                        journal.title.toLowerCase().includes(search.toLowerCase()) ||
                        (tea?.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
                        (tea?.type?.toLowerCase() || '').includes(search.toLowerCase())
                    )
                )
            })
            .reverse()
    }, [journals, teas, typeFilter, ratingFilter, search])

    return (
        <section className="page-wrap journal-page">
            <header className="page-header">
                <h1>{t('journals_title')}</h1>
                <p className="subtitle">{t('journals_subtitle')} 🍵</p>
            </header>

            <div className="journal-content">
                <JournalFilters
                    journals={journals}
                    teas={teas}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                    ratingFilter={ratingFilter}
                    setRatingFilter={setRatingFilter}
                    search={search}
                    setSearch={setSearch}
                    showFilters={showFilters}
                    toggleFilters={toggleFilters}
                />

                <JournalList
                    journals={orderedJournals}
                    teas={teas}
                    brews={brews}
                    presets={presets}
                    getBrewName={getBrewName}
                    onEdit={setEditingJournal}
                    onDelete={deleteJournal}
                />

                {editingJournal && (
                    <JournalForm
                        key={`edit-${editingJournal.id}`}
                        journal={editingJournal}
                        onChange={setEditingJournal}
                        onSubmit={() => {
                            updateJournal(editingJournal.id, editingJournal)
                            setEditingJournal(null)
                        }}
                        isEditing
                        onCancel={() => setEditingJournal(null)}
                        teas={teas}
                        brews={brews}
                        presets={presets}
                    />
                )}

                <JournalForm
                    key="new-journal"
                    journal={null}
                    onChange={() => { }}
                    onSubmit={addJournal}
                    isEditing={false}
                    teas={teas}
                    brews={brews}
                    presets={presets}
                />
            </div>
        </section>
    )
}
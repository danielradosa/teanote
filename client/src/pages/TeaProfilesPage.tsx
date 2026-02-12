'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useTeasStore } from '../stores/useTeasStore'
import TeaFilters from '../components/tea/TeaFilters'
import TeaList from '../components/tea/TeaList'
import TeaForm from '../components/tea/TeaForm'
import { useToggleFilters } from '../hooks/toggleFilters'
import type { Tea } from '../types/Tea'
import { t } from 'i18next'

export default function TeaProfilesPage() {
    const { addTea, deleteTea, updateTea, visibleTeas } = useTeasStore()
    const teas = visibleTeas()

    const { showFilters, toggleFilters } = useToggleFilters()
    const [editingTea, setEditingTea] = useState<Tea | null>(null)

    const firstOpenRef = useRef(false)

    useEffect(() => {
        if (!editingTea) {
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
    }, [editingTea])

    const [typeFilter, setTypeFilter] = useState('')
    const [yearFilter, setYearFilter] = useState('')
    const [search, setSearch] = useState('')

    const orderedTeas = useMemo(() => {
        return [...teas]
            .filter(tea =>
                (!typeFilter || tea.type === typeFilter) &&
                (!yearFilter || tea.year === yearFilter) &&
                (!search ||
                    tea.name.toLowerCase().includes(search.toLowerCase()) ||
                    tea.type.toLowerCase().includes(search.toLowerCase()))
            )
            .reverse()
    }, [teas, typeFilter, yearFilter, search])

    return (
        <section className="page-wrap tea-page">
            <header className="page-header">
                <h1>{t('teas_title')}</h1>
                <p className="subtitle">{t('teas_subtitle')} 🍵</p>
            </header>

            <div className="tea-content">
                <TeaFilters
                    teas={teas}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                    yearFilter={yearFilter}
                    setYearFilter={setYearFilter}
                    search={search}
                    setSearch={setSearch}
                    showFilters={showFilters}
                    toggleFilters={toggleFilters}
                />

                <TeaList
                    teas={orderedTeas}
                    deleteTea={(id: string | undefined) => {
                        deleteTea(id!)
                        if (editingTea?.id === id) setEditingTea(null)
                    }}
                    onEdit={setEditingTea}
                />

                {editingTea && (
                    <TeaForm
                        tea={editingTea}
                        onChange={setEditingTea}
                        onSubmit={() => { updateTea(editingTea.id, editingTea); setEditingTea(null) }}
                        showMoreToggle
                        isEditing
                        onCancel={() => setEditingTea(null)}
                    />
                )}

                <TeaForm
                    tea={null}
                    onChange={() => { }}
                    onSubmit={addTea}
                    showMoreToggle
                    isEditing={false}
                />
            </div>
        </section>
    )
}
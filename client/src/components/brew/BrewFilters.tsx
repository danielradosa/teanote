import SearchBar from '@/components/SearchBar'
import type { Brew } from '@/types/Brew'
import { t } from 'i18next'

interface BrewFiltersProps {
    brews: Brew[]
    selectedInfusions: number | null
    setSelectedInfusions: (v: number | null) => void
    selectedLength: number | null
    setSelectedLength: (v: number | null) => void
    search: string
    setSearch: (v: string) => void
    showFilters: boolean
    toggleFilters: () => void
}

export default function BrewFilters({
    brews,
    selectedInfusions,
    setSelectedInfusions,
    selectedLength,
    setSelectedLength,
    search,
    setSearch,
    showFilters,
    toggleFilters,
}: BrewFiltersProps) {
    const actualInfusionCounts = Array.from(
        new Set(brews.map(b => b.infusions.length).filter(c => c > 0))
    )
    const infusionOptions = actualInfusionCounts
        .sort((a, b) => a - b)
        .map(c => <option key={c} value={c}>{c}</option>)

    const actualBrewLengths = Array.from(
        new Set(
            brews
                .filter(b => b.infusions.length > 0)
                .map(b => b.infusions.reduce((sum, i) => sum + i.actualTime, 0))
        )
    )
    const brewLengthOptions = actualBrewLengths
        .sort((a, b) => a - b)
        .map(l => <option key={l} value={l}>{l}s</option>)

    return (
        <section className="brew-filters" style={{ flex: '1 1 100%' }}>
            <h2 onClick={toggleFilters}>
                {t('brews_filter_title')}
                <span className="toggle-label">
                    {showFilters ? `– ${t('general_show_filters')}` : `+ ${t('general_show_filters')}`}
                </span>
            </h2>
            <div className={`filter-wrap ${showFilters ? 'visible' : 'hidden'}`}>
                <label className='filter-label'>
                    {t('brews_filter_infusion_label')}:&nbsp;
                    <div className="select-wrap">
                        <select
                            value={selectedInfusions ?? ''}
                            onChange={e =>
                                setSelectedInfusions(e.target.value ? parseInt(e.target.value) : null)
                            }>
                            <option value="">{t('brews_filter_infusion_select')}</option>
                            {infusionOptions}
                        </select>
                        <span className='arr-down'></span>
                    </div>
                </label>
                <label className='filter-label'>
                    {t('brews_filter_length_label')}:&nbsp;
                    <div className="select-wrap">
                        <select
                            value={selectedLength ?? ''}
                            onChange={e =>
                                setSelectedLength(e.target.value ? parseInt(e.target.value) : null)
                            }>
                            <option value="">{t('brews_filter_length_select')}</option>
                            {brewLengthOptions}
                        </select>
                        <span className='arr-down'></span>
                    </div>
                </label>
                <label className='filter-label'>
                    {t('general_search_label')}:&nbsp;
                    <SearchBar value={search} setValue={setSearch} placeholder={t('brews_filter_search_p')} />
                </label>
                <button
                    className="btn btn-dark"
                    onClick={() => {
                        setSelectedInfusions(null)
                        setSelectedLength(null)
                        setSearch('')
                    }}>
                    <i className="bxr bx-eraser" /> {t('general_search_clear_btn')}
                </button>
            </div>
        </section>
    )
}

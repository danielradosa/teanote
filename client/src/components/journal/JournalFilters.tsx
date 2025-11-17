/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import SearchBar from '../SearchBar'
import { t } from 'i18next'

export default function JournalFilters({
    journals,
    teas,
    typeFilter,
    setTypeFilter,
    ratingFilter,
    setRatingFilter,
    search,
    setSearch,
    showFilters,
    toggleFilters
}: any) {
    const teaTypesInJournals = [...new Set(
        (journals || [])
            .map((j: any) => teas.find((t: any) => t.id === j.teaId)?.type)
            .filter(Boolean)
    )]

    return (
        <section className="journal-filters" style={{ flex: '1 1 100%' }}>
            <h2 onClick={toggleFilters}>
                {t('journals_filter_title')}
                <span className="toggle-label">
                    {showFilters ? `– ${t('general_hide_filters')}` : `+ ${t('general_show_filters')}`}
                </span>
            </h2>
            <div className={`filter-wrap ${showFilters ? 'visible' : 'hidden'}`}>
                <label className='filter-label'>
                    {t('journal_type_label')}:&nbsp;
                    <div className="select-wrap">
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">{t('journal_select_types')}</option>
                            {teaTypesInJournals.map((type: any) => <option value={type} key={type}>{t(`tea_tag_${type}`)}</option>)}
                        </select>
                        <span className='arr-down'></span>
                    </div>
                </label>

                <label className='filter-label'>
                    {t('journal_rating_label')}:&nbsp;
                    <div className="select-wrap">
                        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value === '' ? '' : Number(e.target.value))}>
                            <option value="">{t('journal_select_rating')}</option>
                            {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{'⭐'.repeat(r)}</option>)}
                        </select>
                        <span className='arr-down'></span>
                    </div>
                </label>

                <label className='filter-label'>
                    {t('general_search_label')}:&nbsp;
                    <SearchBar value={search} setValue={setSearch} placeholder={t('journal_search_placeholder')} />
                </label>

                <button className="btn btn-dark" onClick={() => { setTypeFilter(''); setRatingFilter(''); setSearch(''); }}>
                    <i className="bxr bx-eraser" /> {t('general_search_clear_btn')}
                </button>
            </div>
        </section>
    )
}
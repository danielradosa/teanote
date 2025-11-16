/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import SearchBar from '../SearchBar'
import { t } from 'i18next'

export default function TeaFilters({
    teas,
    typeFilter,
    setTypeFilter,
    yearFilter,
    setYearFilter,
    search,
    setSearch,
    showFilters,
    toggleFilters
}: any) {
    return (
        <section className="tea-filters" style={{ flex: '1 1 100%' }}>
            <h2 onClick={toggleFilters}>
                {t('teas_filter')}
                <span className="toggle-label">
                    {showFilters ? '– hide filters' : '+ show filters'}
                </span>
            </h2>
            <div className={`filter-wrap ${showFilters ? 'visible' : 'hidden'}`}>
                <label className='filter-label'>
                    {t('teas_filter_type_label')}:&nbsp;
                    <div className="select-wrap">
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">{t('teas_select_type')}</option>
                            {[...new Set(teas.map((t: any) => t.type))].map((type: any) =>
                                <option value={type} key={type}>{type}</option>
                            )}
                        </select>
                        <span className='arr-down'></span>
                    </div>
                </label>

                <label className="filter-label">
                    {t('teas_filter_year_label')}:&nbsp;
                    <div className="select-wrap">
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                            <option value="">{t('teas_select_year')}</option>
                            {[...new Set(teas.map((t: any) => t.year).filter((y: string) => y && y.trim() !== ''))].map((year: any) =>
                                <option value={year} key={year}>{year}</option>
                            )}
                        </select>
                        <span className="arr-down"></span>
                    </div>
                </label>

                <label className='filter-label'>
                    {t('general_search_label')}:&nbsp;
                    <SearchBar value={search} setValue={setSearch} placeholder={t('teas_search_placeholder')} />
                </label>

                <button className="btn btn-dark" onClick={() => { setTypeFilter(''); setYearFilter(''); setSearch(''); }}>
                    <i className="bxr bx-eraser" /> {t('general_search_clear_btn')}
                </button>
            </div>
        </section>
    )
}
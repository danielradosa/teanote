/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import SearchBar from '../SearchBar'

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
                Filter teas
                <span className="toggle-label">
                    {showFilters ? '– hide filters' : '+ show filters'}
                </span>
            </h2>
            <div className={`filter-wrap ${showFilters ? 'visible' : 'hidden'}`}>
                <label className='filter-label'>
                    Type:&nbsp;
                    <div className="select-wrap">
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                            <option value="">all types</option>
                            {[...new Set(teas.map((t: any) => t.type))].map((type: any) =>
                                <option value={type} key={type}>{type}</option>
                            )}
                        </select>
                        <span className='arr-down'></span>
                    </div>
                </label>

                <label className="filter-label">
                    Year:&nbsp;
                    <div className="select-wrap">
                        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                            <option value="">all years</option>
                            {[...new Set(teas.map((t: any) => t.year).filter((y: string) => y && y.trim() !== ''))].map((year: any) =>
                                <option value={year} key={year}>{year}</option>
                            )}
                        </select>
                        <span className="arr-down"></span>
                    </div>
                </label>

                <label className='filter-label'>
                    Search:&nbsp;
                    <SearchBar value={search} setValue={setSearch} placeholder="Search by tea type or name..." />
                </label>

                <button className="btn btn-dark" onClick={() => { setTypeFilter(''); setYearFilter(''); setSearch(''); }}>
                    <i className="bxr bx-eraser" /> clear filters
                </button>
            </div>
        </section>
    )
}
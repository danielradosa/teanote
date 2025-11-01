'use client'

import { useEffect } from 'react'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useTeasStore } from '../stores/useTeasStore'
import BrewTimer from '../components/brew/BrewTimer'
import SearchBar from '../components/SearchBar'
import { useState } from 'react'
import type { Brew } from '../types/Brew'
import InfiniteScroll from 'react-infinite-scroll-component'

function BrewPage() {
    const { brews, addBrew, deleteBrew } = useBrewsStore()
    const { teas } = useTeasStore()
    const [activeBrewId, setActiveBrewId] = useState<string | null>(null)
    const [selectedTeaId, setSelectedTeaId] = useState<string>('')
    const [selectedInfusions, setSelectedInfusions] = useState<number | null>(null)
    const [selectedLength, setSelectedLength] = useState<number | null>(null)
    const [search, setSearch] = useState('')

    const [liveInfusionNumber, setLiveInfusionNumber] = useState<number | null>(null)
    const [liveInfusionSecs, setLiveInfusionSecs] = useState<number | null>(null)
    const [isLiveRunning, setIsLiveRunning] = useState<boolean>(false)

    const batchSize = 6;
    const [brewItemsToShow, setBrewItemsToShow] = useState(batchSize)

    const handleStartBrew = () => {
        if (!selectedTeaId) return alert('Select a tea first')
        const newId = addBrew({ teaId: selectedTeaId })
        setActiveBrewId(newId)
        setSelectedTeaId('')
    }

    const getLiveElement = (brew: Brew) => {
        if (
            activeBrewId === brew.id &&
            isLiveRunning &&
            liveInfusionNumber &&
            liveInfusionSecs !== null
        ) {
            return (
                <div style={{ marginTop: 8 }}>
                    Steep {liveInfusionNumber}: {liveInfusionSecs}s
                    <span className="active-pulse" style={{
                        marginLeft: 8,
                        color: '#39b385',
                        animation: 'pulse 1s infinite'
                    }}>
                        [active]
                    </span>
                </div>
            )
        }
        return null
    }

    const actualInfusionCounts = Array.from(
        new Set(brews.map(brew => brew.infusions.length).filter(count => count > 0))
    );

    const infusionOptions = actualInfusionCounts
        .sort((a, b) => a - b)
        .map(count => (
            <option key={count} value={count}>{count}</option>
        ));

    const actualBrewLengths = Array.from(
        new Set(
            brews
                .filter(brew => brew.infusions.length > 0)
                .map(brew => brew.infusions.reduce((sum, inf) => sum + inf.actualTime, 0))
        )
    );

    const brewLengthOptions = actualBrewLengths
        .sort((a, b) => a - b)
        .map(len => (
            <option key={len} value={len}>{len}s</option>
        ));

    const filteredBrews = brews.filter(brew => {
        const infusionCount = brew.infusions.length;
        const totalLength = brew.infusions.reduce((sum, inf) => sum + inf.actualTime, 0);

        const tea = teas.find(t => t.id === brew.teaId);
        const matchesSearch = !search || (tea && tea.name.toLowerCase().includes(search.toLowerCase()));

        if ((selectedInfusions || selectedLength) && infusionCount === 0) return false;

        return (
            (!selectedInfusions || infusionCount === selectedInfusions) &&
            (!selectedLength || totalLength === selectedLength) &&
            matchesSearch
        );
    });

    const orderedBrews = [...filteredBrews].reverse();

    useEffect(() => {
        const ensureScrollable = () => {
            const ul = document.querySelector('.brew-list');
            if (!ul) return;
            const rect = ul.getBoundingClientRect();
            if (rect.bottom < window.innerHeight && brewItemsToShow < orderedBrews.length) {
                setBrewItemsToShow(prev => Math.min(prev + 1, orderedBrews.length));
                requestAnimationFrame(ensureScrollable);
            }
        };
        requestAnimationFrame(ensureScrollable);
        // eslint-disable-next-line
    }, [brews]);

    const fetchMoreBrews = () => setBrewItemsToShow(prev => prev + 6);

    return (
        <section className="page-wrap brew-page">
            <header className="page-header">
                <h1>Brews</h1>
                <p className="subtitle">Your recent tea sessions and stats 🍵</p>
            </header>

            <div className="brew-content">
                {/* Brew Filters */}
                <section className="brew-filters" style={{ flex: '1 1 100%' }}>
                    <h2>Filter brews</h2>
                    <div className='filter-wrap'>
                        <label>
                            # of infusions/steeps:&nbsp;
                            <select
                                value={selectedInfusions ?? ''}
                                onChange={e =>
                                    setSelectedInfusions(
                                        e.target.value ? parseInt(e.target.value) : null
                                    )
                                }>
                                <option value="">any amount</option>
                                {infusionOptions}
                            </select>
                            <span className='arr-down'></span>
                        </label>
                        <label>
                            Total brew length:&nbsp;
                            <select
                                value={selectedLength ?? ''}
                                onChange={e =>
                                    setSelectedLength(
                                        e.target.value ? parseInt(e.target.value) : null
                                    )
                                }>
                                <option value="">any</option>
                                {brewLengthOptions}
                            </select>
                            <span className='arr-down'></span>
                        </label>
                        <label>Search:&nbsp;
                            <SearchBar value={search} setValue={setSearch} placeholder="Search by tea name..." />
                        </label>
                        <button className="btn btn-dark"
                            onClick={() => { setSelectedInfusions(null); setSelectedLength(null); setSearch(''); }}>
                            <i className="bxr bx-eraser" /> clear filters
                        </button>
                    </div>
                </section>
                {/* Brews list */}
                <section className="recent-sessions">
                    <h2>Recent brews</h2>
                    {brews.length > 0 ? (
                        <InfiniteScroll
                            dataLength={Math.min(brewItemsToShow, orderedBrews.length)}
                            next={fetchMoreBrews}
                            hasMore={brewItemsToShow < orderedBrews.length}
                            loader={<div style={{ paddingTop: '16px', textAlign: 'center' }}>Loading more...</div>}
                            endMessage={<div style={{ paddingTop: '16px', textAlign: 'center' }}>No more brews</div>}
                        >
                            <ul className="brew-list">
                                {orderedBrews.slice(0, brewItemsToShow).map(brew => {
                                    const infusionTimes = brew.infusions.map(i => i.actualTime)
                                    const totalTime = infusionTimes.reduce((sum, t) => sum + t, 0)
                                    return (
                                        <li key={brew.id} className="brew-item">
                                            <div className="brew-details">
                                                <span>
                                                    <strong>{teas.find(t => t.id === brew.teaId)?.name ?? brew.teaId}</strong>
                                                    {brew.finishedAt && (
                                                        <span className="brew-finished-badge">Finished</span>
                                                    )}
                                                </span>
                                                <div className="brew-meta">
                                                    {brew.infusions.length > 0
                                                        ? `${brew.infusions.length} ${brew.infusions.length === 1 ? 'infusion' : 'infusions'}`
                                                        : <span style={{ color: '#a52d44' }}>no infusions recorded</span>
                                                    }
                                                </div>
                                                <div className="brew-meta">
                                                    <span>
                                                        {totalTime}s total • Infusions:&nbsp;
                                                        {infusionTimes.length > 0
                                                            ? infusionTimes.join('s, ') + 's'
                                                            : '-'}
                                                    </span>
                                                </div>
                                                {getLiveElement(brew)}
                                            </div>
                                            <div className="brew-actions">
                                                {/* TODO - EDIT FORM */}
                                                <button className="btn btn-danger" onClick={() => deleteBrew(brew.id)}><i className="bxr bx-trash" /></button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </InfiniteScroll>
                    ) : (
                        <p style={{ marginTop: 8 }}>no brews yet — start a new session</p>
                    )}
                </section>
                <section className="stats">
                    <h2>Brewing presets</h2>
                    <p style={{ marginTop: 8 }}>presets here</p>
                </section>
                <section className="quick-actions">
                    <h2>Start brew session</h2>
                    <div className='brew-main-actions'>
                        <label>
                            <select
                                value={selectedTeaId}
                                onChange={e => setSelectedTeaId(e.target.value)}
                            >
                                <option value="">Select tea</option>
                                {teas.map(tea => (
                                    <option key={tea.id} value={tea.id}>{tea.name}</option>
                                ))}
                            </select>
                            <span className='arr-down'></span>
                        </label>
                        <label>
                            <select value={''} onChange={() => ('')}>
                                <option value="">Select preset</option>
                            </select>
                            <span className='arr-down'></span>
                        </label>
                        <button className="btn btn-quick" onClick={handleStartBrew}>
                            <i className="bxr bx-alarm-plus" /> start brew
                        </button>
                    </div>
                    {activeBrewId && (
                        <BrewTimer
                            brewId={activeBrewId}
                            onClose={() => setActiveBrewId(null)}
                            reportLive={(num, secs, running) => {
                                setLiveInfusionNumber(num)
                                setLiveInfusionSecs(secs)
                                setIsLiveRunning(running)
                            }}
                        />
                    )}
                </section>
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
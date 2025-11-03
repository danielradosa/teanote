'use client'

import { useEffect } from 'react'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useTeasStore } from '../stores/useTeasStore'
import BrewTimer from '../components/brew/BrewTimer'
import SearchBar from '../components/SearchBar'
import { useState } from 'react'
import type { Brew, Preset } from '../types/Brew'
import InfiniteScroll from 'react-infinite-scroll-component'

function BrewPage() {
    const { brews, addBrew, deleteBrew, addPreset, updatePreset, deletePreset, presets } = useBrewsStore()
    const { teas } = useTeasStore()
    const [activeBrewId, setActiveBrewId] = useState<string | null>(null)
    const [selectedTeaId, setSelectedTeaId] = useState<string>('')
    const [selectedInfusions, setSelectedInfusions] = useState<number | null>(null)
    const [selectedLength, setSelectedLength] = useState<number | null>(null)
    const [search, setSearch] = useState('')

    const [liveInfusionNumber, setLiveInfusionNumber] = useState<number | null>(null)
    const [liveInfusionSecs, setLiveInfusionSecs] = useState<number | null>(null)
    const [isLiveRunning, setIsLiveRunning] = useState<boolean>(false)

    const [selectedPresetId, setSelectedPresetId] = useState<string>('');

    const [presetName, setPresetName] = useState('')
    const [presetTeaId, setPresetTeaId] = useState('')
    const [presetTeaType, setPresetTeaType] = useState('')
    const [presetInfusionsAmount, setPresetInfusionsAmount] = useState<number>(1)
    const [presetInfusionTimes, setPresetInfusionTimes] = useState('')

    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editTeaId, setEditTeaId] = useState('');
    const [editTeaType, setEditTeaType] = useState('');
    const [editInfusionsAmount, setEditInfusionsAmount] = useState<number>(1);
    const [editInfusionTimes, setEditInfusionTimes] = useState('');

    const beginEditPreset = (preset: Preset) => {
        setEditingPresetId(preset.id);
        setEditName(preset.name);
        setEditTeaId(preset.teaId || '');
        setEditTeaType(preset.teaType || '');
        setEditInfusionsAmount(preset.infusionsAmount);
        setEditInfusionTimes(preset.infusionTimes.join(','));
    };

    const batchSize = 6;
    const [brewItemsToShow, setBrewItemsToShow] = useState(batchSize)

    const handleAddPreset = (e: React.FormEvent) => {
        e.preventDefault()
        if (!presetName.trim()) return alert('Name required')
        if (!presetInfusionsAmount || presetInfusionsAmount < 1) return alert('Infusions amount must be ≥ 1')
        if (!presetInfusionTimes.trim()) return alert('Set infusion times')
        const timesArr = presetInfusionTimes
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n))
        if (timesArr.length !== presetInfusionsAmount)
            return alert('Number of times must match infusion amount')

        let teaType = presetTeaType
        const teaId = presetTeaId

        if (presetTeaId) {
            const teaObj = teas.find(t => t.id === presetTeaId)
            teaType = teaObj?.type || ''
        }
        addPreset({
            name: presetName.trim(),
            teaId: teaId || undefined,
            teaType: teaType || undefined,
            infusionsAmount: presetInfusionsAmount,
            infusionTimes: timesArr
        })
        setPresetName('')
        setPresetTeaId('')
        setPresetTeaType('')
        setPresetInfusionsAmount(1)
        setPresetInfusionTimes('')
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

    const handleBrewEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPresetId) return;

        if (!editName.trim()) return alert('Name required');
        if (!editInfusionsAmount || editInfusionsAmount < 1) return alert('Infusions amount must be ≥ 1');
        if (!editInfusionTimes.trim()) return alert('Set infusion times');

        const timesArr = editInfusionTimes
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n));

        if (timesArr.length !== editInfusionsAmount)
            return alert('Number of times must match infusion amount');

        let teaType = editTeaType;
        if (editTeaId) {
            const teaObj = teas.find(t => t.id === editTeaId);
            teaType = teaObj?.type || '';
        }

        updatePreset(editingPresetId, {
            name: editName.trim(),
            teaId: editTeaId || undefined,
            teaType: teaType || undefined,
            infusionsAmount: editInfusionsAmount,
            infusionTimes: timesArr
        });

        setEditingPresetId(null);
        setEditName('');
        setEditTeaId('');
        setEditTeaType('');
        setEditInfusionsAmount(1);
        setEditInfusionTimes('');
    };

    const cancelEdit = () => {
        setEditingPresetId(null);
        setEditName('');
        setEditTeaId('');
        setEditTeaType('');
        setEditInfusionsAmount(1);
        setEditInfusionTimes('');
    };

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

    const filteredPresets = presets.filter(p =>
    (!search
        || p.name.toLowerCase().includes(search.toLowerCase())
        || (p.teaId && teas.find(t => t.id === p.teaId)?.name?.toLowerCase().includes(search.toLowerCase()))
        || (p.teaType && p.teaType.toLowerCase().includes(search.toLowerCase()))
    )
    )

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
                        <label className='filter-label'>
                            # of infusions/steeps:&nbsp;
                            <div className="select-wrap">
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
                            </div>
                        </label>
                        <label className='filter-label'>
                            Total brew length:&nbsp;
                            <div className="select-wrap">
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
                            </div>
                        </label>
                        <label className='filter-label'>Search:&nbsp;
                            <SearchBar value={search} setValue={setSearch} placeholder="Search brews & presets..." />
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
                            loader={<div>loading more...</div>}
                            endMessage={<div>no more brews</div>}
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
                    <div>
                        <h2>New preset</h2>
                        <div className="brew-main-actions">
                            <label>
                                <span className="basic-label"><span className="req">* </span>Preset name:</span>
                                <input
                                    value={presetName}
                                    onChange={e => setPresetName(e.target.value)}
                                    required
                                    placeholder="e.g. morning gongfu"
                                    style={{ width: '100%' }}
                                />
                            </label>
                            <label>
                                <span className="basic-label">Select tea (optional):</span>
                                <div className="select-wrap">
                                    <select
                                        value={presetTeaId}
                                        onChange={e => setPresetTeaId(e.target.value)}
                                        style={{ width: '100%' }}
                                        required
                                    >
                                        <option value="">-</option>
                                        {teas.map(tea => (
                                            <option key={tea.id} value={tea.id}>{tea.name}</option>
                                        ))}
                                    </select>
                                    <span className="arr-down"></span>
                                </div>
                            </label>
                            {(!presetTeaId || !teas.find(t => t.id === presetTeaId)) && (
                                <label>
                                    <span className="basic-label"><span className='req'>* </span>Tea type:</span>
                                    <div className="select-wrap">
                                        <select value={presetTeaType} onChange={e => setPresetTeaType(e.target.value)}
                                            required={!presetTeaId} style={{ width: '100%' }}>

                                            <option value="any">any</option>
                                            <option value="green">green</option>
                                            <option value="oolong">oolong</option>
                                            <option value="red">red</option>
                                            <option value="white">white</option>
                                            <option value="yellow">yellow</option>
                                            <option value="puerh">puerh</option>
                                            <option value="purple">purple</option>
                                        </select>
                                        <span className="arr-down"></span>
                                    </div>
                                </label>
                            )}
                            <label>
                                <span className="basic-label"><span className='req'>* </span>Amount of infusions/steeps:</span>
                                <input
                                    type="number"
                                    min={1}
                                    value={presetInfusionsAmount}
                                    onChange={e => setPresetInfusionsAmount(Number(e.target.value))}
                                    required
                                    style={{ width: '100%' }}
                                />
                            </label>
                            <label>
                                <span className="basic-label"><span className='req'>* </span>Set infusion times (in seconds):</span>
                                <input
                                    value={presetInfusionTimes}
                                    onChange={e => setPresetInfusionTimes(e.target.value)}
                                    placeholder="e.g. 5, 7, 12, 20"
                                    required
                                    style={{ width: '100%' }}
                                />
                            </label>
                            <button className="btn btn-quick" onClick={handleAddPreset}>
                                <i className="bxr bx-plus" /> add preset
                            </button>
                        </div>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <h2>All presets</h2>
                        <ul className="brew-list">
                            {filteredPresets.length === 0 && (
                                <p>no presets found</p>
                            )}
                            {filteredPresets.map(preset => {
                                const tea = preset.teaId ? teas.find(t => t.id === preset.teaId) : undefined;
                                const teaName = tea?.name ?? null;
                                const hasDrift =
                                    !!tea &&
                                    !!tea.type &&
                                    !!preset.teaType &&
                                    tea.type !== preset.teaType;

                                return (
                                    <li className='brew-item' key={preset.id}>
                                        <div className="brew-details">
                                            <strong>{preset.name}</strong>&nbsp;
                                            {teaName ? (
                                                <>
                                                    &mdash; Tea: {teaName}
                                                    {preset.teaType && (
                                                        <span
                                                            className={'tea-tag tea-tag-' + preset.teaType}
                                                            style={{ marginLeft: 6 }}
                                                        >
                                                            {preset.teaType}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    &mdash; Tea type:
                                                    <span className={'tea-tag tea-tag-' + (preset.teaType || 'generic')}>
                                                        {preset.teaType || 'generic'}
                                                    </span>
                                                </>
                                            )}
                                            <div style={{ marginTop: 8 }}>
                                                Infusions: {preset.infusionsAmount}<br />
                                                Times: {preset.infusionTimes.join('s, ')}s
                                            </div>

                                            {hasDrift && (
                                                <div className='gentle-sync' style={{ fontSize: 13, color: '#a56800' }}>
                                                    Type changed in tea profile: {preset.teaType} → {tea!.type}<br />
                                                    <button
                                                        style={{ width: 'max-content' }}
                                                        className="btn btn-quick btn-sync"
                                                        onClick={() => updatePreset(preset.id, { teaType: tea!.type })}
                                                    >
                                                        <i className="bxr bx-refresh-cw-alt" /> sync
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="brew-actions">
                                            <button
                                                className="btn btn-info"
                                                onClick={() => beginEditPreset(preset)}
                                            >
                                                <i className="bxr bx-edit" />
                                            </button>
                                            <button
                                                className="btn btn-danger"
                                                onClick={() => deletePreset(preset.id)}
                                                aria-label="Delete preset"
                                            >
                                                <i className="bxr bx-trash" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </section>
                {editingPresetId && (
                    <section className='edit-preset-container'>
                        <div className='edit-preset'>
                            <h2>Edit preset &mdash; {editName || 'preset'}</h2>
                            <form className="edit-preset-form" style={{ marginTop: 10, display: 'grid', gap: 10 }} onSubmit={handleBrewEdit}>
                                <label>
                                    <span className='basic-label'><span className="req">* </span>Preset name:</span>
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        required
                                        placeholder="Preset name"
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <label>
                                    <span className="basic-label">Select tea (optional):</span>
                                    <div className="select-wrap">
                                        <select
                                            value={editTeaId}
                                            onChange={e => setEditTeaId(e.target.value)}
                                            style={{ width: '100%' }}
                                        >
                                            <option value="">-</option>
                                            {teas.map(tea => (
                                                <option key={tea.id} value={tea.id}>{tea.name}</option>
                                            ))}
                                        </select>
                                        <span className="arr-down"></span>
                                    </div>
                                </label>
                                {(!editTeaId || !teas.find(t => t.id === editTeaId)) && (
                                    <label>
                                        <span className='basic-label'><span className="req">* </span>Tea type:</span>
                                        <div className="select-wrap">
                                            <select
                                                value={editTeaType}
                                                onChange={e => setEditTeaType(e.target.value)}
                                                required={!editTeaId}
                                                style={{ width: '100%' }}
                                            >
                                                <option value="any">any</option>
                                                <option value="green">green</option>
                                                <option value="oolong">oolong</option>
                                                <option value="red">red</option>
                                                <option value="white">white</option>
                                                <option value="yellow">yellow</option>
                                                <option value="puerh">puerh</option>
                                                <option value="purple">purple</option>
                                            </select>
                                            <span className="arr-down"></span>
                                        </div>
                                    </label>
                                )}
                                <label>
                                    <span className="basic-label"><span className="req">* </span>Amount of infusions/steeps:</span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={editInfusionsAmount}
                                        onChange={e => setEditInfusionsAmount(Number(e.target.value))}
                                        required
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <label>
                                    <span className="basic-label"><span className="req">* </span>Set infusion times (in seconds):</span>
                                    <input
                                        value={editInfusionTimes}
                                        onChange={e => setEditInfusionTimes(e.target.value)}
                                        required
                                        placeholder="Set infusion times e.g. 5, 7, 12, 20"
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-quick" type="submit">
                                        <i className="bxr bx-save" /> save
                                    </button>
                                    <button className="btn btn-dark" type="button" onClick={cancelEdit}>
                                        <i className="bxr bx-block" /> cancel
                                    </button>
                                </div>
                            </form>
                        </div>

                    </section>
                )}
                <section className="quick-actions">
                    <div>
                        <h2>Start brew session</h2>
                        <div className='brew-main-actions'>
                            <label>
                                <span className="basic-label"><span className='req'>* </span>Select tea:</span>
                                <div className="select-wrap">
                                    <select
                                        value={selectedTeaId}
                                        onChange={e => setSelectedTeaId(e.target.value)}
                                    >
                                        <option value="">-</option>
                                        {teas.map(tea => (
                                            <option key={tea.id} value={tea.id}>{tea.name}</option>
                                        ))}
                                    </select>
                                    <span className='arr-down'></span>
                                </div>
                            </label>
                            <label>
                                <span className="basic-label">Select preset (optional):</span>
                                <div className="select-wrap">
                                    <select
                                        value={selectedPresetId}
                                        onChange={e => setSelectedPresetId(e.target.value)}
                                    >
                                        <option value="">-</option>
                                        {presets.map(preset => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.name} {preset.teaType ? `[${preset.teaType}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <span className='arr-down'></span>
                                </div>
                            </label>
                            <button
                                className="btn btn-quick"
                                onClick={() => {
                                    if (!selectedTeaId) return alert('Select a tea first');
                                    const newId = addBrew({ teaId: selectedTeaId });
                                    setActiveBrewId(newId);
                                }}
                            >
                                <i className="bxr bx-alarm-plus" /> start brew
                            </button>
                        </div>
                        {activeBrewId && (
                            <BrewTimer
                                brewId={activeBrewId}
                                preset={selectedPresetId ? presets.find(p => p.id === selectedPresetId) : undefined}
                                onClose={() => {
                                    setActiveBrewId(null);
                                    setSelectedPresetId('');
                                }}
                                reportLive={(num, secs, running) => {
                                    setLiveInfusionNumber(num)
                                    setLiveInfusionSecs(secs)
                                    setIsLiveRunning(running)
                                }}
                            />
                        )}
                    </div>
                </section>
            </div>
            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.25; }
                    100% { opacity: 1; }
                }
            `}</style>
        </section >
    )
}

export default BrewPage
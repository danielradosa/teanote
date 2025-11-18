'use client'

import { useRef, useEffect, useState } from 'react'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useTeasStore } from '../stores/useTeasStore'
import BrewTimer from '../components/brew/BrewTimer'
import SearchBar from '../components/SearchBar'
import type { Brew, Preset } from '../types/Brew'
import InfiniteScroll from 'react-infinite-scroll-component'
import { useToggleFilters } from '../hooks/toggleFilters';
import { t } from 'i18next'

function BrewPage() {
    const {
        visibleBrews,
        addBrew,
        deleteBrew,
        addPreset,
        updatePreset,
        deletePreset,
        visiblePresets
    } = useBrewsStore()

    const { visibleTeas } = useTeasStore()
    const teas = visibleTeas()

    const brews = visibleBrews()
    const presets = visiblePresets()

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
    const { showFilters, toggleFilters } = useToggleFilters();

    const firstOpenRef = useRef(false);

    useEffect(() => {
        if (editingPresetId && window.innerWidth < 860 && !firstOpenRef.current) {
            firstOpenRef.current = true;
            const el = document.querySelector('.edit-panel') as HTMLElement | null;
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 150;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }

        if (!editingPresetId) {
            firstOpenRef.current = false;
        }
    }, [editingPresetId]);

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

        cancelEdit();
    };

    const cancelEdit = () => {
        setEditingPresetId(null);
        setEditName('');
        setEditTeaId('');
        setEditTeaType('');
        setEditInfusionsAmount(1);
        setEditInfusionTimes('');
    };

    const actualInfusionCounts = Array.from(new Set(brews.map(b => b.infusions.length).filter(c => c > 0)));
    const infusionOptions = actualInfusionCounts.sort((a, b) => a - b).map(c => <option key={c} value={c}>{c}</option>);

    const actualBrewLengths = Array.from(new Set(brews.filter(b => b.infusions.length > 0).map(b => b.infusions.reduce((sum, i) => sum + i.actualTime, 0))));
    const brewLengthOptions = actualBrewLengths.sort((a, b) => a - b).map(l => <option key={l} value={l}>{l}s</option>);

    const filteredBrews = brews.filter(b => {
        const infusionCount = b.infusions.length;
        const totalLength = b.infusions.reduce((sum, inf) => sum + inf.actualTime, 0);
        const tea = teas.find(t => t.id === b.teaId);
        const matchesSearch = !search || (tea && tea.name.toLowerCase().includes(search.toLowerCase()));
        if ((selectedInfusions || selectedLength) && infusionCount === 0) return false;
        return (!selectedInfusions || infusionCount === selectedInfusions) &&
            (!selectedLength || totalLength === selectedLength) &&
            matchesSearch;
    });

    const filteredPresets = presets.filter(p => !search
        || p.name.toLowerCase().includes(search.toLowerCase())
        || (p.teaId && teas.find(t => t.id === p.teaId)?.name?.toLowerCase().includes(search.toLowerCase()))
        || (p.teaType && p.teaType.toLowerCase().includes(search.toLowerCase()))
    );

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
    }, [brewItemsToShow, brews, orderedBrews.length]);

    const fetchMoreBrews = () => setBrewItemsToShow(prev => prev + batchSize);

    return (
        <section className="page-wrap brew-page">
            <header className="page-header">
                <h1>{t('brews_title')}</h1>
                <p className="subtitle">{t('brews_subtitle')} 🍵</p>
            </header>

            <div className="brew-content">
                {/* Brew Filters */}
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
                                        setSelectedInfusions(
                                            e.target.value ? parseInt(e.target.value) : null
                                        )
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
                                        setSelectedLength(
                                            e.target.value ? parseInt(e.target.value) : null
                                        )
                                    }>
                                    <option value="">{t('brews_filter_length_select')}</option>
                                    {brewLengthOptions}
                                </select>
                                <span className='arr-down'></span>
                            </div>
                        </label>
                        <label className='filter-label'>{t('general_search_label')}:&nbsp;
                            <SearchBar value={search} setValue={setSearch} placeholder={t('brews_filter_search_p')} />
                        </label>
                        <button className="btn btn-dark"
                            onClick={() => { setSelectedInfusions(null); setSelectedLength(null); setSearch(''); }}>
                            <i className="bxr bx-eraser" /> {t('general_search_clear_btn')}
                        </button>
                    </div>
                </section>
                {/* Brews list */}
                <section className="recent-sessions">
                    <h2>{t('brews_recent_title')}</h2>
                    {brews.length > 0 ? (
                        <InfiniteScroll
                            dataLength={Math.min(brewItemsToShow, orderedBrews.length)}
                            next={fetchMoreBrews}
                            hasMore={brewItemsToShow < orderedBrews.length}
                            loader={<div>{t('general_loading_more')}</div>}
                            endMessage={<div>{t('brews_no_more')}</div>}
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
                                                        <span className="brew-finished-badge">{t('brews_item_finished')}</span>
                                                    )}
                                                </span>
                                                <div className="brew-meta">
                                                    {brew.infusions.length > 0
                                                        ? `${brew.infusions.length} ${brew.infusions.length === 1 ? `${t('brews_item_infusion')}` : `${t('brews_item_infusions_s')}`}`
                                                        : <span style={{ color: '#a52d44' }}>{t('brews_item_no_infusions')}</span>
                                                    }
                                                </div>
                                                <div className="brew-meta">
                                                    {brew.presetId && (
                                                        <div style={{ fontStyle: 'italic', color: '#555' }}>
                                                            {t('brews_item_preset')}: {presets.find(p => p.id === brew.presetId)?.name}
                                                        </div>
                                                    )}
                                                    <span>
                                                        {totalTime}s {t('brews_item_total')} • {t('brews_item_infusions')}:&nbsp;
                                                        {infusionTimes.length > 0
                                                            ? infusionTimes.join('s, ') + 's'
                                                            : '-'}
                                                    </span>
                                                </div>
                                                {getLiveElement(brew)}
                                            </div>
                                            <div className="brew-actions">
                                                {/* TODO - EDIT FORM?? */}
                                                <button className="btn btn-danger" onClick={() => deleteBrew(brew.id)}><i className="bxr bx-trash" /></button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </InfiniteScroll>
                    ) : (
                        <p style={{ marginTop: 8 }}>{t('brews_no_yet')}</p>
                    )}
                </section>
                <section className="new-preset">
                    <div>
                        <h2>{t('brews_form_new_preset')}</h2>
                        <div className="brew-main-actions">
                            <label>
                                <span className="basic-label"><span className="req">* </span>{t('brews_form_pname_label')}:</span>
                                <input
                                    value={presetName}
                                    onChange={e => setPresetName(e.target.value)}
                                    required
                                    placeholder={t('brews_form_pname_p')}
                                    style={{ width: '100%' }}
                                />
                            </label>
                            <label>
                                <span className="basic-label">{t('brews_form_tname_label')}:</span>
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
                                    <span className="basic-label"><span className='req'>* </span>{t('brews_form_ttype_label')}:</span>
                                    <div className="select-wrap">
                                        <select value={presetTeaType} onChange={e => setPresetTeaType(e.target.value)}
                                            required={!presetTeaId} style={{ width: '100%' }}>

                                            <option value="any">{t('brews_form_ttype_any')}</option>
                                            <option value="green">{t('tea_tag_green')}</option>
                                            <option value="oolong">{t('tea_tag_oolong')}</option>
                                            <option value="red">{t('tea_tag_red')}</option>
                                            <option value="white">{t('tea_tag_white')}</option>
                                            <option value="yellow">{t('tea_tag_yellow')}</option>
                                            <option value="puerh">{t('tea_tag_puerh')}</option>
                                            <option value="purple">{t('tea_tag_purple')}</option>
                                        </select>
                                        <span className="arr-down"></span>
                                    </div>
                                </label>
                            )}
                            <label>
                                <span className="basic-label"><span className='req'>* </span>{t('brews_form_ainfusions_label')}:</span>
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
                                <span className="basic-label"><span className='req'>* </span>{t('brews_form_tinfusions_label')}:</span>
                                <input
                                    value={presetInfusionTimes}
                                    onChange={e => setPresetInfusionTimes(e.target.value)}
                                    placeholder={t('brews_form_tinfusions_p')}
                                    required
                                    style={{ width: '100%' }}
                                />
                            </label>
                            <div className="brew-actions">
                                <button className="btn btn-quick" onClick={handleAddPreset}>
                                    <i className="bxr bx-plus" /> {t('brews_form_add_preset')}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style={{ marginTop: '16px' }}>
                        <h2>{t('presets_all_title')}</h2>
                        <ul className="brew-list">
                            {filteredPresets.length === 0 && (
                                <p>{t('presets_none')}</p>
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
                                    <li className='brew-item preset' key={preset.id}>
                                        <div className="brew-details">
                                            <strong>{preset.name}</strong>&nbsp;
                                            {teaName ? (
                                                <>
                                                    &mdash; {t('presets_tea_tea')}: {teaName}
                                                    {preset.teaType && (
                                                        <span
                                                            className={'tea-tag tea-tag-' + preset.teaType}
                                                            style={{ marginLeft: 6 }}
                                                        >
                                                            {t(`tea_tag_${preset.teaType}`)}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    &mdash; {t('presets_tea_type')}:
                                                    <span className={'tea-tag tea-tag-' + (preset.teaType || 'generic')}>
                                                        {preset.teaType
                                                            ? t(`tea_tag_${preset.teaType}`)
                                                            : t("preset_type_generic")}
                                                    </span>
                                                </>
                                            )}
                                            <div style={{ marginTop: 8 }}>
                                                {t('preset_infusions')}: {preset.infusionsAmount}<br />
                                                {t('preset_times')}: {preset.infusionTimes.join('s, ')}s
                                            </div>

                                            {hasDrift && (
                                                <div className='gentle-sync' style={{ fontSize: 13, color: '#a56800' }}>
                                                    {t('preset_changed')}: {t(`tea_tag_${preset.teaType}`)} → {t(`tea_tag_${tea!.type}`)}<br />
                                                    <button
                                                        style={{ width: 'max-content' }}
                                                        className="btn btn-quick btn-sync"
                                                        onClick={() => updatePreset(preset.id, { teaType: tea!.type })}
                                                    >
                                                        <i className="bxr bx-refresh-cw-alt" /> {t('preset_sync_btn')}
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
                            <h2>{t('preset_edit_title')} &mdash; {editName || 'preset'}</h2>
                            <form className="edit-preset-form" style={{ marginTop: 10, display: 'grid', gap: 10 }} onSubmit={handleBrewEdit}>
                                <label>
                                    <span className='basic-label'><span className="req">* </span>{t('preset_edit_title_label')}:</span>
                                    <input
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        required
                                        placeholder={t('preset_edit_title_p')}
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <label>
                                    <span className="basic-label">{t('preset_edit_select_tea')}:</span>
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
                                        <span className='basic-label'><span className="req">* </span>{t('preset_edit_tea_type_label')}:</span>
                                        <div className="select-wrap">
                                            <select
                                                value={editTeaType}
                                                onChange={e => setEditTeaType(e.target.value)}
                                                required={!editTeaId}
                                                style={{ width: '100%' }}
                                            >
                                                <option value="any">{t('tea_tag_any')}</option>
                                                <option value="green">{t('tea_tag_green')}</option>
                                                <option value="oolong">{t('tea_tag_oolong')}</option>
                                                <option value="red">{t('tea_tag_red')}</option>
                                                <option value="white">{t('tea_tag_white')}</option>
                                                <option value="yellow">{t('tea_tag_yellow')}</option>
                                                <option value="puerh">{t('tea_tag_puerh')}</option>
                                                <option value="purple">{t('tea_tag_purple')}</option>
                                            </select>
                                            <span className="arr-down"></span>
                                        </div>
                                    </label>
                                )}
                                <label>
                                    <span className="basic-label"><span className="req">* </span>{t('preset_edit_ainfusions_label')}:</span>
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
                                    <span className="basic-label"><span className="req">* </span>{t('preset_edit_tinfusions_label')}:</span>
                                    <input
                                        value={editInfusionTimes}
                                        onChange={e => setEditInfusionTimes(e.target.value)}
                                        required
                                        placeholder={t('preset_edit_tinfusions_p')}
                                        style={{ width: '100%' }}
                                    />
                                </label>
                                <div style={{ display: 'flex', gap: 8 }} className='brew-actions'>
                                    <button className="btn btn-quick" type="submit">
                                        <i className="bxr bx-save" /> {t('preset_save_btn')}
                                    </button>
                                    <button className="btn btn-dark" type="button" onClick={cancelEdit}>
                                        <i className="bxr bx-block" /> {t('preset_cancel_btn')}
                                    </button>
                                </div>
                            </form>
                        </div>

                    </section>
                )}
                <section className="quick-actions new-sesion">
                    <div>
                        <h2>{t('session_start_title')}</h2>
                        <div className='brew-main-actions'>
                            <label>
                                <span className="basic-label"><span className='req'>* </span>{t('session_select_tea')}:</span>
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
                                <span className="basic-label">{t('session_select_preset')}:</span>
                                <div className="select-wrap">
                                    <select
                                        value={selectedPresetId}
                                        onChange={e => setSelectedPresetId(e.target.value)}
                                    >
                                        <option value="">-</option>
                                        {presets.map(preset => (
                                            <option key={preset.id} value={preset.id}>
                                                {preset.name} {preset.teaType ? `[${t(`tea_tag_${preset.teaType}`)}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <span className='arr-down'></span>
                                </div>
                            </label>
                            <div className="brew-actions">
                                <button
                                    className="btn btn-quick"
                                    onClick={() => {
                                        if (!selectedTeaId) return alert(`${t('session_alert_tea_select')}`);
                                        const newId = addBrew({ teaId: selectedTeaId, presetId: selectedPresetId || undefined });
                                        if (typeof newId === 'string') {
                                            setActiveBrewId(newId);
                                        }
                                    }}
                                >
                                    <i className="bxr bx-alarm-plus" /> {t('session_start_btn')}
                                </button>
                            </div>
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
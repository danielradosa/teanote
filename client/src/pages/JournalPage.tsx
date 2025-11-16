'use client'

import { useRef, useState, useEffect } from 'react'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useTeasStore } from '../stores/useTeasStore'
import type { Journal } from '../types/Journal'
import RichToolbar from '../components/RichToolbar'
import MdDisplay from '../components/MdDisplay'
import InfiniteScroll from 'react-infinite-scroll-component'
import SearchBar from '../components/SearchBar'
import { useToggleFilters } from '../hooks/toggleFilters'
import { t } from 'i18next'

function JournalPage() {
    const { visibleTeas } = useTeasStore()
    const teas = visibleTeas()
    const { visibleBrews, visiblePresets, getBrewName } = useBrewsStore()
    const brews = visibleBrews()
    const presets = visiblePresets()
    const { addJournal, deleteJournal, updateJournal, visibleJournals } = useJournalsStore()
    const journals = visibleJournals()
    const emptyForm: Omit<Journal, 'id' | 'dateAdded'> = { teaId: '', title: '', content: '', rating: undefined, updated_at: '', brew_preset_id: '' }
    const [form, setForm] = useState(emptyForm)
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null)
    const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [ratingFilter, setRatingFilter] = useState<number | ''>('')
    const [search, setSearch] = useState('')
    const { showFilters, toggleFilters } = useToggleFilters();

    const batchSize = 6;
    const [journalItemsToShow, setJournalItemsToShow] = useState(batchSize)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const editTextareaRef = useRef<HTMLTextAreaElement>(null)

    const firstOpenRef = useRef(false);

    useEffect(() => {
        if (editingJournal && window.innerWidth < 860 && !firstOpenRef.current) {
            firstOpenRef.current = true;
            const el = document.querySelector('.edit-panel') as HTMLElement | null;
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 150;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }

        if (!editingJournal) {
            firstOpenRef.current = false;
        }
    }, [editingJournal]);

    const handleAddJournal = () => {
        if (!form.title.trim() || !form.content.trim()) return alert('Title and content required')
        addJournal(form)
        setForm(emptyForm)
    }
    const handleEdit = (journal: Journal) => setEditingJournal(journal)
    const handleUpdate = () => {
        if (!editingJournal) return
        updateJournal(editingJournal.id, editingJournal)
        setEditingJournal(null)
    }
    const toggleDetails = (id: string) => {
        setOpenDetailsId(prev => (prev === id ? null : id))
    }

    const filteredJournals = journals.filter(journal => {
        const tea = teas.find(t => t.id === journal.teaId);

        return (
            (!typeFilter || tea?.type === typeFilter) &&
            (!ratingFilter || journal.rating === ratingFilter) &&
            (
                !search ||
                journal.title.toLowerCase().includes(search.toLowerCase()) ||
                (tea?.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
                (tea?.type?.toLowerCase() || '').includes(search.toLowerCase())
            )
        );
    });
    const orderedJournals = [...filteredJournals].reverse();

    const teaTypesInJournals = [...new Set(
        journals
            .map(journal => teas.find(t => t.id === journal.teaId)?.type)
            .filter(Boolean)
    )];

    useEffect(() => {
        const ensureScrollable = () => {
            const ul = document.querySelector('.journal-list');
            if (!ul) return;
            const rect = ul.getBoundingClientRect();
            if (rect.bottom < window.innerHeight && journalItemsToShow < orderedJournals.length) {
                setJournalItemsToShow(prev => Math.min(prev + 1, orderedJournals.length));
                requestAnimationFrame(ensureScrollable);
            }
        };
        requestAnimationFrame(ensureScrollable);
        // eslint-disable-next-line
    }, [journals, typeFilter, ratingFilter]);

    const fetchMoreJournals = () => setJournalItemsToShow(prev => prev + 6);

    return (
        <section className="page-wrap journal-page">
            <header className="page-header">
                <h1>{t('journals_title')}</h1>
                <p className="subtitle">{t('journals_subtitle')} 🍵</p>
            </header>
            <div className="journal-content">
                {/* Journal Filters */}
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
                                    {teaTypesInJournals.map(type => (
                                        <option value={type} key={type}>
                                            {t(`tea_tag_${type}`)}
                                        </option>
                                    ))}
                                </select>
                                <span className='arr-down'></span>
                            </div>
                        </label>
                        {/* Rating dropdown */}
                        <label className='filter-label'>
                            {t('journal_rating_label')}:&nbsp;
                            <div className="select-wrap">
                                <select
                                    value={ratingFilter}
                                    onChange={e => setRatingFilter(e.target.value === '' ? '' : Number(e.target.value))}
                                >
                                    <option value="">{t('journal_select_rating')}</option>
                                    {[1, 2, 3, 4, 5].map(r =>
                                        <option value={r} key={r}>{'⭐'.repeat(r)}</option>
                                    )}
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
                {/* Journal List */}
                <section className="journal-table">
                    <h2>{t('journals_all')}</h2>
                    {filteredJournals.length > 0 ? (
                        <InfiniteScroll
                            dataLength={Math.min(journalItemsToShow, orderedJournals.length)}
                            next={fetchMoreJournals}
                            hasMore={journalItemsToShow < orderedJournals.length}
                            loader={<div>{t('general_loading_more')}</div>}
                            endMessage={<div>{t('journals_no_more')}</div>}
                        >
                            <ul className="journal-list">
                                {orderedJournals.slice(0, journalItemsToShow).map(journal => {
                                    const tea = teas.find(t => t.id === journal.teaId)
                                    return (
                                        <li key={journal.id} className="journal-item">
                                            <div className={`journal-details ${openDetailsId === journal.id ? 'details-open' : ''}`}>
                                                <span>
                                                    <strong>{journal.title}</strong>{' '}
                                                    {/* Tea tag */}
                                                    {tea && (
                                                        <>
                                                            <span
                                                                className={`tea-tag tea-tag-${tea.type}`}
                                                                style={{
                                                                    marginLeft: 4,
                                                                    padding: '2px 8px',
                                                                    borderRadius: 8,
                                                                    background: '#f6f6f6',
                                                                    fontSize: '13px',
                                                                    color: '#458253',
                                                                    textTransform: 'capitalize',
                                                                    display: 'inline-block'
                                                                }}
                                                            >
                                                                {t(`tea_tag_${tea.type}`)}
                                                            </span>
                                                            {/* Tea name right next to tag */}
                                                            <span
                                                                className="tea-name"
                                                                style={{
                                                                    marginLeft: 8,
                                                                    fontStyle: 'italic',
                                                                    fontSize: '13px'
                                                                }}
                                                            >{tea.name}</span>
                                                        </>
                                                    )}
                                                    {/* Rating stars/number */}
                                                    {journal.rating !== undefined && (
                                                        <span style={{ marginLeft: 8, color: '#ffc21a', fontWeight: 600 }}>
                                                            {'⭐'.repeat(journal.rating)}
                                                        </span>
                                                    )}
                                                    <span className="journal-date" style={{ fontSize: '10px', marginLeft: 8 }}>
                                                        ({new Date(journal.dateAdded ?? Date.now()).toLocaleDateString()})
                                                    </span>
                                                </span>
                                                {openDetailsId === journal.id && (
                                                    <div className="journal-extra">
                                                        <p style={{ fontSize: '13px' }}>
                                                            {t('journals_brew_preset')}:{' '}
                                                            <strong>{getBrewName(journal.brew_preset_id ?? '') || 'none'}</strong>
                                                        </p>
                                                        <MdDisplay content={journal.content} />
                                                    </div>
                                                )}
                                                <button className="btn btn-dark btn-simple" onClick={() => toggleDetails(journal.id)}>
                                                    <i className={`bxr ${openDetailsId === journal.id ? 'bx-list-minus' : 'bx-list-plus'}`} />
                                                    {openDetailsId === journal.id ? `${t('general_hide_details')}` : `${t('general_see_details')}`}
                                                </button>
                                            </div>
                                            <div className="journal-actions">
                                                <button className="btn btn-info" onClick={() => handleEdit(journal)}><i className="bxr bx-edit" /></button>
                                                <button className="btn btn-danger" onClick={() => deleteJournal(journal.id)}><i className="bxr bx-trash" /></button>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ul>
                        </InfiniteScroll>
                    ) : (
                        <p style={{ marginTop: 8 }}>{t('journals_none')}</p>
                    )}
                </section>

                {editingJournal && (
                    <section className="edit-panel">
                        <h2>{t('journals_edit')} — {editingJournal.title}</h2>
                        <div className="journal-form">
                            <label>
                                <span className="basic-label"><span className="req">* </span>{t('journal_form_name_label')}:</span>
                                <input
                                    type="text"
                                    placeholder={t('journal_form_name_p')}
                                    value={editingJournal.title}
                                    onChange={e => setEditingJournal(j => j ? { ...j, title: e.target.value } : null)}
                                />
                            </label>
                            <label>
                                <span className="basic-label">{t('journal_form_brew_label')}:</span>
                                <div className="select-wrap">
                                    <select
                                        value={editingJournal.brew_preset_id || ''}
                                        onChange={e => setEditingJournal(j => j ? { ...j, brew_preset_id: e.target.value } : null)}
                                    >
                                        <option value="">-</option>
                                        {brews.map(b => {
                                            const tea = teas.find(t => t.id === b.teaId)
                                            const teaName = tea?.name || 'Unknown Tea'
                                            const preset = presets.find(p => p.id === b.presetId)
                                            const presetName = preset?.name ? ` [${preset.name}]` : ''
                                            const date = new Date(b.startedAt).toLocaleDateString()
                                            return (
                                                <option key={b.id} value={b.id}>
                                                    {`${teaName}${presetName} – ${t('journal_brewed_on')} ${date}`}
                                                </option>
                                            )
                                        })}
                                    </select>
                                    <span className="arr-down"></span>
                                </div>
                            </label>
                            <label>
                                <span className='basic-label'>{t('journal_form_tea_label')}:</span>
                                <div className="select-wrap">
                                    <select
                                        required
                                        value={editingJournal.teaId}
                                        onChange={e => setEditingJournal(j => j ? { ...j, teaId: e.target.value } : null)}
                                    >
                                        <option value="">-</option>
                                        {teas
                                            .filter(tea => journals.some(j => j.teaId === tea.id))
                                            .map(tea => (
                                                <option key={tea.id} value={tea.id}>
                                                    {tea.name} {tea.type ? `[${t(`tea_tag_${tea.type}`)}]` : ''}
                                                </option>
                                            ))}
                                    </select>
                                    <span className="arr-down"></span>
                                </div>
                            </label>
                            <label>
                                <span className="basic-label">{t('journal_form_rating_label')}:</span>
                                <input
                                    type="number"
                                    placeholder={t('journal_form_rating_p')}
                                    min={1}
                                    max={5}
                                    value={editingJournal.rating || ''}
                                    onChange={e =>
                                        setEditingJournal(j =>
                                            j ? { ...j, rating: e.target.value === '' ? undefined : Number(e.target.value) } : null
                                        )
                                    }
                                />
                            </label>
                            <RichToolbar
                                value={editingJournal.content}
                                setValue={v => setEditingJournal(j => j ? { ...j, content: v } : null)}
                                textareaRef={editTextareaRef}
                            />
                            <label>
                                <span className='basic-label'><span className="req">* </span>{t('journal_form_notes_label')}:</span>
                                <textarea
                                    ref={editTextareaRef}
                                    placeholder={t('journal_form_notes_p')}
                                    value={editingJournal.content}
                                    onChange={e => setEditingJournal(j => j ? { ...j, content: e.target.value } : null)}
                                />
                            </label>
                            <div className="journal-actions">
                                <button className="btn btn-quick" onClick={handleUpdate}>
                                    <i className="bxr bx-save" /> {t('journal_save_btn')}
                                </button>
                                <button className="btn btn-dark" onClick={() => setEditingJournal(null)}>
                                    <i className="bxr bx-block" /> {t('journal_cancel_btn')}
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Add New Journal */}
                <section className="new-journal">
                    <h2>{t('journal_add_new')}</h2>
                    <div className="journal-form">
                        <label>
                            <span className="basic-label"><span className="req">* </span>{t('journal_form_name_label')}:</span>
                            <input type="text" placeholder={t('journal_form_name_p')} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        </label>
                        <label>
                            <span className='basic-label'>{t('journal_form_brew_label')}:</span>
                            <div className='select-wrap'>
                                <select
                                    id="brew-select"
                                    value={form.brew_preset_id || ''}
                                    onChange={e => setForm({ ...form, brew_preset_id: e.target.value })}
                                    style={{ width: "100%", minWidth: 120 }}
                                >
                                    <option value="">-</option>
                                    {brews.map(b => {
                                        const tea = teas.find(t => t.id === b.teaId)
                                        const teaName = tea?.name || 'Unknown Tea'
                                        const preset = presets.find(p => p.id === b.presetId)
                                        const presetName = preset?.name ? ` [${preset.name}]` : ''
                                        const date = new Date(b.startedAt).toLocaleDateString()
                                        return (
                                            <option key={b.id} value={b.id}>
                                                {`${teaName}${presetName} – ${t('journal_brewed_on')} ${date}`}
                                            </option>
                                        )
                                    })}
                                </select>
                                <span className="arr-down"></span>
                            </div>
                        </label>
                        <label>
                            <span className='basic-label'>{t('journal_form_tea_label')}:</span>
                            <div className='select-wrap'>
                                <select
                                    id="tea-select"
                                    required
                                    value={form.teaId}
                                    onChange={e => setForm({ ...form, teaId: e.target.value })}
                                    style={{ width: "100%", minWidth: 120 }}
                                >
                                    <option value="">-</option>
                                    {teas.map(tea => (
                                        <option key={tea.id} value={tea.id}>{tea.name}</option>
                                    ))}
                                </select>
                                <span className="arr-down"></span>
                            </div>
                        </label>
                        <label>
                            <span className="basic-label">{t('journal_form_rating_label')}:</span>
                            <input
                                type="number"
                                placeholder={t('journal_form_rating_p')}
                                inputMode="numeric"
                                min={1}
                                max={5}
                                value={form.rating || ''}
                                onChange={e => setForm({ ...form, rating: e.target.value === '' ? undefined : Number(e.target.value) })}
                            />
                        </label>
                        <RichToolbar value={form.content} setValue={v => setForm({ ...form, content: v })} textareaRef={textareaRef} />
                        <label>
                            <span className="basic-label"><span className="req">* </span>{t('journal_form_notes_label')}:</span>
                            <textarea ref={textareaRef} placeholder={t('journal_form_notes_p')} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                        </label>
                        <div className="journal-actions">
                            <button className="btn btn-quick" onClick={handleAddJournal}><i className="bxr bx-plus" /> {t('journal_add_btn')}</button>
                        </div>
                    </div>
                </section>
            </div>
        </section>
    )
}
export default JournalPage

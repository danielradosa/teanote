'use client'

import { useRef, useState, useEffect } from 'react'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useTeasStore } from '../stores/useTeasStore'
import type { Journal } from '../types/Journal'
import RichToolbar from '../components/RichToolbar'
import MdDisplay from '../components/MdDisplay'
import InfiniteScroll from 'react-infinite-scroll-component'
import SearchBar from '../components/SearchBar'
import { useToggleFilters } from '../hooks/toggleFilters';

function JournalPage() {
    const { visibleTeas } = useTeasStore()
    const teas = visibleTeas()
    const { addJournal, deleteJournal, updateJournal, visibleJournals } = useJournalsStore()
    const journals = visibleJournals()
    const emptyForm: Omit<Journal, 'id' | 'dateAdded'> = { teaId: '', title: '', content: '', rating: undefined, updated_at: '' }
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

    useEffect(() => {
        if (editingJournal && window.innerWidth < 860) {
            const el = document.querySelector('.edit-panel') as HTMLElement | null;
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 150;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
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
                <h1>Journals</h1>
                <p className="subtitle">Your tea notes & reflections 🍵</p>
            </header>
            <div className="journal-content">
                {/* Journal Filters */}
                <section className="journal-filters" style={{ flex: '1 1 100%' }}>
                    <h2 onClick={toggleFilters}>
                        Filter journals
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
                                    {[...new Set(teas.map(t => t.type))].map(type =>
                                        <option value={type} key={type}>{type}</option>
                                    )}
                                </select>
                                <span className='arr-down'></span>
                            </div>
                        </label>
                        {/* Rating dropdown */}
                        <label className='filter-label'>
                            Rating:&nbsp;
                            <div className="select-wrap">
                                <select
                                    value={ratingFilter}
                                    onChange={e => setRatingFilter(e.target.value === '' ? '' : Number(e.target.value))}
                                >
                                    <option value="">all ratings</option>
                                    {[1, 2, 3, 4, 5].map(r =>
                                        <option value={r} key={r}>{'⭐'.repeat(r)}</option>
                                    )}
                                </select>
                                <span className='arr-down'></span>
                            </div>
                        </label>
                        <label className='filter-label'>
                            Search:&nbsp;
                            <SearchBar value={search} setValue={setSearch} placeholder="Search by teas or journal title..." />
                        </label>
                        <button className="btn btn-dark" onClick={() => { setTypeFilter(''); setRatingFilter(''); setSearch(''); }}>
                            <i className="bxr bx-eraser" /> clear filters
                        </button>
                    </div>
                </section>
                {/* Journal List */}
                <section className="journal-table">
                    <h2>All journals</h2>
                    {filteredJournals.length > 0 ? (
                        <InfiniteScroll
                            dataLength={Math.min(journalItemsToShow, orderedJournals.length)}
                            next={fetchMoreJournals}
                            hasMore={journalItemsToShow < orderedJournals.length}
                            loader={<div>loading more...</div>}
                            endMessage={<div>no more journals</div>}
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
                                                                {tea.type}
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
                                                        <MdDisplay content={journal.content} />
                                                    </div>
                                                )}
                                                <button className="btn btn-dark btn-simple" onClick={() => toggleDetails(journal.id)}>
                                                    <i className={`bxr ${openDetailsId === journal.id ? 'bx-list-minus' : 'bx-list-plus'}`} />
                                                    {openDetailsId === journal.id ? 'hide' : 'see'} details
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
                        <p style={{ marginTop: 8 }}>no journals yet — add your first one</p>
                    )}
                </section>

                {editingJournal && (
                    <section className="edit-panel">
                        <h2>Edit journal — {editingJournal.title}</h2>
                        <div className="journal-form">
                            <label>
                                <span className='basic-label'>Select tea (optional):</span>
                                <div className="select-wrap">
                                    <select
                                        required
                                        value={editingJournal.teaId}
                                        onChange={e => setEditingJournal(j => j ? { ...j, teaId: e.target.value } : null)}
                                    >
                                        <option value="">-</option>
                                        {teas.map(tea => (
                                            <option key={tea.id} value={tea.id}>
                                                {tea.name} {tea.type ? `[${tea.type}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <span className="arr-down"></span>
                                </div>
                            </label>
                            <label>
                                <span className="basic-label"><span className="req">* </span>Journal name:</span>
                                <input
                                    type="text"
                                    placeholder="e.g. Thoughts on Duck Shit"
                                    value={editingJournal.title}
                                    onChange={e => setEditingJournal(j => j ? { ...j, title: e.target.value } : null)}
                                />
                            </label>
                            <label>
                                <span className="basic-label">Rating (optional):</span>
                                <input
                                    type="number"
                                    placeholder="Rating (1 to 5)"
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
                                <span className='basic-label'><span className="req">* </span>Notes:</span>
                                <textarea
                                    ref={editTextareaRef}
                                    placeholder="Write your thoughts here…"
                                    value={editingJournal.content}
                                    onChange={e => setEditingJournal(j => j ? { ...j, content: e.target.value } : null)}
                                />
                            </label>
                            <div className="journal-actions">
                                <button className="btn btn-quick" onClick={handleUpdate}>
                                    <i className="bxr bx-save" /> save
                                </button>
                                <button className="btn btn-dark" onClick={() => setEditingJournal(null)}>
                                    <i className="bxr bx-block" /> cancel
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Add New Journal */}
                <section className="new-journal">
                    <h2>Add new journal</h2>
                    <div className="journal-form">
                        <label>
                            <span className='basic-label'>Select tea (optional):</span>
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
                            <span className="basic-label"><span className="req">* </span>Journal name:</span>
                            <input type="text" placeholder="e.g. Thoughts on Bai Mu Dan" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        </label>
                        <label>
                            <span className="basic-label">Rating (optional):</span>
                            <input
                                type="number"
                                placeholder="e.g. 3 (1 to 5)"
                                inputMode="numeric"
                                min={1}
                                max={5}
                                value={form.rating || ''}
                                onChange={e => setForm({ ...form, rating: e.target.value === '' ? undefined : Number(e.target.value) })}
                            />
                        </label>
                        <RichToolbar value={form.content} setValue={v => setForm({ ...form, content: v })} textareaRef={textareaRef} />
                        <label>
                            <span className="basic-label"><span className="req">* </span>Notes:</span>
                            <textarea ref={textareaRef} placeholder="Write your thoughts here…" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                        </label>
                        <div className="journal-actions">
                            <button className="btn btn-quick" onClick={handleAddJournal}><i className="bxr bx-plus" /> add journal</button>
                        </div>
                    </div>
                </section>
            </div>
        </section>
    )
}
export default JournalPage

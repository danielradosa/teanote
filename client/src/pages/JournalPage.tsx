'use client'

import { useRef, useState, useEffect } from 'react'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useTeasStore } from '../stores/useTeasStore'
import type { Journal } from '../types/Journal'
import RichToolbar from '../components/RichToolbar'
import MdDisplay from '../components/MdDisplay'
import InfiniteScroll from 'react-infinite-scroll-component'
import SearchBar from '../components/SearchBar'

function JournalPage() {
    const { teas } = useTeasStore()
    const { journals, addJournal, deleteJournal, updateJournal } = useJournalsStore()
    const emptyForm: Omit<Journal, 'id' | 'dateAdded'> = { teaId: '', title: '', content: '', rating: undefined }
    const [form, setForm] = useState(emptyForm)
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null)
    const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [ratingFilter, setRatingFilter] = useState<number | ''>('')
    const [search, setSearch] = useState('')

    const batchSize = 6;
    const [journalItemsToShow, setJournalItemsToShow] = useState(batchSize)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const editTextareaRef = useRef<HTMLTextAreaElement>(null)

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
                    <h2>Filter journals</h2>
                    <div className='filter-wrap'>
                        {/* Tea type dropdown */}
                        <label>
                            Type:&nbsp;
                            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                <option value="">all types</option>
                                {[...new Set(teas.map(t => t.type))].map(type =>
                                    <option value={type} key={type}>{type}</option>
                                )}
                            </select>
                            <span className='arr-down'></span>
                        </label>
                        {/* Rating dropdown */}
                        <label>
                            Rating:&nbsp;
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
                        </label>
                        <label>
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
                            loader={<div style={{ paddingTop: '16px', textAlign: 'center' }}>loading more...</div>}
                            endMessage={<div style={{ paddingTop: '16px', textAlign: 'center' }}>no more teas</div>}
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
                                                        ({new Date(journal.dateAdded).toLocaleDateString()})
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

                {/* Add New Journal */}
                <section className="new-journal">
                    <h2>Add new journal</h2>
                    <div className="journal-form">
                        <div style={{ position: "relative", width: '100%' }}>
                            <select
                                id="tea-select"
                                required
                                value={form.teaId}
                                onChange={e => setForm({ ...form, teaId: e.target.value })}
                                style={{ width: "100%", minWidth: 120 }}
                            >
                                <option value="">Select tea…</option>
                                {teas.map(tea => (
                                    <option key={tea.id} value={tea.id}>{tea.name}</option>
                                ))}
                            </select>
                            <span className="arr-down"></span>
                        </div>
                        <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        <input
                            type="number"
                            placeholder="Rating (1 to 5)"
                            inputMode="numeric"
                            min={1}
                            max={5}
                            value={form.rating || ''}
                            onChange={e => setForm({ ...form, rating: e.target.value === '' ? undefined : Number(e.target.value) })}
                        />
                        <RichToolbar value={form.content} setValue={v => setForm({ ...form, content: v })} textareaRef={textareaRef} />
                        <textarea ref={textareaRef} placeholder="Write your thoughts here…" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                        <div className="journal-actions">
                            <button className="btn btn-quick" onClick={handleAddJournal}><i className="bxr bx-plus" /> add journal</button>
                        </div>
                    </div>
                </section>

                {editingJournal && (
                    <section className="edit-panel">
                        <h2>Edit entry — {editingJournal.title}</h2>
                        <div className="journal-form">
                            {/* Tea selector */}
                            <select
                                required
                                value={editingJournal.teaId}
                                onChange={e => setEditingJournal(j => j ? { ...j, teaId: e.target.value } : null)}
                            >
                                <option value="">Select tea…</option>
                                {teas.map(tea => (
                                    <option key={tea.id} value={tea.id}>
                                        {tea.name} {tea.type ? `[${tea.type}]` : ''}
                                    </option>
                                ))}
                            </select>
                            {/* Title */}
                            <input
                                type="text"
                                placeholder="Title"
                                value={editingJournal.title}
                                onChange={e => setEditingJournal(j => j ? { ...j, title: e.target.value } : null)}
                            />
                            {/* Rating */}
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
                            {/* Notes */}
                            <RichToolbar
                                value={editingJournal.content}
                                setValue={v => setEditingJournal(j => j ? { ...j, content: v } : null)}
                                textareaRef={editTextareaRef}
                            />
                            <textarea
                                ref={editTextareaRef}
                                placeholder="Write your thoughts here…"
                                value={editingJournal.content}
                                onChange={e => setEditingJournal(j => j ? { ...j, content: e.target.value } : null)}
                            />
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
            </div>
        </section>
    )
}
export default JournalPage

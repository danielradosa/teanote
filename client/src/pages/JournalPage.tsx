'use client'

import { useRef, useState } from 'react'
import { useJournalsStore } from '../stores/useJournalsStore'
import type { Journal } from '../types/Journal'
import RichToolbar from '../components/RichToolbar'
import MdDisplay from '../components/MdDisplay'

function JournalPage() {
    const { journals, addJournal, deleteJournal, updateJournal } = useJournalsStore()
    const emptyForm: Omit<Journal, 'id' | 'dateAdded'> = { title: '', content: '' }
    const [form, setForm] = useState(emptyForm)
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null)
    const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)

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

    return (
        <section className="page-wrap journal-page">
            <header className="page-header">
                <h1>Journals</h1>
                <p className="subtitle">Your tea notes & reflections 🍵</p>
            </header>
            <div className="journal-content">
                {/* Journal List */}
                <section className="journal-table">
                    <h2>All journals</h2>
                    {journals.length > 0 ? (
                        <ul className="journal-list">
                            {journals.map(journal => (
                                <li key={journal.id} className="journal-item">
                                    <div className={`journal-details ${openDetailsId === journal.id ? 'details-open' : ''}`}>
                                        <span>
                                            <strong>{journal.title}</strong>{' '}
                                            <span className="journal-date">({new Date(journal.dateAdded).toLocaleDateString()})</span>
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
                                        <button className="btn btn-info" onClick={() => handleEdit(journal)}><i className="bxr bx-edit" /> edit</button>
                                        <button className="btn btn-danger" onClick={() => deleteJournal(journal.id)}><i className="bxr bx-trash" /> delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>no entries yet — add your first journal</p>
                    )}
                </section>

                {/* Add New Journal */}
                <section className="new-journal">
                    <h2>Add new journal</h2>
                    <div className="journal-form">
                        <input type="text" placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                        <RichToolbar value={form.content} setValue={v => setForm({ ...form, content: v })} textareaRef={textareaRef} />
                        <textarea ref={textareaRef} placeholder="Write your thoughts here…" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
                        <div className="journal-actions">
                            <button className="btn btn-quick" onClick={handleAddJournal}><i className="bxr bx-plus" /> add journal</button>
                        </div>
                    </div>
                </section>

                {/* Edit Panel */}
                {editingJournal && (
                    <section className="edit-panel">
                        <h2>Edit entry — {editingJournal.title}</h2>
                        <div className="journal-form">
                            <input type="text" placeholder="Title" value={editingJournal.title} onChange={e => setEditingJournal({ ...editingJournal, title: e.target.value })} />
                            <RichToolbar
                                value={editingJournal.content}
                                setValue={v => setEditingJournal(j => j ? { ...j, content: v } : null)}
                                textareaRef={editTextareaRef}
                            />
                            <textarea ref={editTextareaRef} placeholder="Write your thoughts here…" value={editingJournal.content} onChange={e => setEditingJournal({ ...editingJournal, content: e.target.value })} />
                            <div className="journal-actions">
                                <button className="btn btn-quick" onClick={handleUpdate}><i className="bxr bx-save" /> save</button>
                                <button className="btn btn-dark" onClick={() => setEditingJournal(null)}><i className="bxr bx-block" /> cancel</button>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </section>
    )
}
export default JournalPage

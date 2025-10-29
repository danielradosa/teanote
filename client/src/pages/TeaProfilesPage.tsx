'use client'

import { useRef, useState } from 'react'
import { useTeasStore } from '../stores/useTeasStore'
import type { Tea } from '../types/Tea'
import RichToolbar from '../components/RichToolbar'
import MdDisplay from '../components/MdDisplay'

function TeaProfilesPage() {
    const { teas, addTea, deleteTea, updateTea } = useTeasStore()

    const emptyForm: Omit<Tea, 'id' | 'dateAdded'> = {
        name: '',
        type: 'green',
        origin: '',
        year: '',
        vendor: '',
        notes: '',
        image: '',
        link: ''
    }

    const [form, setForm] = useState(emptyForm)
    const [editingTea, setEditingTea] = useState<Tea | null>(null)
    const [showMoreFields, setShowMoreFields] = useState(false)
    const [openDetailsId, setOpenDetailsId] = useState<string | null>(null)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const editTextareaRef = useRef<HTMLTextAreaElement>(null)

    const handleAddTea = () => {
        if (!form.name.trim()) return alert('A tea name is required')
        addTea(form)
        setForm(emptyForm)
        setShowMoreFields(false)
    }
    const handleEdit = (tea: Tea) => setEditingTea(tea)
    const handleUpdate = () => {
        if (!editingTea) return
        updateTea(editingTea.id, editingTea)
        setEditingTea(null)
    }
    const toggleDetails = (id: string) => {
        setOpenDetailsId(prev => (prev === id ? null : id))
    }

    return (
        <section className="page-wrap tea-page">
            <header className="page-header">
                <h1>Teas</h1>
                <p className="subtitle">All your tea profiles 🍵</p>
            </header>
            <div className="tea-content">
                {/* Tea List */}
                <section className="tea-table">
                    <h2>All teas</h2>
                    {teas.length > 0 ? (
                        <ul className="tea-list">
                            {teas.map((tea) => (
                                <li key={tea.id} className="tea-item">
                                    <div className={`tea-details ${openDetailsId === tea.id ? 'details-open' : ''}`}>
                                        <span>
                                            <strong>{tea.name}</strong> {tea.year} ({tea.type})
                                            {tea.origin && <span> — {tea.origin}</span>}
                                        </span>
                                        {openDetailsId === tea.id && (
                                            <div className="tea-extra">
                                                {tea.vendor && <p><strong>Vendor:</strong> {tea.vendor}</p>}
                                                {tea.link && (
                                                    <p>
                                                        <strong>Link:</strong>{' '}
                                                        <a href={tea.link} target="_blank" rel="noreferrer">
                                                            {tea.link}
                                                        </a>
                                                    </p>
                                                )}
                                                {tea.image && (
                                                    <div className="tea-image">
                                                        <img src={tea.image} alt={tea.name} />
                                                    </div>
                                                )}
                                                {tea.notes && <p><strong>Notes:</strong> <MdDisplay content={tea.notes} /></p>}
                                            </div>
                                        )}
                                        <button className="btn btn-dark btn-simple" onClick={() => toggleDetails(tea.id)}>
                                            <i className={`bxr ${openDetailsId === tea.id ? 'bx-list-minus' : 'bx-list-plus'}`} />{' '}
                                            {openDetailsId === tea.id ? 'hide details' : 'see details'}
                                        </button>
                                    </div>
                                    <div className="tea-actions">
                                        <button className="btn btn-info" onClick={() => handleEdit(tea)}><i className="bxr bx-edit" /> edit</button>
                                        <button className="btn btn-danger" onClick={() => deleteTea(tea.id)}><i className="bxr bx-trash" /> delete</button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>no teas yet — add your first one!</p>
                    )}
                </section>

                {/* Add New Tea */}
                <section className='new-tea'>
                    <h2>Add new tea</h2>
                    <div className="tea-form">
                        <input type="text" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Tea['type'] })}>
                            <option value="green">green</option>
                            <option value="oolong">oolong</option>
                            <option value="red">red</option>
                            <option value="white">white</option>
                            <option value="yellow">yellow</option>
                            <option value="puerh">puerh</option>
                            <option value="purple">purple</option>
                        </select>
                        <input type="text" placeholder="Year" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />

                        <RichToolbar value={form.notes || ''} setValue={v => setForm({ ...form, notes: v })} textareaRef={textareaRef} />
                        <textarea ref={textareaRef} placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />

                        {showMoreFields && (
                            <>
                                <input type="text" placeholder="Origin" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
                                <input type="text" placeholder="Vendor" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                                <input type="text" placeholder="Link" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} />
                                <input type="text" placeholder="Image URL" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} />
                            </>
                        )}
                        <div className="tea-actions">
                            <button className="btn btn-quick" onClick={handleAddTea}><i className="bxr bx-plus" /> add tea</button>
                            <button className="btn btn-info" onClick={() => setShowMoreFields(!showMoreFields)}>
                                <i className="bxr bx-list-square" />{showMoreFields ? 'hide details' : `add more details`}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Edit Panel */}
                {editingTea && (
                    <section className="edit-panel">
                        <h2>Edit tea — {editingTea.name}</h2>
                        <div className="tea-form">
                            <input type="text" placeholder="Name" value={editingTea.name} onChange={e => setEditingTea({ ...editingTea, name: e.target.value })} />
                            <select value={editingTea.type} onChange={e => setEditingTea({ ...editingTea, type: e.target.value as Tea['type'] })}>
                                <option value="green">green</option>
                                <option value="oolong">oolong</option>
                                <option value="red">red</option>
                                <option value="white">white</option>
                                <option value="yellow">yellow</option>
                                <option value="puerh">puerh</option>
                                <option value="purple">purple</option>
                            </select>
                            <input type="text" placeholder="Origin" value={editingTea.origin || ''} onChange={e => setEditingTea({ ...editingTea, origin: e.target.value })} />
                            <input type="text" placeholder="Year" value={editingTea.year || ''} onChange={e => setEditingTea({ ...editingTea, year: e.target.value })} />
                            <input type="text" placeholder="Vendor" value={editingTea.vendor || ''} onChange={e => setEditingTea({ ...editingTea, vendor: e.target.value })} />
                            <input type="text" placeholder="Link" value={editingTea.link || ''} onChange={e => setEditingTea({ ...editingTea, link: e.target.value })} />
                            <input type="text" placeholder="Image URL" value={editingTea.image || ''} onChange={e => setEditingTea({ ...editingTea, image: e.target.value })} />

                            <RichToolbar
                                value={editingTea.notes || ''}
                                setValue={v => setEditingTea(t => t ? { ...t, notes: v } : null)}
                                textareaRef={editTextareaRef}
                            />
                            <textarea ref={editTextareaRef} placeholder="Notes" value={editingTea.notes || ''} onChange={e => setEditingTea({ ...editingTea, notes: e.target.value })} />
                            <div className="tea-actions">
                                <button className="btn btn-quick" onClick={handleUpdate}><i className="bxr bx-save" />save</button>
                                <button className="btn btn-dark" onClick={() => setEditingTea(null)}><i className="bxr bx-block" />cancel</button>
                            </div>
                        </div>
                    </section>
                )}
            </div>
        </section>
    )
}
export default TeaProfilesPage

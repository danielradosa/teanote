'use client'

import { useRef, useState, useEffect } from 'react'
import { useTeasStore } from '../stores/useTeasStore'
import type { Tea } from '../types/Tea'
import RichToolbar from '../components/RichToolbar'
import MdDisplay from '../components/MdDisplay'
import SearchBar from '../components/SearchBar'
import InfiniteScroll from 'react-infinite-scroll-component'

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
    const [typeFilter, setTypeFilter] = useState<string>('')
    const [yearFilter, setYearFilter] = useState<string>('')
    const [search, setSearch] = useState('')

    const batchSize = 6;
    const [teaItemsToShow, setTeaItemsToShow] = useState(batchSize)

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

    const filteredTeas = teas.filter(tea =>
        (!typeFilter || tea.type === typeFilter) &&
        (!yearFilter || tea.year === yearFilter) &&
        (
            !search ||
            tea.name.toLowerCase().includes(search.toLowerCase()) ||
            tea.type.toLowerCase().includes(search.toLowerCase())
        )
    );
    const orderedTeas = [...filteredTeas].reverse()

    useEffect(() => {
        const ensureScrollable = () => {
            const ul = document.querySelector('.tea-list')
            if (!ul) return;
            const rect = ul.getBoundingClientRect();
            if (rect.bottom < window.innerHeight && teaItemsToShow < orderedTeas.length) {
                setTeaItemsToShow(prev => Math.min(prev + 1, orderedTeas.length));
                requestAnimationFrame(ensureScrollable);
            }
        };
        requestAnimationFrame(ensureScrollable);
        // eslint-disable-next-line
    }, [teas, typeFilter, yearFilter]);

    const fetchMoreTeas = () => setTeaItemsToShow(prev => prev + 6);

    return (
        <section className="page-wrap tea-page">
            <header className="page-header">
                <h1>Teas</h1>
                <p className="subtitle">All your tea profiles 🍵</p>
            </header>
            <div className="tea-content">
                <section className="tea-filters" style={{ flex: '1 1 100%' }}>
                    <h2>Filter teas</h2>
                    <div className='filter-wrap'>
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
                        <label className="filter-label">
                            Year:&nbsp;
                            <div className="select-wrap">
                                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                                    <option value="">all years</option>
                                    {[...new Set(teas.map(t => t.year).filter(year => year && year.trim() !== ''))].map(year =>
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
                <section className="tea-table">
                    <h2>All teas</h2>
                    {filteredTeas.length > 0 ? (
                        <InfiniteScroll
                            dataLength={Math.min(teaItemsToShow, orderedTeas.length)}
                            next={fetchMoreTeas}
                            hasMore={teaItemsToShow < orderedTeas.length}
                            loader={<div>loading more...</div>}
                            endMessage={<div>no more teas</div>}
                        >
                            <ul className="tea-list">
                                {orderedTeas.slice(0, teaItemsToShow).map((tea) => (
                                    <li key={tea.id} className="tea-item">
                                        <div className={`tea-details ${openDetailsId === tea.id ? 'details-open' : ''}`}>
                                            <span>
                                                <strong>{tea.name}</strong> {tea.year}
                                                {tea.origin && <span> — {tea.origin}</span>}
                                                <span
                                                    className={`tea-tag tea-tag-${tea.type}`}
                                                    style={{
                                                        marginLeft: 8,
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
                                            <button className="btn btn-info" onClick={() => handleEdit(tea)}><i className="bxr bx-edit" /></button>
                                            <button className="btn btn-danger" onClick={() => deleteTea(tea.id)}><i className="bxr bx-trash" /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </InfiniteScroll>
                    ) : (
                        <p style={{ marginTop: 8 }}>no teas yet — add your first one</p>
                    )}
                </section>

                {/* Edit Panel */}
                {editingTea && (
                    <section className="edit-panel">
                        <h2>Edit tea — {editingTea.name}</h2>
                        <div className="tea-form">
                            <label>
                                <span className="basic-label"><span className="req">* </span>Tea name:</span>
                                <input type="text" placeholder="Name" value={editingTea.name} onChange={e => setEditingTea({ ...editingTea, name: e.target.value })} />
                            </label>
                            <label style={{ display: 'block', width: '100%' }}>
                                <span className="basic-label"><span className="req">* </span>Tea type:</span>
                                <div className="select-wrap">
                                    <select style={{ width: '100%' }} value={editingTea.type}
                                        onChange={e => setEditingTea({ ...editingTea, type: e.target.value as Tea['type'] })}
                                    >
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
                            <label>
                                <span className="basic-label">Origin (optional):</span>
                                <input type="text" placeholder="e.g. Xishuangbanna" value={editingTea.origin || ''} onChange={e => setEditingTea({ ...editingTea, origin: e.target.value })} />
                            </label>
                            <label>
                                <span className="basic-label">Year (optional):</span>
                                <input type="text" placeholder="e.g. 2004" value={editingTea.year || ''} onChange={e => setEditingTea({ ...editingTea, year: e.target.value })} />
                            </label>
                            <label>
                                <span className="basic-label">Vendor (optional):</span>
                                <input type="text" placeholder="e.g. YunnanSourcing" value={editingTea.vendor || ''} onChange={e => setEditingTea({ ...editingTea, vendor: e.target.value })} />
                            </label>
                            <label>
                                <span className="basic-label">Link (optional):</span>
                                <input type="text" placeholder="e.g. https://someshop.tea/product1" value={editingTea.link || ''} onChange={e => setEditingTea({ ...editingTea, link: e.target.value })} />
                            </label>
                            <label>
                                <span className="basic-label">Image URL (optional):</span>
                                <input type="text" placeholder="e.g. https://mytea.com/photo.png" value={editingTea.image || ''} onChange={e => setEditingTea({ ...editingTea, image: e.target.value })} />
                            </label>

                            <RichToolbar
                                value={editingTea.notes || ''}
                                setValue={v => setEditingTea(t => t ? { ...t, notes: v } : null)}
                                textareaRef={editTextareaRef}
                            />
                            <label>
                                <span className="basic-label">Notes (optional):</span>
                                <textarea ref={editTextareaRef} placeholder="e.g. This one is real tasty." value={editingTea.notes || ''} onChange={e => setEditingTea({ ...editingTea, notes: e.target.value })} />
                            </label>
                            <div className="tea-actions">
                                <button className="btn btn-quick" onClick={handleUpdate}><i className="bxr bx-save" />save</button>
                                <button className="btn btn-dark" onClick={() => setEditingTea(null)}><i className="bxr bx-block" />cancel</button>
                            </div>
                        </div>
                    </section>
                )}

                {/* Add New Tea */}
                <section className='new-tea'>
                    <h2>Add new tea</h2>
                    <div className="tea-form">
                        <label>
                            <span className="basic-label"><span className="req">* </span>Tea name:</span>
                            <input type="text" placeholder="e.g. Bai Mu Dan" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </label>
                        <label>
                            <span className="basic-label"><span className="req">* </span>Tea type:</span>
                            <div className='select-wrap'>
                                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Tea['type'] })}>
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
                        <label>
                            <span className="basic-label">Year (optional):</span>
                            <input type="text" placeholder="e.g. 2012" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
                        </label>

                        <RichToolbar value={form.notes || ''} setValue={v => setForm({ ...form, notes: v })} textareaRef={textareaRef} />
                        <label>
                            <span className="basic-label">Notes (optional):</span>
                            <textarea ref={textareaRef} placeholder="e.g. This one is real good." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                        </label>
                        {showMoreFields && (
                            <>
                                <label>
                                    <span className="basic-label">Origin (optional):</span>
                                    <input type="text" placeholder="Xishuangbanna" value={form.origin} onChange={e => setForm({ ...form, origin: e.target.value })} />
                                </label>
                                <label>
                                    <span className="basic-label">Vendor (optional):</span>
                                    <input type="text" placeholder="Yunnan Sourcing" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                                </label>
                                <label>
                                    <span className="basic-label">Link (optional):</span>
                                    <input type="text" placeholder="e.g. https://someshop.tea/product1" value={form.link} onChange={e => setForm({ ...form, link: e.target.value })} />
                                </label>
                                <label>
                                    <span className="basic-label">Image URL (optional):</span>
                                    <input type="text" placeholder="e.g. https://mytea.com/photo.png" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} />
                                </label>
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
            </div>
        </section>
    )
}

export default TeaProfilesPage
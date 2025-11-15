/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import { useState, useRef, useEffect } from 'react'
import RichToolbar from '../RichToolbar'

export default function TeaForm({ tea, onChange, onSubmit, isEditing = false, onCancel }: any) {
    const emptyForm = {
        name: '',
        type: 'green',
        inventory: '',
        origin: '',
        year: '',
        vendor: '',
        notes: '',
        image: '',
        link: ''
    }

    const [form, setForm] = useState(tea || emptyForm)
    const [showMoreFields, setShowMoreFields] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => { if (tea) setForm(tea) }, [tea])

    const handleChange = (updatedForm: any) => {
        if (isEditing) {
            onChange(updatedForm)
        } else {
            setForm(updatedForm)
        }
    }

    const handleSubmit = () => {
        if (!form.name.trim()) return alert('A tea name is required')
        onSubmit(form)
        if (!isEditing) {
            setForm(emptyForm)
            setShowMoreFields(false)
        }
    }

    return (
        <section className={isEditing ? 'edit-panel' : 'new-tea'}>
            <h2>{isEditing ? `Edit tea — ${form.name}` : 'Add new tea'}</h2>
            <div className="tea-form">
                <label>
                    <span className="basic-label"><span className="req">*</span> Tea name:</span>
                    <input
                        type="text"
                        placeholder={isEditing ? 'e.g. Sencha' : 'e.g. Bai Mu Dan'}
                        value={form.name}
                        onChange={e => handleChange({ ...form, name: e.target.value })}
                    />
                </label>
                <label>
                    <span className="basic-label"><span className="req">*</span> Tea type:</span>
                    <div className='select-wrap'>
                        <select
                            value={form.type}
                            onChange={e => handleChange({ ...form, type: e.target.value })}
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
                    <span className="basic-label">Inventory (optional):</span>
                    <input
                        type="text"
                        placeholder="e.g. 50g"
                        value={form.inventory}
                        onChange={e => handleChange({ ...form, inventory: e.target.value })}
                    />
                </label>
                <label>
                    <span className="basic-label">Year (optional):</span>
                    <input
                        type="text"
                        placeholder={isEditing ? 'e.g. 2004' : 'e.g. 2012'}
                        value={form.year}
                        onChange={e => handleChange({ ...form, year: e.target.value })}
                    />
                </label>

                {(isEditing || showMoreFields) && (
                    <>
                        <label>
                            <span className="basic-label">Origin (optional):</span>
                            <input
                                type="text"
                                placeholder="e.g. Xishuangbanna"
                                value={form.origin}
                                onChange={e => handleChange({ ...form, origin: e.target.value })}
                            />
                        </label>
                        <label>
                            <span className="basic-label">Vendor (optional):</span>
                            <input
                                type="text"
                                placeholder="e.g. YunnanSourcing"
                                value={form.vendor}
                                onChange={e => handleChange({ ...form, vendor: e.target.value })}
                            />
                        </label>
                        <label>
                            <span className="basic-label">Link (optional):</span>
                            <input
                                type="text"
                                placeholder="e.g. https://someshop.tea/product1"
                                value={form.link}
                                onChange={e => handleChange({ ...form, link: e.target.value })}
                            />
                        </label>
                        <label>
                            <span className="basic-label">Image URL (optional):</span>
                            <input
                                type="text"
                                placeholder="e.g. https://mytea.com/photo.png"
                                value={form.image}
                                onChange={e => handleChange({ ...form, image: e.target.value })}
                            />
                        </label>
                    </>
                )}

                <RichToolbar
                    value={form.notes || ''}
                    setValue={v => handleChange({ ...form, notes: v })}
                    textareaRef={textareaRef}
                />
                <label>
                    <span className="basic-label">Notes (optional):</span>
                    <textarea
                        ref={textareaRef}
                        placeholder={isEditing ? 'e.g. This one is real tasty.' : 'e.g. This one is real good.'}
                        value={form.notes || ''}
                        onChange={e => handleChange({ ...form, notes: e.target.value })}
                    />
                </label>

                <div className="tea-actions">
                    <button className="btn btn-quick" onClick={handleSubmit}>
                        <i className="bxr bx-save" /> {isEditing ? 'save' : 'add tea'}
                    </button>
                    {isEditing && (
                        <button className="btn btn-dark" onClick={onCancel}>
                            <i className="bxr bx-block" /> cancel
                        </button>
                    )}
                    {!isEditing && (
                        <button className="btn btn-info" onClick={() => setShowMoreFields(!showMoreFields)}>
                            {showMoreFields ? 'hide details' : 'add more details'}
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
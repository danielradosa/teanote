/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import { useState, useRef, useEffect } from 'react'
import RichToolbar from '../RichToolbar'
import { uploadImage, deleteImage } from '../../helpers/upload'
import { useAuthStore } from '../../stores/useAuthStore'
import { useTeasStore } from '../../stores/useTeasStore'
import Loader from '../Loader'
import { t } from 'i18next'

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
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState('')
    const [imagePath, setImagePath] = useState<string | null>(null)
    const [pendingImageDeletion, setPendingImageDeletion] = useState(false)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { user } = useAuthStore()
    const { updateTea } = useTeasStore()

    useEffect(() => {
        if (tea) {
            setForm(tea)
            if (tea.image) setPreview(tea.image)
        }
    }, [tea])

    const handleImageUpload = async (file: File) => {
        try {
            if (!user) throw new Error('No user logged in')

            setUploading(true)
            setPreview(URL.createObjectURL(file))

            const res = await uploadImage('teas', file, user.id)
            setImagePath(res.path)

            handleChange({
                ...form,
                image: res.signedUrl,
                image_path: res.path
            })
            setPreview(res.signedUrl)
            setPendingImageDeletion(false)
        } catch (err) {
            console.error(err)
            alert('Image upload failed')
        } finally {
            setUploading(false)
        }
    }

    const handleImageDelete = () => {
        setForm({ ...form, image: '', image_path: undefined })
        setPreview('')
        onChange?.({ ...form, image: '', image_path: undefined })
        setPendingImageDeletion(true)
    }

    const handleChange = (updatedForm: any) => {
        if (isEditing) {
            onChange(updatedForm)
        } else {
            setForm(updatedForm)
        }
    }

    const handleSubmit = async () => {
        if (!form.name.trim()) return alert('A tea name is required')

        if (isEditing && form.id && pendingImageDeletion && imagePath) {
            try {
                await deleteImage('teas', imagePath)
                updateTea(form.id, { image: '', image_path: undefined })
                setImagePath(null)
                setPendingImageDeletion(false)
            } catch (err) {
                console.error('Failed to delete old image:', err)
            }
        }

        onSubmit(form)

        if (!isEditing) {
            setForm(emptyForm)
            setPreview('')
            setShowMoreFields(false)
            setImagePath(null)
            setPendingImageDeletion(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <section className={isEditing ? 'edit-panel' : 'new-tea'}>
            <h2>
                {isEditing
                    ? `${t('teas_edit_tea')} — ${form.name}`
                    : `${t('teas_add_new')}`}
            </h2>

            <div className="tea-form">

                <label>
                    <span className="basic-label">
                        <span className="req">*</span> {t('teas_form_name_label')}:
                    </span>
                    <input
                        type="text"
                        placeholder={t('teas_form_name_p')}
                        value={form.name}
                        onChange={e => handleChange({ ...form, name: e.target.value })}
                    />
                </label>

                <label>
                    <span className="basic-label">
                        <span className="req">*</span> {t('teas_form_type_label')}:
                    </span>
                    <div className='select-wrap'>
                        <select
                            value={form.type}
                            onChange={e => handleChange({ ...form, type: e.target.value })}
                        >
                            <option value="green">{t('teas_select_type_green')}</option>
                            <option value="oolong">{t('teas_select_type_oolong')}</option>
                            <option value="red">{t('teas_select_type_red')}</option>
                            <option value="white">{t('teas_select_type_white')}</option>
                            <option value="yellow">{t('teas_select_type_yellow')}</option>
                            <option value="puerh">{t('teas_select_type_puerh')}</option>
                            <option value="purple">{t('teas_select_type_purple')}</option>
                        </select>
                        <span className="arr-down"></span>
                    </div>
                </label>

                <label>
                    <span className="basic-label">{t('teas_form_inventory_label')}:</span>
                    <input
                        type="text"
                        placeholder={t('teas_form_inventory_p')}
                        value={form.inventory}
                        onChange={e => handleChange({ ...form, inventory: e.target.value })}
                    />
                </label>

                <label>
                    <span className="basic-label">{t('teas_form_year_label')}:</span>
                    <input
                        type="text"
                        placeholder={t('teas_form_year_p')}
                        value={form.year}
                        onChange={e => handleChange({ ...form, year: e.target.value })}
                    />
                </label>

                {(isEditing || showMoreFields) && (
                    <>
                        <label>
                            <span className="basic-label">{t('teas_form_origin_label')}:</span>
                            <input
                                type="text"
                                placeholder={t('teas_form_origin_p')}
                                value={form.origin}
                                onChange={e => handleChange({ ...form, origin: e.target.value })}
                            />
                        </label>

                        <label>
                            <span className="basic-label">{t('teas_form_vendor_label')}:</span>
                            <input
                                type="text"
                                placeholder={t('teas_form_vendor_p')}
                                value={form.vendor}
                                onChange={e => handleChange({ ...form, vendor: e.target.value })}
                            />
                        </label>

                        <label>
                            <span className="basic-label">{t('teas_form_img_label')}:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input
                                    type="text"
                                    placeholder={t('teas_form_img_p')}
                                    value={form.image}
                                    onChange={e => handleChange({ ...form, image: e.target.value })}
                                />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    hidden
                                    onChange={e => {
                                        const file = e.target.files?.[0]
                                        if (file) handleImageUpload(file)
                                    }}
                                />
                                {t('or')}
                                <button
                                    type="button"
                                    className="btn btn-quick"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading
                                        ? <Loader />
                                        : <><i className="bxr bx-archive-arrow-up" /> {t('upload')}</>}
                                </button>

                                {form.image && (
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        onClick={handleImageDelete}
                                    >
                                        <i className="bxr bx-trash" /> {t('delete')}
                                    </button>
                                )}
                            </div>

                            {preview && (
                                <div style={{ marginTop: 8 }}>
                                    <img
                                        src={preview}
                                        alt="Tea Preview"
                                        style={{ maxWidth: 210, borderRadius: 8 }}
                                    />
                                </div>
                            )}
                        </label>
                    </>
                )}

                <RichToolbar
                    value={form.notes || ''}
                    setValue={v => handleChange({ ...form, notes: v })}
                    textareaRef={textareaRef}
                />

                <label>
                    <span className="basic-label">{t('teas_form_notes_label')}:</span>
                    <textarea
                        ref={textareaRef}
                        placeholder={t('teas_form_notes_p')}
                        value={form.notes || ''}
                        onChange={e => handleChange({ ...form, notes: e.target.value })}
                    />
                </label>

                <div className="tea-actions">
                    <button className="btn btn-quick" onClick={handleSubmit}>
                        <i className={`bxr ${isEditing ? 'bx-save' : 'bx-plus'}`} />
                        {isEditing ? `${t('teas_save_tea_btn')}` : `${t('teas_add_tea_btn')}`}
                    </button>

                    {isEditing && (
                        <button className="btn btn-dark" onClick={onCancel}>
                            <i className="bxr bx-block" /> {t('teas_cancel_tea_btn')}
                        </button>
                    )}

                    {!isEditing && (
                        <button
                            className="btn btn-info"
                            onClick={() => setShowMoreFields(!showMoreFields)}
                        >
                            <i className={`bxr ${showMoreFields ? 'bx-bookmark-x' : 'bx-bookmark-plus'}`} />
                            {showMoreFields
                                ? `${t('teas_less_details_btn')}`
                                : `${t('teas_add_details_btn')}`}
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
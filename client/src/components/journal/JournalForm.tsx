/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import RichToolbar from '../RichToolbar'
import { useAuthStore } from '../../stores/useAuthStore'
import Loader from '../Loader'
import { uploadImage, deleteImage } from '../../helpers/upload'
import { t } from 'i18next'

export default function JournalForm({
    journal,
    onChange,
    onSubmit,
    onCancel,
    teas = [],
    brews = [],
    presets = [],
    isEditing = false
}: any) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [pendingFiles, setPendingFiles] = useState<File[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { user } = useAuthStore()
    const [uploading, setUploading] = useState(false)

    const emptyForm = useMemo(() => ({
        title: '',
        teaId: '',
        content: '',
        rating: undefined,
        brew_preset_id: '',
        images: [] as string[]
    }), [])

    const [local, setLocal] = useState({
        ...emptyForm,
        ...journal,
        images: journal?.images ?? []
    })

    // Sync when parent changes journal
    useEffect(() => {
        setLocal({ ...emptyForm, ...journal, images: journal?.images ?? [] })
    }, [journal, emptyForm])

    const handleChange = (updates: any) => {
        const updated = { ...local, ...updates }
        setLocal(updated)
        if (isEditing && onChange) onChange(updated)
    }

    const handleSubmit = async () => {
        if (!local.title?.trim() || !local.content?.trim()) {
            alert('Title and content required')
            return
        }

        let images = local.images

        if (!isEditing && pendingFiles.length && user) {
            setUploading(true)
            try {
                const uploaded: string[] = []

                for (const file of pendingFiles) {
                    const res = await uploadSessionImage(file, user.id)
                    uploaded.push(res.signedUrl)
                }

                images = uploaded
            } finally {
                setUploading(false)
            }
        }

        onSubmit({
            ...local,
            images
        })

        if (!isEditing) {
            setLocal(emptyForm)
            setPendingFiles([])
        }
    }

    // IMAGE HELPERS
    const handleFilesUpload = async (files: FileList) => {
        if (!user) return alert('Not logged in')

        const currentCount = local.images.length
        const remaining = 3 - currentCount
        if (remaining <= 0) return

        const selected = Array.from(files).slice(0, remaining)

        if (!isEditing) {
            const previews = selected.map(file => URL.createObjectURL(file))

            setPendingFiles(prev => [...prev, ...selected])
            setLocal((prev: { images: any }) => ({
                ...prev,
                images: [...prev.images, ...previews]
            }))

            return
        }

        setUploading(true)
        try {
            const uploadedUrls: string[] = []

            for (const file of selected) {
                const res = await uploadSessionImage(file, user.id)
                uploadedUrls.push(res.signedUrl)
            }

            handleChange({
                images: [...local.images, ...uploadedUrls]
            })
        } catch (err) {
            console.error(err)
            alert('Image upload failed')
        } finally {
            setUploading(false)
        }
    }

    return (
        <section className={isEditing ? 'edit-panel' : 'new-journal'}>
            <h2>
                {isEditing
                    ? `${t('journals_edit')} — ${local.title}`
                    : t('journal_add_new')}
            </h2>

            <div className="journal-form">
                <label>
                    <span className="basic-label">
                        <span className="req">* </span>{t('journal_form_name_label')}:
                    </span>
                    <input
                        type="text"
                        placeholder={t('journal_form_name_p')}
                        value={local.title}
                        onChange={e => handleChange({ title: e.target.value })}
                    />
                </label>

                <label>
                    <span className="basic-label">{t('journal_form_brew_label')}:</span>
                    <div className="select-wrap">
                        <select
                            value={local.brew_preset_id || ''}
                            onChange={e => handleChange({ brew_preset_id: e.target.value })}
                        >
                            <option value="">-</option>
                            {brews.map((b: any) => {
                                const tea = teas.find((t: any) => t.id === b.teaId)
                                const preset = presets.find((p: any) => p.id === b.presetId)
                                const teaName = tea?.name || 'Unknown Tea'
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
                    <span className="basic-label">{t('journal_form_tea_label')}:</span>
                    <div className="select-wrap">
                        <select
                            value={local.teaId}
                            onChange={e => handleChange({ teaId: e.target.value })}
                        >
                            <option value="">-</option>
                            {teas.map((tea: any) => (
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
                        min={1}
                        max={5}
                        value={local.rating ?? ''}
                        onChange={e => handleChange({ rating: e.target.value === '' ? undefined : Number(e.target.value) })}
                    />
                </label>

                <label>
                    <span className="basic-label">{t('journal_img_upload')} max. 3:</span>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        {(local.images ?? []).map((img: string, idx: number) => (
                            <div key={img} style={{ position: 'relative' }}>
                                <img
                                    src={img}
                                    alt={`Journal img ${idx}`}
                                    style={{ maxHeight: 120, borderRadius: 8 }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-danger"
                                    onClick={async e => {
                                        e.stopPropagation()
                                        try {
                                            await deleteSessionImage(local.images[idx], user.id)
                                            const newImages = local.images.filter((_: any, i: number) => i !== idx)
                                            setLocal((prev: any) => ({ ...prev, images: newImages }))
                                            if (isEditing && onChange) onChange({ ...local, images: newImages })
                                        } catch (err) {
                                            console.error(err)
                                            alert('Failed to delete image')
                                        }
                                    }}
                                >
                                    <i className="bx bx-trash" />
                                </button>
                            </div>
                        ))}

                        {(local.images ?? []).length < 3 && (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    hidden
                                    multiple
                                    onChange={e => {
                                        const files = e.target.files
                                        if (!files || !user) return
                                        handleFilesUpload(files)
                                        e.target.value = ''
                                    }}
                                />
                                <button
                                    type="button"
                                    className="btn btn-quick"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {uploading
                                        ? <Loader />
                                        : <><i className="bxr bx-archive-arrow-up" /> {t('upload')}</>
                                    }
                                </button>
                            </>
                        )}
                    </div>
                </label>

                <RichToolbar
                    value={local.content}
                    setValue={v => handleChange({ content: v })}
                    textareaRef={textareaRef}
                />
                <label>
                    <span className="basic-label">
                        <span className="req">* </span>{t('journal_form_notes_label')}:
                    </span>
                    <textarea
                        ref={textareaRef}
                        placeholder={t('journal_form_notes_p')}
                        value={local.content}
                        onChange={e => handleChange({ content: e.target.value })}
                    />
                </label>

                <div className="journal-actions">
                    <button className="btn btn-quick" onClick={handleSubmit}>
                        <i className={`bxr ${isEditing ? 'bx-save' : 'bx-plus'}`} />
                        {isEditing ? t('journal_save_btn') : t('journal_add_btn')}
                    </button>

                    {isEditing && (
                        <button className="btn btn-dark" onClick={onCancel}>
                            <i className="bxr bx-block" /> {t('journal_cancel_btn')}
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
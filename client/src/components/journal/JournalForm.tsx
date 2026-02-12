/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import RichToolbar from '../RichToolbar'
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
        ...journal
    })

    useEffect(() => {
        setLocal({ ...emptyForm, ...journal})
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

        onSubmit({
            ...local
        })

        if (!isEditing) {
            setLocal(emptyForm)
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
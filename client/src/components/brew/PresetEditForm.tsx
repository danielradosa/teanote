import { useEffect, useRef, useState } from 'react'
import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface PresetEditFormProps {
    preset: Preset
    teas: Tea[]
    onSubmit: (id: string, updates: Partial<Preset>) => void
    onCancel: () => void
}

export default function PresetEditForm({ preset, teas, onSubmit, onCancel }: PresetEditFormProps) {
    const [editName, setEditName] = useState(preset.name)
    const [editTeaId, setEditTeaId] = useState(preset.teaId || '')
    const [editTeaType, setEditTeaType] = useState(preset.teaType || '')
    const [editInfusionsAmount, setEditInfusionsAmount] = useState<number>(preset.infusionsAmount)
    const [editInfusionTimes, setEditInfusionTimes] = useState(preset.infusionTimes.join(','))

    const firstOpenRef = useRef(false)

    useEffect(() => {
        if (window.innerWidth < 860 && !firstOpenRef.current) {
            firstOpenRef.current = true
            const el = document.querySelector('.edit-panel') as HTMLElement | null
            if (el) {
                const y = el.getBoundingClientRect().top + window.scrollY - 150
                window.scrollTo({ top: y, behavior: 'smooth' })
            }
        }
    }, [])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!editName.trim()) return alert('Name required')
        if (!editInfusionsAmount || editInfusionsAmount < 1)
            return alert('Infusions amount must be ≥ 1')
        if (!editInfusionTimes.trim()) return alert('Set infusion times')

        const timesArr = editInfusionTimes
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n))

        if (timesArr.length !== editInfusionsAmount)
            return alert('Number of times must match infusion amount')

        let teaType = editTeaType
        if (editTeaId) {
            const teaObj = teas.find(t => t.id === editTeaId)
            teaType = teaObj?.type || ''
        }

        onSubmit(preset.id, {
            name: editName.trim(),
            teaId: editTeaId || undefined,
            teaType: teaType || undefined,
            infusionsAmount: editInfusionsAmount,
            infusionTimes: timesArr,
        })
    }

    return (
        <section className='edit-preset-container edit-panel'>
            <div className='edit-preset'>
                <h2>{t('preset_edit_title')} &mdash; {editName || 'preset'}</h2>
                <form
                    className="edit-preset-form"
                    style={{ marginTop: 10, display: 'grid', gap: 10 }}
                    onSubmit={handleSubmit}
                >
                    <label>
                        <span className='basic-label'><span className="req">* </span>{t('preset_edit_title_label')}:</span>
                        <input
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            required
                            placeholder={t('preset_edit_title_p')}
                            style={{ width: '100%' }}
                        />
                    </label>
                    <label>
                        <span className="basic-label">{t('preset_edit_select_tea')}:</span>
                        <div className="select-wrap">
                            <select
                                value={editTeaId}
                                onChange={e => setEditTeaId(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                <option value="">-</option>
                                {teas.map(tea => (
                                    <option key={tea.id} value={tea.id}>{tea.name}</option>
                                ))}
                            </select>
                            <span className="arr-down"></span>
                        </div>
                    </label>
                    {(!editTeaId || !teas.find(t => t.id === editTeaId)) && (
                        <label>
                            <span className='basic-label'><span className="req">* </span>{t('preset_edit_tea_type_label')}:</span>
                            <div className="select-wrap">
                                <select
                                    value={editTeaType}
                                    onChange={e => setEditTeaType(e.target.value)}
                                    required={!editTeaId}
                                    style={{ width: '100%' }}
                                >
                                    <option value="any">{t('tea_tag_any')}</option>
                                    <option value="green">{t('tea_tag_green')}</option>
                                    <option value="oolong">{t('tea_tag_oolong')}</option>
                                    <option value="red">{t('tea_tag_red')}</option>
                                    <option value="white">{t('tea_tag_white')}</option>
                                    <option value="yellow">{t('tea_tag_yellow')}</option>
                                    <option value="puerh">{t('tea_tag_puerh')}</option>
                                    <option value="purple">{t('tea_tag_purple')}</option>
                                </select>
                                <span className="arr-down"></span>
                            </div>
                        </label>
                    )}
                    <label>
                        <span className="basic-label"><span className="req">* </span>{t('preset_edit_ainfusions_label')}:</span>
                        <input
                            type="number"
                            min={1}
                            value={editInfusionsAmount}
                            onChange={e => setEditInfusionsAmount(Number(e.target.value))}
                            required
                            style={{ width: '100%' }}
                        />
                    </label>
                    <label>
                        <span className="basic-label"><span className="req">* </span>{t('preset_edit_tinfusions_label')}:</span>
                        <input
                            value={editInfusionTimes}
                            onChange={e => setEditInfusionTimes(e.target.value)}
                            required
                            placeholder={t('preset_edit_tinfusions_p')}
                            style={{ width: '100%' }}
                        />
                    </label>
                    <div style={{ display: 'flex', gap: 8 }} className='brew-actions'>
                        <button className="btn btn-quick" type="submit">
                            <i className="bxr bx-save" /> {t('preset_save_btn')}
                        </button>
                        <button className="btn btn-dark" type="button" onClick={onCancel}>
                            <i className="bxr bx-block" /> {t('preset_cancel_btn')}
                        </button>
                    </div>
                </form>
            </div>
        </section>
    )
}

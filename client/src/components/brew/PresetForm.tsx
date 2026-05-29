import { useState } from 'react'
import toast from 'react-hot-toast'
import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { suggestPreset } from '@/helpers/ai'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { t } from 'i18next'

type NewPresetInput = Omit<Preset, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'deleted_at'>

interface PresetFormProps {
    teas: Tea[]
    onSubmit: (preset: NewPresetInput) => void
}

export default function PresetForm({ teas, onSubmit }: PresetFormProps) {
    const [presetName, setPresetName] = useState('')
    const [presetTeaId, setPresetTeaId] = useState('')
    const [presetTeaType, setPresetTeaType] = useState('')
    const [presetInfusionsAmount, setPresetInfusionsAmount] = useState<number>(1)
    const [presetInfusionTimes, setPresetInfusionTimes] = useState('')
    const [aiLoading, setAiLoading] = useState(false)

    const aiEnabled = useSettingsStore(s => s.settings?.ai_enabled ?? false)

    const handleAiSuggest = async () => {
        const linkedTea = presetTeaId ? teas.find(t => t.id === presetTeaId) : undefined
        const teaName = linkedTea?.name ?? ''
        const teaType = linkedTea?.type ?? presetTeaType

        if (!teaName && !teaType) {
            toast(t('ai_suggest_btn'))
            return
        }

        setAiLoading(true)
        try {
            const suggestion = await suggestPreset({
                teaName,
                teaType,
                origin: linkedTea?.origin,
                year: linkedTea?.year,
            })
            setPresetInfusionsAmount(suggestion.infusionsAmount)
            setPresetInfusionTimes(suggestion.infusionTimes.join(', '))
            if (suggestion.rationale) toast.success(suggestion.rationale)
        } catch (err) {
            console.error('AI suggest failed:', err)
            toast.error(t('ai_suggest_error'))
        } finally {
            setAiLoading(false)
        }
    }

    const handleAddPreset = (e: React.FormEvent) => {
        e.preventDefault()
        if (!presetName.trim()) return alert('Name required')
        if (!presetInfusionsAmount || presetInfusionsAmount < 1)
            return alert('Infusions amount must be ≥ 1')
        if (!presetInfusionTimes.trim()) return alert('Set infusion times')

        const timesArr = presetInfusionTimes
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n))

        if (timesArr.length !== presetInfusionsAmount)
            return alert('Number of times must match infusion amount')

        let teaType = presetTeaType
        const teaId = presetTeaId

        if (presetTeaId) {
            const teaObj = teas.find(t => t.id === presetTeaId)
            teaType = teaObj?.type || ''
        }

        onSubmit({
            name: presetName.trim(),
            teaId: teaId || undefined,
            teaType: teaType || undefined,
            infusionsAmount: presetInfusionsAmount,
            infusionTimes: timesArr,
        })

        setPresetName('')
        setPresetTeaId('')
        setPresetTeaType('')
        setPresetInfusionsAmount(1)
        setPresetInfusionTimes('')
    }

    return (
        <div>
            <h2>{t('brews_form_new_preset')}</h2>
            <div className="brew-main-actions">
                <label>
                    <span className="basic-label"><span className="req">* </span>{t('brews_form_pname_label')}:</span>
                    <input
                        value={presetName}
                        onChange={e => setPresetName(e.target.value)}
                        required
                        placeholder={t('brews_form_pname_p')}
                        style={{ width: '100%' }}
                    />
                </label>
                <label>
                    <span className="basic-label">{t('brews_form_tname_label')}:</span>
                    <div className="select-wrap">
                        <select
                            value={presetTeaId}
                            onChange={e => setPresetTeaId(e.target.value)}
                            style={{ width: '100%' }}
                            required
                        >
                            <option value="">-</option>
                            {teas.map(tea => (
                                <option key={tea.id} value={tea.id}>{tea.name}</option>
                            ))}
                        </select>
                        <span className="arr-down"></span>
                    </div>
                </label>
                {(!presetTeaId || !teas.find(t => t.id === presetTeaId)) && (
                    <label>
                        <span className="basic-label"><span className='req'>* </span>{t('brews_form_ttype_label')}:</span>
                        <div className="select-wrap">
                            <select
                                value={presetTeaType}
                                onChange={e => setPresetTeaType(e.target.value)}
                                required={!presetTeaId}
                                style={{ width: '100%' }}
                            >
                                <option value="any">{t('brews_form_ttype_any')}</option>
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
                    <span className="basic-label"><span className='req'>* </span>{t('brews_form_ainfusions_label')}:</span>
                    <input
                        type="number"
                        min={1}
                        value={presetInfusionsAmount}
                        onChange={e => setPresetInfusionsAmount(Number(e.target.value))}
                        required
                        style={{ width: '100%' }}
                    />
                </label>
                <label>
                    <span className="basic-label"><span className='req'>* </span>{t('brews_form_tinfusions_label')}:</span>
                    <input
                        value={presetInfusionTimes}
                        onChange={e => setPresetInfusionTimes(e.target.value)}
                        placeholder={t('brews_form_tinfusions_p')}
                        required
                        style={{ width: '100%' }}
                    />
                </label>
                <div className="brew-actions">
                    <button className="btn btn-quick" onClick={handleAddPreset}>
                        <i className="bxr bx-plus" /> {t('brews_form_add_preset')}
                    </button>
                    {aiEnabled && (
                        <button
                            type="button"
                            className="btn btn-info"
                            onClick={handleAiSuggest}
                            disabled={aiLoading}
                            aria-label={t('ai_suggest_btn')}
                        >
                            {aiLoading ? `✨ ${t('ai_suggest_loading')}` : `✨ ${t('ai_suggest_btn')}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

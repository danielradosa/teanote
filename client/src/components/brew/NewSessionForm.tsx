import { useState } from 'react'
import BrewTimer from '@/components/brew/BrewTimer'
import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface NewSessionFormProps {
    teas: Tea[]
    presets: Preset[]
    activeBrewId: string | null
    activePresetId: string | null
    onStart: (teaId: string, presetId: string | undefined) => void
    onClose: () => void
    reportLive: (infusionNumber: number, secs: number, running: boolean) => void
}

export default function NewSessionForm({
    teas,
    presets,
    activeBrewId,
    activePresetId,
    onStart,
    onClose,
    reportLive,
}: NewSessionFormProps) {
    const [selectedTeaId, setSelectedTeaId] = useState('')
    const [selectedPresetId, setSelectedPresetId] = useState('')

    const handleStart = () => {
        if (!selectedTeaId) return alert(`${t('session_alert_tea_select')}`)
        onStart(selectedTeaId, selectedPresetId || undefined)
    }

    const handleClose = () => {
        setSelectedPresetId('')
        onClose()
    }

    return (
        <section className="quick-actions new-sesion">
            <div>
                <h2>{t('session_start_title')}</h2>
                <div className='brew-main-actions'>
                    <label>
                        <span className="basic-label"><span className='req'>* </span>{t('session_select_tea')}:</span>
                        <div className="select-wrap">
                            <select
                                value={selectedTeaId}
                                onChange={e => setSelectedTeaId(e.target.value)}
                            >
                                <option value="">-</option>
                                {teas.map(tea => (
                                    <option key={tea.id} value={tea.id}>{tea.name}</option>
                                ))}
                            </select>
                            <span className='arr-down'></span>
                        </div>
                    </label>
                    <label>
                        <span className="basic-label">{t('session_select_preset')}:</span>
                        <div className="select-wrap">
                            <select
                                value={selectedPresetId}
                                onChange={e => setSelectedPresetId(e.target.value)}
                            >
                                <option value="">-</option>
                                {presets.map(preset => (
                                    <option key={preset.id} value={preset.id}>
                                        {preset.name} {preset.teaType ? `[${t(`tea_tag_${preset.teaType}`)}]` : ''}
                                    </option>
                                ))}
                            </select>
                            <span className='arr-down'></span>
                        </div>
                    </label>
                    <div className="brew-actions">
                        <button className="btn btn-quick" onClick={handleStart}>
                            <i className="bxr bx-alarm-plus" /> {t('session_start_btn')}
                        </button>
                    </div>
                </div>
                {activeBrewId && (
                    <BrewTimer
                        brewId={activeBrewId}
                        preset={activePresetId ? presets.find(p => p.id === activePresetId) : undefined}
                        onClose={handleClose}
                        reportLive={reportLive}
                    />
                )}
            </div>
        </section>
    )
}

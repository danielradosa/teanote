import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface PresetItemProps {
    preset: Preset
    teas: Tea[]
    onEdit: (preset: Preset) => void
    onDelete: (id: string) => void
    onSyncType: (presetId: string, newType: string) => void
}

export default function PresetItem({ preset, teas, onEdit, onDelete, onSyncType }: PresetItemProps) {
    const tea = preset.teaId ? teas.find(t => t.id === preset.teaId) : undefined
    const teaName = tea?.name ?? null
    const hasDrift =
        !!tea &&
        !!tea.type &&
        !!preset.teaType &&
        tea.type !== preset.teaType

    return (
        <li className='brew-item preset'>
            <div className="brew-details">
                <strong>{preset.name}</strong>&nbsp;
                {teaName ? (
                    <>
                        &mdash; {t('presets_tea_tea')}: {teaName}
                        {preset.teaType && (
                            <span
                                className={'tea-tag tea-tag-' + preset.teaType}
                                style={{ marginLeft: 6 }}
                            >
                                {t(`tea_tag_${preset.teaType}`)}
                            </span>
                        )}
                    </>
                ) : (
                    <>
                        &mdash; {t('presets_tea_type')}:
                        <span className={'tea-tag tea-tag-' + (preset.teaType || 'generic')}>
                            {preset.teaType
                                ? t(`tea_tag_${preset.teaType}`)
                                : t('presets_type_generic')}
                        </span>
                    </>
                )}
                <div style={{ marginTop: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="bx bx-repeat-alt-2" /> {t('preset_infusions')}: {preset.infusionsAmount}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="bx bx-hourglass" /> {t('preset_times')}: {preset.infusionTimes.join('s, ')}s
                    </span>
                </div>

                {hasDrift && tea && (
                    <div className='gentle-sync' style={{ fontSize: 13, color: '#a56800' }}>
                        {t('preset_changed')}: {t(`tea_tag_${preset.teaType}`)} → {t(`tea_tag_${tea.type}`)}<br />
                        <button
                            style={{ width: 'max-content' }}
                            className="btn btn-quick btn-sync"
                            onClick={() => onSyncType(preset.id, tea.type)}
                        >
                            <i className="bxr bx-refresh-cw-alt" /> {t('preset_sync_btn')}
                        </button>
                    </div>
                )}
            </div>
            <div className="brew-actions">
                <button className="btn btn-info" onClick={() => onEdit(preset)}>
                    <i className="bxr bx-edit" />
                </button>
                <button
                    className="btn btn-danger"
                    onClick={() => onDelete(preset.id)}
                    aria-label="Delete preset"
                >
                    <i className="bxr bx-trash" />
                </button>
            </div>
        </li>
    )
}

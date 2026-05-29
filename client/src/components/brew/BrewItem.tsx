import type { Brew, Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface BrewItemProps {
    brew: Brew
    teas: Tea[]
    presets: Preset[]
    activeBrewId: string | null
    liveInfusionNumber: number | null
    liveInfusionSecs: number | null
    isLiveRunning: boolean
    onToPreset: (brew: Brew) => void
    onDelete: (id: string) => void
}

export default function BrewItem({
    brew,
    teas,
    presets,
    activeBrewId,
    liveInfusionNumber,
    liveInfusionSecs,
    isLiveRunning,
    onToPreset,
    onDelete,
}: BrewItemProps) {
    const infusionTimes = brew.infusions.map(i => i.actualTime)
    const totalTime = infusionTimes.reduce((sum, time) => sum + time, 0)
    const tea = teas.find(t => t.id === brew.teaId)

    const isLive =
        activeBrewId === brew.id &&
        isLiveRunning &&
        liveInfusionNumber !== null &&
        liveInfusionSecs !== null

    return (
        <li className="brew-item">
            <div className="brew-details">
                <span>
                    <strong>{tea?.name ?? brew.teaId}</strong>
                    {brew.finishedAt && (
                        <span className="brew-finished-badge">{t('brews_item_finished')}</span>
                    )}
                </span>
                <div className="brew-meta">
                    {brew.infusions.length > 0
                        ? `${brew.infusions.length} ${brew.infusions.length === 1 ? t('brews_item_infusion') : t('brews_item_infusions_s')}`
                        : <span style={{ color: '#a52d44' }}>{t('brews_item_no_infusions')}</span>
                    }
                </div>
                <div className="brew-meta">
                    {brew.presetId && (
                        <div style={{ fontStyle: 'italic', color: '#555' }}>
                            {t('brews_item_preset')}: {presets.find(p => p.id === brew.presetId)?.name}
                        </div>
                    )}
                    <span>
                        {totalTime}s {t('brews_item_total')} • {t('brews_item_infusions')}:&nbsp;
                        {infusionTimes.length > 0 ? infusionTimes.join('s, ') + 's' : '-'}
                    </span>
                </div>
                {isLive && (
                    <div style={{ marginTop: 8 }}>
                        Steep {liveInfusionNumber}: {liveInfusionSecs}s
                        <span
                            className="active-pulse"
                            style={{ marginLeft: 8, color: '#39b385', animation: 'pulse 1s infinite' }}
                        >
                            [active]
                        </span>
                    </div>
                )}
            </div>
            <div className="brew-actions">
                <button className="btn btn-quick" onClick={() => onToPreset(brew)}>
                    <i className="bxr bx-copy" />
                </button>
                <button className="btn btn-danger" onClick={() => onDelete(brew.id)}>
                    <i className="bxr bx-trash" />
                </button>
            </div>
        </li>
    )
}

import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useBrewsStore } from '@/stores/useBrewsStore'
import { useTeasStore } from '@/stores/useTeasStore'
import { runPlannedSecs, runSecs, useBrewSessionStore } from '@/stores/useBrewSessionStore'
import { useNow } from '@/hooks/useNow'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { Preset } from '@/types/Brew'
import { t } from 'i18next'

interface BrewTimerProps {
    brewId: string
    onClose: () => void
    reportLive?: (infusionNumber: number, secs: number, running: boolean) => void
    preset?: Preset
}

const BrewTimer: React.FC<BrewTimerProps> = ({ brewId, onClose, reportLive, preset }) => {
    const { brews, updateBrew } = useBrewsStore()
    const brew = brews.find(b => b.id === brewId)
    const infusionIdx = brew ? brew.infusions.length : 0

    const infusionsDone = !!preset && infusionIdx >= preset.infusionsAmount
    const planned: number | undefined = !infusionsDone ? preset?.infusionTimes[infusionIdx] : undefined

    const timerMode: 'down' | 'up' = planned ? 'down' : 'up'

    // The infusion in progress lives in the session store as instants, so it
    // outlives this component and a reload; what is shown comes from the clock.
    const run = useBrewSessionStore(s => (s.session?.brewId === brewId ? s.session.run : null))
    const startRun = useBrewSessionStore(s => s.startRun)
    const finishRun = useBrewSessionStore(s => s.finishRun)
    const running = run !== null
    const now = useNow(running)
    const runPlanned = run ? runPlannedSecs(run) : null
    const secs = run ? runSecs(run, now) : timerMode === 'down' && planned ? planned : 0

    useWakeLock(runPlanned !== null)

    const { visibleTeas } = useTeasStore()
    const teas = visibleTeas()

    const brewTeaType =
        preset?.teaType ??
        teas.find(t => t.id === brew?.teaId)?.type ??
        'any'

    // A countdown whose end has passed, also while the page was hidden or this
    // component was not mounted, completes here, once.
    useEffect(() => {
        if (!run || run.endsAt === null || now < run.endsAt) return
        if (finishRun(now)?.completed) toast.success(`${t('toast_infusion_finished')}`)
    }, [now, run, finishRun])

    useEffect(() => {
        if (reportLive && brew) reportLive(infusionIdx + 1, secs, running)
        // eslint-disable-next-line
    }, [secs, running, infusionIdx, reportLive])

    if (!brew) return <div>{t('timer_brew_not_found')}</div>
    if (brew.finishedAt) {
        onClose()
        return null
    }

    const handleStart = () => {
        if (infusionsDone || running) return
        startRun(timerMode === 'down' && planned ? planned : null)
    }

    const handleStop = () => {
        if (finishRun(Date.now())?.completed) toast.success(`${t('toast_infusion_finished')}`)
    }

    const handleEndSession = () => {
        finishRun(Date.now())
        updateBrew(brewId, { finishedAt: new Date() })
        toast.success(`${t('toast_brew_ended')}`, { duration: 3000 })
        onClose()
    }

    const fillPercent = (() => {
        if (!running) return 0

        if (runPlanned !== null) {
            return Math.max(0, (secs / runPlanned) * 100)
        }
        return Math.min(100, (secs / (planned ?? 30)) * 100)
    })()

    const teaColors: Record<string, string> = {
        green: '#9ccf7f80',
        white: '#e6e2d880',
        yellow: '#efff6080',
        oolong: '#d5d46f80',
        red: '#cc433180',
        puerh: '#3b2a1a80',
        purple: '#6b4c7a80',
        any: '#c7f1ff'
    }

    const teaColor = teaColors[brewTeaType] ?? teaColors.any

    return (
        <div className='brew-timer-container'>
            <h2>{t('session_brew')}</h2>
            {preset && (
                <div style={{ marginBottom: 5, fontSize: 13, color: '#888' }}>
                    {t('session_preset')}: {preset.name} &mdash; {t('session_infusions')}: {preset.infusionTimes.join(', ')}s
                </div>
            )}
            <p>{t('session_infusion')} {Math.min(infusionIdx + 1, preset?.infusionsAmount ?? Infinity)}{preset?.infusionsAmount ? ` / ${preset.infusionsAmount}` : ''}</p>
            <div className="tea-timer">
                <div
                    className="tea-liquid"
                    style={{
                        '--fill': `${fillPercent}%`,
                        '--tea-color': teaColor
                    } as React.CSSProperties}
                />
                <span className="tea-time">
                    {running ? `${secs}s` : '–'}
                </span>
            </div>
            <div className='brew-timer-actions'>
                {!running && !infusionsDone && (
                    <>
                        <button onClick={handleStart} className='btn btn-quick'>
                            <i className="bxr bx-play-circle" />{t('session_start')}
                        </button>
                        <button onClick={handleEndSession} className='btn btn-dark'>
                            <i className="bxr bx-save" />{t('session_end')}
                        </button>
                    </>
                )}
                {!running && infusionsDone && (
                    <button onClick={handleEndSession} className='btn btn-dark'>
                        <i className="bxr bx-save" />{t('session_end')}
                    </button>
                )}
                {running && (
                    <>
                        <button onClick={handleStop} className='btn btn-info'>
                            <i className="bxr bx-stop-circle" /> {t('session_stop')}
                        </button>
                        <button onClick={handleEndSession} className='btn btn-dark'>
                            <i className="bxr bx-save" /> {t('session_end')}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default BrewTimer

import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useBrewsStore } from '../../stores/useBrewsStore'
import type { Preset } from '../../types/Brew'

interface BrewTimerProps {
    brewId: string
    onClose: () => void
    reportLive?: (infusionNumber: number, secs: number, running: boolean) => void
    preset?: Preset
}

const BrewTimer: React.FC<BrewTimerProps> = ({ brewId, onClose, reportLive, preset }) => {
    const { addInfusion, brews, updateBrew } = useBrewsStore()
    const brew = brews.find(b => b.id === brewId)
    const infusionIdx = brew ? brew.infusions.length : 0
    const hasSavedRef = useRef(false)

    const infusionsDone = !!preset && infusionIdx >= preset.infusionsAmount
    const planned = !infusionsDone && preset?.infusionTimes[infusionIdx]

    const timerMode: 'down' | 'up' = planned ? 'down' : 'up'

    const [secs, setSecs] = useState(timerMode === 'down' && planned ? planned : 0)
    const [running, setRunning] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        setSecs(timerMode === 'down' && planned ? planned : 0)
    }, [infusionIdx, planned, timerMode])

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    useEffect(() => {
        if (reportLive && brew) reportLive(infusionIdx + 1, secs, running)
        // eslint-disable-next-line
    }, [secs, running, infusionIdx, reportLive])

    if (!brew) return <div>brew not found</div>
    if (brew.finishedAt) {
        onClose()
        return null
    }

    const handleStart = () => {
        if (infusionsDone || running) return;
        hasSavedRef.current = false;
        setRunning(true);
        if (timerMode === 'down' && planned) {
            setSecs(planned)
            timerRef.current = setInterval(() => setSecs(s => {
                if (s <= 1 && !hasSavedRef.current) {
                    hasSavedRef.current = true;
                    clearInterval(timerRef.current!)
                    setRunning(false)
                    addInfusion(brewId, { actualTime: planned })
                    toast.success('Infusion finished!')
                    setSecs(0)
                    return 0
                }
                return s - 1
            }), 1000)
        } else {
            setSecs(0)
            timerRef.current = setInterval(() => setSecs(s => s + 1), 1000)
        }
    }

    const handleStop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setRunning(false);
        let actualTime = 0;
        if (timerMode === 'down' && planned) {
            actualTime = planned - secs;
        } else {
            actualTime = secs;
        }
        if (actualTime > 0 && !hasSavedRef.current) {
            hasSavedRef.current = true;
            addInfusion(brewId, { actualTime });
        }
        setSecs(timerMode === 'down' && planned ? planned : 0);
    }

    const handleEndSession = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        let actualTime = 0;
        if (running) {
            if (timerMode === 'down' && planned) {
                actualTime = planned - secs;
            } else {
                actualTime = secs;
            }
            if (actualTime > 0 && !hasSavedRef.current) {
                hasSavedRef.current = true;
                addInfusion(brewId, { actualTime });
            }
        }
        setSecs(0);
        setRunning(false);
        updateBrew(brewId, { finishedAt: new Date() });
        toast.success('Brew session ended 🍵', { duration: 3000 });
        onClose();
    }

    return (
        <div className='brew-timer-container'>
            <h2>Brew session</h2>
            {preset && (
                <div style={{ marginBottom: 5, fontSize: 13, color: '#888' }}>
                    Preset: {preset.name} &mdash; Infusions: {preset.infusionTimes.join(', ')}s
                </div>
            )}
            <p>Infusion {Math.min(infusionIdx + 1, preset?.infusionsAmount ?? Infinity)}{preset?.infusionsAmount ? ` / ${preset.infusionsAmount}` : ''}</p>
            <div className='brew-timer-actions'>
                <span style={{ fontSize: 32 }}>
                    {running
                        ? `${secs}s${timerMode === 'down' ? ' left' : ''}`
                        : '-'
                    }
                </span>
                {!running && !infusionsDone && (
                    <>
                        <button onClick={handleStart} className='btn btn-quick'>
                            <i className="bxr bx-play-circle" />start
                        </button>
                        <button onClick={handleEndSession} className='btn btn-dark'>
                            <i className="bxr bx-save" />end brew session
                        </button>
                    </>
                )}
                {!running && infusionsDone && (
                    <button onClick={handleEndSession} className='btn btn-dark'>
                        <i className="bxr bx-save" />end brew session
                    </button>
                )}
                {running && (
                    <>
                        <button onClick={handleStop} className='btn btn-info'>
                            <i className="bxr bx-stop-circle" />stop
                        </button>
                        <button onClick={handleEndSession} className='btn btn-dark'>
                            <i className="bxr bx-save" />end brew session
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

export default BrewTimer

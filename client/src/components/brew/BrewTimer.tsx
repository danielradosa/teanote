import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useBrewsStore } from '../../stores/useBrewsStore'

interface BrewTimerProps {
    brewId: string
    onClose: () => void
    reportLive?: (infusionNumber: number, secs: number, running: boolean) => void
}

const BrewTimer: React.FC<BrewTimerProps> = ({ brewId, onClose, reportLive }) => {
    const { addInfusion, brews, updateBrew } = useBrewsStore()
    const brew = brews.find(b => b.id === brewId)
    const [secs, setSecs] = useState(0)
    const [running, setRunning] = useState(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const infusionNumber = brew ? brew.infusions.length + 1 : 1

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [])

    useEffect(() => {
        if (reportLive && brew) reportLive(infusionNumber, secs, running)
        // eslint-disable-next-line
    }, [secs, running, infusionNumber, reportLive])

    if (!brew) return <div>brew not found</div>
    if (brew.finishedAt) {
        onClose()
        return null
    }

    const handleStart = () => {
        setRunning(true)
        setSecs(0)
        timerRef.current = setInterval(() => setSecs(s => s + 1), 1000)
    }

    const handleStop = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setRunning(false)
        if (secs > 0) {
            addInfusion(brewId, { actualTime: secs })
        }
        setSecs(0)
    }

    const handleEndSession = () => {
        if (running && secs > 0) {
            if (timerRef.current) clearInterval(timerRef.current)
            addInfusion(brewId, { actualTime: secs })
            setSecs(0)
            setRunning(false)
        }
        updateBrew(brewId, { finishedAt: new Date() })
        toast.success('Brew session ended 🍵', { duration: 3000 })
        onClose()
    }
    
    return (
        <div className='brew-timer-container'>
            <h2>Brew session</h2>
            <p>Infusion {infusionNumber}</p>
            <div className='brew-timer-actions'>
                <span>{running ? `${secs}s` : '-'}</span>
                {!running && (
                    <>
                        <button onClick={handleStart} className='btn btn-quick'>
                           <i className="bxr bx-play-circle" />start
                        </button>
                        <button onClick={handleEndSession} className='btn btn-dark'>
                            <i className="bxr bx-save" />end brew session
                        </button>
                    </>
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
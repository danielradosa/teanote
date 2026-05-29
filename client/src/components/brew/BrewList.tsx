import { useEffect, useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import BrewItem from '@/components/brew/BrewItem'
import type { Brew, Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface BrewListProps {
    brews: Brew[]
    orderedBrews: Brew[]
    teas: Tea[]
    presets: Preset[]
    activeBrewId: string | null
    liveInfusionNumber: number | null
    liveInfusionSecs: number | null
    isLiveRunning: boolean
    onToPreset: (brew: Brew) => void
    onDelete: (id: string) => void
}

export default function BrewList({
    brews,
    orderedBrews,
    teas,
    presets,
    activeBrewId,
    liveInfusionNumber,
    liveInfusionSecs,
    isLiveRunning,
    onToPreset,
    onDelete,
}: BrewListProps) {
    const batchSize = 6
    const [brewItemsToShow, setBrewItemsToShow] = useState(batchSize)

    useEffect(() => {
        const ensureScrollable = () => {
            const ul = document.querySelector('.brew-list')
            if (!ul) return
            const rect = ul.getBoundingClientRect()
            if (rect.bottom < window.innerHeight && brewItemsToShow < orderedBrews.length) {
                setBrewItemsToShow(prev => Math.min(prev + 1, orderedBrews.length))
                requestAnimationFrame(ensureScrollable)
            }
        }
        requestAnimationFrame(ensureScrollable)
    }, [brewItemsToShow, brews, orderedBrews.length])

    const fetchMoreBrews = () => setBrewItemsToShow(prev => prev + batchSize)

    return (
        <section className="recent-sessions">
            <h2>{t('brews_recent_title')}</h2>
            {brews.length > 0 ? (
                <InfiniteScroll
                    dataLength={Math.min(brewItemsToShow, orderedBrews.length)}
                    next={fetchMoreBrews}
                    hasMore={brewItemsToShow < orderedBrews.length}
                    loader={<div>{t('general_loading_more')}</div>}
                    endMessage={<div>{t('brews_no_more')}</div>}
                >
                    <ul className="brew-list">
                        {orderedBrews.slice(0, brewItemsToShow).map(brew => (
                            <BrewItem
                                key={brew.id}
                                brew={brew}
                                teas={teas}
                                presets={presets}
                                activeBrewId={activeBrewId}
                                liveInfusionNumber={liveInfusionNumber}
                                liveInfusionSecs={liveInfusionSecs}
                                isLiveRunning={isLiveRunning}
                                onToPreset={onToPreset}
                                onDelete={onDelete}
                            />
                        ))}
                    </ul>
                </InfiniteScroll>
            ) : (
                <p style={{ marginTop: 8 }}>{t('brews_no_yet')}</p>
            )}
        </section>
    )
}

import { useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import TeaItem from '@/components/tea/TeaItem'
import { teaImageSrc, useSignedTeaImages } from '@/helpers/teaImages'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface TeaListProps {
    teas: Tea[]
    deleteTea: (id: string) => void
    onEdit: (tea: Tea) => void
}

export default function TeaList({ teas, deleteTea, onEdit }: TeaListProps) {
    const batchSize = 6
    const [teaItemsToShow, setTeaItemsToShow] = useState(batchSize)

    const sortedTeas = [...teas].sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        }
        return b.id.localeCompare(a.id)
    })

    const shownTeas = sortedTeas.slice(0, teaItemsToShow)
    const signedImages = useSignedTeaImages(shownTeas)

    const fetchMoreTeas = () => setTeaItemsToShow(prev => prev + batchSize)

    return (
        <section className="tea-table">
            <h2>{t('teas_all_teas')}</h2>
            {sortedTeas.length > 0 ? (
                <InfiniteScroll
                    dataLength={Math.min(teaItemsToShow, sortedTeas.length)}
                    next={fetchMoreTeas}
                    hasMore={teaItemsToShow < sortedTeas.length}
                    loader={<div>{t('general_loading_more')}</div>}
                    endMessage={<div>{t('teas_no_more')}</div>}
                >
                    <ul className="tea-list">
                        {shownTeas.map(tea => (
                            <TeaItem
                                key={tea.id}
                                tea={tea}
                                imageSrc={teaImageSrc(tea, signedImages)}
                                deleteTea={deleteTea}
                                onEdit={onEdit}
                            />
                        ))}
                    </ul>
                </InfiniteScroll>
            ) : (
                <p style={{ marginTop: 8 }}>{t('teas_no_teas_yet')}</p>
            )}
        </section>
    )
}

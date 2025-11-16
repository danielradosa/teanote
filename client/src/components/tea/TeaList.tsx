/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import InfiniteScroll from 'react-infinite-scroll-component'
import TeaItem from './TeaItem'
import { useState } from 'react'
import { t } from 'i18next'

export default function TeaList({ teas, deleteTea, onEdit }: any) {
    const batchSize = 6
    const [teaItemsToShow, setTeaItemsToShow] = useState(batchSize)

    const sortedTeas = [...teas].sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        }
        return b.id - a.id
    })

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
                        {sortedTeas.slice(0, teaItemsToShow).map((tea: any) => (
                            <TeaItem key={tea.id} tea={tea} deleteTea={deleteTea} onEdit={onEdit} />
                        ))}
                    </ul>
                </InfiniteScroll>
            ) : (
                <p style={{ marginTop: 8 }}>{t('teas_no_teas_yet')}</p>
            )}
        </section>
    )
}
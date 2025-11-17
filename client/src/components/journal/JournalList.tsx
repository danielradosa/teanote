/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import InfiniteScroll from 'react-infinite-scroll-component'
import JournalItem from './JournalItem'
import { useState } from 'react'
import { t } from 'i18next'

export default function JournalList({ journals, teas, brews, presets, getBrewName, onEdit, onDelete }: any) {
    const batchSize = 6
    const [journalItemsToShow, setJournalItemsToShow] = useState(batchSize)

    const sortedJournals = [...journals].sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        }
        return b.id - a.id
    })

    const fetchMore = () => setJournalItemsToShow(prev => prev + batchSize)

    return (
        <section className="journal-table">
            <h2>{t('journals_all')}</h2>

            {sortedJournals.length > 0 ? (
                <InfiniteScroll
                    dataLength={Math.min(journalItemsToShow, sortedJournals.length)}
                    next={fetchMore}
                    hasMore={journalItemsToShow < sortedJournals.length}
                    loader={<div>{t('general_loading_more')}</div>}
                    endMessage={<div>{t('journals_no_more')}</div>}
                >
                    <ul className="journal-list">
                        {sortedJournals.slice(0, journalItemsToShow).map((journal: any) => {
                            const tea = teas.find((t: any) => t.id === journal.teaId)
                            return (
                                <JournalItem
                                    key={journal.id}
                                    journal={journal}
                                    tea={tea}
                                    brews={brews}
                                    presets={presets}
                                    getBrewName={getBrewName}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                />
                            )
                        })}
                    </ul>
                </InfiniteScroll>
            ) : (
                <p style={{ marginTop: 8 }}>{t('journals_none')}</p>
            )}
        </section>
    )
}
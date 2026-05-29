import { useState } from 'react'
import InfiniteScroll from 'react-infinite-scroll-component'
import JournalItem from '@/components/journal/JournalItem'
import type { Journal } from '@/types/Journal'
import type { Tea } from '@/types/Tea'
import type { Brew, Preset } from '@/types/Brew'
import { t } from 'i18next'

interface JournalListProps {
    journals: Journal[]
    teas: Tea[]
    brews: Brew[]
    presets: Preset[]
    getBrewName: (id: string) => string
    onEdit: (journal: Journal) => void
    onDelete: (id: string) => void
}

export default function JournalList({ journals, teas, getBrewName, onEdit, onDelete }: JournalListProps) {
    const batchSize = 6
    const [journalItemsToShow, setJournalItemsToShow] = useState(batchSize)

    const sortedJournals = [...journals].sort((a, b) => {
        if (a.dateAdded && b.dateAdded) {
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
        }
        return b.id.localeCompare(a.id)
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
                        {sortedJournals.slice(0, journalItemsToShow).map(journal => {
                            const tea = teas.find(t => t.id === journal.teaId)
                            return (
                                <JournalItem
                                    key={journal.id}
                                    journal={journal}
                                    tea={tea}
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

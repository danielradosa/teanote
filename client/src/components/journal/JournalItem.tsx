import { useState } from 'react'
import MdDisplay from '@/components/MdDisplay'
import type { Journal } from '@/types/Journal'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface JournalItemProps {
    journal: Journal
    tea: Tea | undefined
    getBrewName: (id: string) => string
    onEdit: (journal: Journal) => void
    onDelete: (id: string) => void
}

interface JournalWithImages extends Journal {
    images?: string[]
}

/**
 * Stars drawn for a stored rating: a whole number from 0 to 5, whatever the
 * value is. The column takes any integer and older versions stored what was
 * typed, and '⭐'.repeat throws for a negative or very large count, which
 * would break the whole journal page.
 */
function starCount(rating: number): number {
    if (Number.isNaN(rating)) return 0
    return Math.min(5, Math.max(0, Math.round(rating)))
}

export default function JournalItem({ journal, tea, getBrewName, onEdit, onDelete }: JournalItemProps) {
    const [openDetails, setOpenDetails] = useState(false)
    const withImages = journal as JournalWithImages

    return (
        <li className="journal-item">
            <div className={`journal-details ${openDetails ? 'details-open' : ''}`}>
                <span>
                    <strong>{journal.title}</strong>{' '}
                    {tea && (
                        <>
                            <span
                                className={`tea-tag tea-tag-${tea.type}`}
                                style={{
                                    marginLeft: 4,
                                    padding: '2px 8px',
                                    borderRadius: 8,
                                    background: '#f6f6f6',
                                    fontSize: '13px',
                                    color: '#458253',
                                    textTransform: 'capitalize',
                                    display: 'inline-block'
                                }}
                            >
                                {t(`tea_tag_${tea.type}`)}
                            </span>
                            <span className="tea-name" style={{ marginLeft: 8, fontStyle: 'italic', fontSize: '13px' }}>{tea.name}</span>
                        </>
                    )}

                    {journal.rating != null && <span style={{ marginLeft: 8, color: '#ffc21a', fontWeight: 600 }}>{'⭐'.repeat(starCount(journal.rating))}</span>}

                    <span className="journal-date" style={{ fontSize: '10px', marginLeft: 8 }}>
                        ({new Date(journal.dateAdded ?? Date.now()).toLocaleDateString()})
                    </span>
                </span>

                {openDetails && (
                    <div className="journal-extra" style={{ marginTop: 8 }}>
                        <p style={{ fontSize: '13px' }}>
                            {t('journals_brew_preset')}: <strong>{getBrewName(journal.brew_preset_id ?? '') || `${t('journal_preset_none')}`}</strong>
                        </p>
                        <MdDisplay content={journal.content} />
                        {Array.isArray(withImages.images) && withImages.images.length > 0 && (
                            <div className="journal-images" style={{ display: 'flex', gap: 10 }}>
                                {withImages.images.map((img, idx) => (
                                    <img
                                        key={img}
                                        src={img}
                                        alt={`journal image ${idx + 1}`}
                                        style={{
                                            maxHeight: 120,
                                            borderRadius: 8,
                                            objectFit: 'cover'
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
                <button className="btn btn-simple" onClick={() => setOpenDetails(!openDetails)}>
                    <i className={`bxr ${openDetails ? 'bx-list-minus' : 'bx-list-plus'}`} /> {openDetails ? t('general_hide_details') : t('general_see_details')}
                </button>
            </div>

            <div className="journal-actions">
                <button className="btn btn-info" onClick={() => onEdit(journal)}><i className="bxr bx-edit" /></button>
                <button className="btn btn-danger" onClick={() => onDelete(journal.id)}><i className="bxr bx-trash" /></button>
            </div>
        </li>
    )
}

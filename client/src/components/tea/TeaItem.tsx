/* eslint-disable @typescript-eslint/no-explicit-any */

'use client'

import { useState } from 'react'
import MdDisplay from '../MdDisplay'
import { t } from 'i18next'

export default function TeaItem({ tea, deleteTea, onEdit }: any) {
    const [openDetails, setOpenDetails] = useState(false)

    return (
        <li className="tea-item">
            <div className={`tea-details ${openDetails ? 'details-open' : ''}`}>
                <span>
                    <strong>{tea.name}</strong> {tea.year}
                    {tea.origin && <span> — {tea.origin}</span>}
                    <span
                        className={`tea-tag tea-tag-${tea.type}`}
                        style={{
                            marginLeft: 8,
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
                </span>

                {openDetails && (
                    <div className="tea-extra">
                        {tea.inventory && <p><strong>{t('teas_item_stash')}:</strong> {tea.inventory}</p>}
                        {tea.vendor && <p><strong>{t('teas_item_vendor')}:</strong> {tea.vendor}</p>}
                        {tea.link && (
                            <p>
                                <strong>{t('teas_item_link')}:</strong> <a href={tea.link} target="_blank" rel="noreferrer">{tea.link}</a>
                            </p>
                        )}
                        {tea.image && <div className="tea-image"><img src={tea.image} alt={tea.name} /></div>}
                        {tea.notes && <p><strong>{t('teas_item_notes')}:</strong> <MdDisplay content={tea.notes} /></p>}
                    </div>
                )}

                <button className="btn btn-simple" onClick={() => setOpenDetails(!openDetails)}>
                    <i className={`bxr ${openDetails ? 'bx-list-minus' : 'bx-list-plus'}`} /> {openDetails ? `${t('general_hide_details')}` : `${t('general_see_details')}`}
                </button>
            </div>

            <div className="tea-actions">
                <button className="btn btn-info" onClick={() => onEdit(tea)}><i className="bxr bx-edit" /></button>
                <button className="btn btn-danger" onClick={() => deleteTea(tea.id)}><i className="bxr bx-trash" /></button>
            </div>
        </li>
    )
}
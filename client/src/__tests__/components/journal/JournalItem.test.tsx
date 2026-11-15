import '@/lang'
import { render } from '@testing-library/react'
import JournalItem from '@/components/journal/JournalItem'
import type { Journal } from '@/types/Journal'

const T0 = '2026-11-01T08:00:00.000Z'

function journal(rating: number | null | undefined): Journal {
    return {
        id: 'j-1',
        user_id: 'user-1',
        teaId: 'tea-1',
        brew_preset_id: null,
        title: 'Morning cup',
        rating,
        content: 'grassy',
        images: [],
        dateAdded: T0,
        updated_at: T0,
        deleted_at: null,
    }
}

function renderItem(rating: number | null | undefined) {
    return render(
        <JournalItem journal={journal(rating)} tea={undefined} getBrewName={() => ''} onEdit={() => {}} onDelete={() => {}} />
    )
}

/** How many stars the item draws for a stored rating, or the error that stopped it rendering. */
function starsDrawn(rating: number | null | undefined): number | string {
    try {
        const { container, unmount } = renderItem(rating)
        const stars = (container.textContent ?? '').split('⭐').length - 1
        unmount()
        return stars
    } catch (err) {
        return String(err)
    }
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('JournalItem: the stars of a rating', () => {
    it('draws a whole number of stars from 0 to 5 whatever the stored rating is, and never throws', () => {
        // Any of these can reach a device: the column takes any integer, and an
        // older version stored what was typed. The page has no error boundary.
        const ratings: [string, number | null | undefined][] = [
            ['undefined', undefined],
            ['null', null],
            ['NaN', Number.NaN],
            ['-1', -1],
            ['0', 0],
            ['1', 1],
            ['2.4', 2.4],
            ['2.5', 2.5],
            ['5', 5],
            ['6', 6],
            ['99999999999', 99999999999],
            ['2147483647', 2147483647],
            ['Infinity', Infinity],
            ['-Infinity', -Infinity],
        ]

        const drawn = Object.fromEntries(ratings.map(([label, rating]) => [label, starsDrawn(rating)]))

        expect(drawn).toEqual({
            undefined: 0,
            null: 0,
            NaN: 0,
            '-1': 0,
            '0': 0,
            '1': 1,
            '2.4': 2,
            '2.5': 3,
            '5': 5,
            '6': 5,
            '99999999999': 5,
            '2147483647': 5,
            Infinity: 5,
            '-Infinity': 0,
        })
    })

    it('shows a journal whose rating is null ("no rating") exactly as one without a rating', () => {
        const withoutRating = renderItem(undefined).container.innerHTML
        const withNull = renderItem(null).container.innerHTML

        expect(withNull).toBe(withoutRating)
    })
})

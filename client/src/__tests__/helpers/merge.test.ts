import { describe, it, expect } from 'vitest'
import { mergeRecords } from '@/helpers/merge'

interface Row {
    id: string
    updated_at?: string
    deleted_at?: string | null
    value?: string
}

const t = (n: number) => new Date(2026, 0, 1, 0, 0, n).toISOString()

describe('mergeRecords', () => {
    it('keeps the local row when local is newer', () => {
        const local: Row[] = [{ id: 'a', updated_at: t(10), value: 'local' }]
        const remote: Row[] = [{ id: 'a', updated_at: t(5), value: 'remote' }]

        const result = mergeRecords(local, remote)

        expect(result).toHaveLength(1)
        expect(result[0].value).toBe('local')
    })

    it('keeps the remote row when remote is newer', () => {
        const local: Row[] = [{ id: 'a', updated_at: t(5), value: 'local' }]
        const remote: Row[] = [{ id: 'a', updated_at: t(10), value: 'remote' }]

        expect(mergeRecords(local, remote)[0].value).toBe('remote')
    })

    it('preserves a tombstone over a live row regardless of timestamp', () => {
        // remote was deleted at t=1, but local edited at t=10 — tombstone still wins
        const local: Row[] = [{ id: 'a', updated_at: t(10), value: 'edited', deleted_at: null }]
        const remote: Row[] = [{ id: 'a', updated_at: t(1), deleted_at: t(1) }]

        const result = mergeRecords(local, remote)

        expect(result).toHaveLength(1)
        expect(result[0].deleted_at).toBe(t(1))
    })

    it('preserves a local tombstone over a stale live remote row', () => {
        const local: Row[] = [{ id: 'a', updated_at: t(10), deleted_at: t(10) }]
        const remote: Row[] = [{ id: 'a', updated_at: t(5), value: 'still live' }]

        expect(mergeRecords(local, remote)[0].deleted_at).toBe(t(10))
    })

    it('adds local-only records (not yet synced to remote)', () => {
        const local: Row[] = [{ id: 'new', updated_at: t(1), value: 'only local' }]
        const remote: Row[] = []

        expect(mergeRecords(local, remote)).toEqual(local)
    })

    it('adds remote-only records (newly seen from another device)', () => {
        const local: Row[] = []
        const remote: Row[] = [{ id: 'r', updated_at: t(1), value: 'only remote' }]

        expect(mergeRecords(local, remote)).toEqual(remote)
    })

    it('merges multiple ids independently', () => {
        const local: Row[] = [
            { id: 'a', updated_at: t(10), value: 'local-a' },
            { id: 'b', updated_at: t(1), value: 'local-b' },
        ]
        const remote: Row[] = [
            { id: 'a', updated_at: t(5), value: 'remote-a' },
            { id: 'b', updated_at: t(10), value: 'remote-b' },
        ]

        const byId = Object.fromEntries(mergeRecords(local, remote).map(r => [r.id, r.value]))
        expect(byId).toEqual({ a: 'local-a', b: 'remote-b' })
    })
})

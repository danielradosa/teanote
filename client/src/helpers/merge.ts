export function mergeRecords<T extends { id: string; updated_at?: string }>(local: T[], remote: T[]): T[] {
    const map = new Map<string, T>()

    for (const r of remote) map.set(r.id, r)
    for (const l of local) {
        const existing = map.get(l.id)
        if (!existing || (l.updated_at && (!existing.updated_at || l.updated_at > existing.updated_at))) {
            map.set(l.id, l)
        }
    }

    return Array.from(map.values())
}
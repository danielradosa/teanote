export function mergeRecords<T extends { id: string; updated_at?: string; deleted_at?: string | null }>(
    local: T[],
    remote: T[]
): T[] {
    const merged = new Map<string, T>();

    for (const r of remote) merged.set(r.id, r);

    for (const l of local) {
        const r = merged.get(l.id);

        if (!r) {
            merged.set(l.id, l);
            continue;
        }

        const localTime = l.updated_at ? new Date(l.updated_at).getTime() : 0;
        const remoteTime = r.updated_at ? new Date(r.updated_at).getTime() : 0;

        if (r.deleted_at && !l.deleted_at) {
            merged.set(l.id, r);
            continue;
        }

        if (l.deleted_at && !r.deleted_at) {
            merged.set(l.id, l);
            continue;
        }

        merged.set(l.id, localTime > remoteTime ? l : r);
    }

    return Array.from(merged.values());
}
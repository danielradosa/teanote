export function mergeRecords<
    T extends { id: string; updated_at?: string; deleted_at?: string | null }
>(local: T[], remote: T[]): T[] {
    const merged = new Map<string, T>();

    for (const r of remote) merged.set(r.id, r);

    for (const l of local) {
        const remoteItem = merged.get(l.id);

        if (!remoteItem) {
            merged.set(l.id, l);
            continue;
        }

        const localTime = l.updated_at ? new Date(l.updated_at).getTime() : 0;
        const remoteTime = remoteItem.updated_at ? new Date(remoteItem.updated_at).getTime() : 0;

        const localDel = l.deleted_at ? new Date(l.deleted_at).getTime() : 0;
        const remoteDel = remoteItem.deleted_at ? new Date(remoteItem.deleted_at).getTime() : 0;

        // If one is deleted, pick the most recent deleted_at or updated_at
        if (localDel || remoteDel) {
            if (localDel > remoteDel) merged.set(l.id, l);
            else merged.set(l.id, remoteItem);
        } else {
            // Neither deleted → pick the most recently updated
            if (localTime > remoteTime) merged.set(l.id, l);
            else merged.set(l.id, remoteItem);
        }
    }

    return Array.from(merged.values());
}
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

        if (remoteDel && !l.deleted_at) {
            merged.set(l.id, remoteItem);
        } else if (localDel && (!remoteItem.deleted_at || localDel > remoteDel)) {
            merged.set(l.id, l);
        } else if (localTime > remoteTime) {
            merged.set(l.id, l);
        } else {
            merged.set(l.id, remoteItem);
        }
    }

    return Array.from(merged.values()).filter(item => !item.deleted_at);
}
export function mergeRecords<T extends { id: string; updated_at: string; deleted_at?: string | null }>(
    local: T[],
    remote: T[]
): T[] {
    const merged = new Map<string, T>();

    for (const r of remote) merged.set(r.id, r);

    for (const l of local) {
        const remoteItem = merged.get(l.id);

        if (!remoteItem) {
            merged.set(l.id, l);
        } else {
            const localTime = new Date(l.updated_at).getTime();
            const remoteTime = new Date(remoteItem.updated_at).getTime();

            if (l.deleted_at || remoteItem.deleted_at) {
                const localDel = l.deleted_at ? new Date(l.deleted_at).getTime() : 0;
                const remoteDel = remoteItem.deleted_at ? new Date(remoteItem.deleted_at).getTime() : 0;
                merged.set(l.id, localDel > remoteDel ? l : remoteItem);
            } else {
                merged.set(l.id, localTime > remoteTime ? l : remoteItem);
            }
        }
    }

    return Array.from(merged.values()).filter(item => !item.deleted_at);
}
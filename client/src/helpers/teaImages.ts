import { useEffect, useSyncExternalStore } from 'react'
import supabase from '@/utils/supa'
import { deleteImage } from '@/helpers/upload'
import type { Tea } from '@/types/Tea'

/*
 * Display links for uploaded tea photos.
 *
 * A tea record keeps only the storage path of its photo (`image_path`); a link
 * to the private "teas" bucket is signed here when the photo is shown, kept in
 * memory for this page session, and signed again before it expires. Signed
 * links are never written to a record or to localStorage, because the record
 * syncs to every device and would carry a link that dies for all of them.
 */

const BUCKET = 'teas'

/** Lifetime asked for each signed link. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60
/** A link this close to expiry is signed again. */
export const RESIGN_BEFORE_EXPIRY_MS = 5 * 60 * 1000
/** Shortest wait between re-sign attempts, so a failing one does not loop. */
const MIN_RESIGN_DELAY_MS = 30 * 1000

export interface SignedUrl {
    url: string
    /** Epoch ms after which the link no longer works. */
    expiresAt: number
}

export type SignedUrls = ReadonlyMap<string, SignedUrl>

type TeaImageFields = Partial<Pick<Tea, 'image' | 'image_path'>>

// Replaced, never mutated, so it can serve as a useSyncExternalStore snapshot.
let signed: SignedUrls = new Map()
// Paths being signed right now, each with the request that signs it.
const inFlight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
}

export function getSignedTeaImageUrls(): SignedUrls {
    return signed
}

function dueForSigning(path: string, now: number) {
    const entry = signed.get(path)
    return !entry || entry.expiresAt - now <= RESIGN_BEFORE_EXPIRY_MS
}

/**
 * Signs, in one request, every given path that has no link yet or whose link
 * is close to expiry, and waits for any request already out for the others.
 * Never throws: offline or on any failure it signs nothing and a later call
 * tries again.
 */
export async function signTeaImagePaths(paths: string[]): Promise<void> {
    const requestedAt = Date.now()
    const wanted = [...new Set(paths)].filter(Boolean)
    const pending = wanted.flatMap(p => inFlight.get(p) ?? [])
    const batch = wanted.filter(p => !inFlight.has(p) && dueForSigning(p, requestedAt))

    if (batch.length > 0 && navigator.onLine) {
        let settle!: () => void
        const request = new Promise<void>(resolve => { settle = resolve })
        batch.forEach(p => inFlight.set(p, request))
        pending.push(request)
        try {
            const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(batch, SIGNED_URL_TTL_SECONDS)
            if (error || !data) {
                console.warn('Could not sign tea photo links:', error)
            } else {
                const expiresAt = requestedAt + SIGNED_URL_TTL_SECONDS * 1000
                const next = new Map(signed)
                data.forEach((item, i) => {
                    const path = item.path ?? batch[i]
                    if (!item.error && item.signedUrl && batch.includes(path)) next.set(path, { url: item.signedUrl, expiresAt })
                })
                signed = next
                listeners.forEach(listener => listener())
            }
        } catch (err) {
            console.warn('Could not sign tea photo links:', err)
        } finally {
            batch.forEach(p => inFlight.delete(p))
            settle()
        }
    }

    await Promise.all(pending)
}

/**
 * The picture to show for a tea: for an uploaded photo (`image_path`) only its
 * signed link, never the stale link a record may still carry in `image`; for
 * any other tea its `image` URL as stored. Undefined when there is nothing to show.
 */
export function teaImageSrc(tea: TeaImageFields, urls: SignedUrls, now = Date.now()): string | undefined {
    if (tea.image_path) {
        const entry = urls.get(tea.image_path)
        return entry && entry.expiresAt > now ? entry.url : undefined
    }
    return tea.image || undefined
}

function resignDelay(paths: string[]): number | null {
    const now = Date.now()
    let soonest: number | null = null
    for (const p of paths) {
        const entry = signed.get(p)
        if (!entry) continue
        const due = entry.expiresAt - RESIGN_BEFORE_EXPIRY_MS - now
        soonest = soonest === null ? due : Math.min(soonest, due)
    }
    return soonest === null ? null : Math.max(soonest, MIN_RESIGN_DELAY_MS)
}

/**
 * Signs the photos of the teas being shown, in one batch, and signs them again
 * before their links expire for as long as they stay shown. Returns the
 * current links, for `teaImageSrc`.
 */
export function useSignedTeaImages(teas: TeaImageFields[]): SignedUrls {
    const urls = useSyncExternalStore(subscribe, getSignedTeaImageUrls)
    const key = [...new Set(teas.map(t => t.image_path).filter((p): p is string => !!p))].join('\n')

    useEffect(() => {
        if (!key) return
        const paths = key.split('\n')
        let cancelled = false
        let timer: ReturnType<typeof setTimeout> | undefined

        const run = async () => {
            await signTeaImagePaths(paths)
            if (cancelled) return
            const delay = resignDelay(paths)
            if (delay !== null) timer = setTimeout(run, delay)
        }
        void run()

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [key])

    return urls
}

/**
 * Deletes the given photo files from storage, except any that one of `records`
 * still references. Never throws.
 */
export async function deleteUnreferencedTeaImages(paths: string[], records: TeaImageFields[]): Promise<void> {
    const referenced = new Set(records.map(r => r.image_path).filter(Boolean))
    for (const path of new Set(paths)) {
        if (!path || referenced.has(path)) continue
        try {
            await deleteImage(BUCKET, path)
        } catch (err) {
            console.warn('Could not delete tea photo', path, err)
        }
    }
}

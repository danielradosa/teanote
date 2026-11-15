import { act, renderHook } from '@testing-library/react'
import { fakeSupabase as server } from '@/__tests__/support/fakeSupabase'
import {
    RESIGN_BEFORE_EXPIRY_MS,
    SIGNED_URL_TTL_SECONDS,
    getSignedTeaImageUrls,
    signTeaImagePaths,
    teaImageSrc,
    useSignedTeaImages,
} from '@/helpers/teaImages'

vi.mock('@/utils/supa', async () => ({
    default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
}))

// The module keeps its links for the whole page session, so every test signs
// paths of its own.
let run = 0
let prefix = ''
const path = (name: string) => `${prefix}/${name}.jpg`

const STALE = 'https://abc.supabase.co/storage/v1/object/sign/teas/user-1/old.jpg?token=expired'

beforeEach(() => {
    server.reset()
    localStorage.clear()
    prefix = `user-${++run}`
})

afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
})

describe('signTeaImagePaths', () => {
    it('signs the given paths in one batch from the teas bucket, each path once', async () => {
        await signTeaImagePaths([path('a'), path('b'), path('a'), ''])

        expect(server.signCalls).toEqual([
            { bucket: 'teas', paths: [path('a'), path('b')], expiresIn: SIGNED_URL_TTL_SECONDS },
        ])
        expect(getSignedTeaImageUrls().get(path('a'))?.url).toBe(`https://storage.test/teas/${path('a')}?sig=1`)
        expect(getSignedTeaImageUrls().get(path('b'))?.url).toBe(`https://storage.test/teas/${path('b')}?sig=1`)
    })

    it('reuses a link it already holds and signs only the paths it does not hold', async () => {
        await signTeaImagePaths([path('a')])
        await signTeaImagePaths([path('a'), path('b')])

        expect(server.signCalls.map(c => c.paths)).toEqual([[path('a')], [path('b')]])
    })

    it('does not sign a path twice while a request for it is still out', async () => {
        await Promise.all([signTeaImagePaths([path('a')]), signTeaImagePaths([path('a')])])

        expect(server.signCalls).toHaveLength(1)
    })

    it('keeps links in memory only: nothing is written to localStorage', async () => {
        // (A spy on localStorage.setItem would itself be stored as an item, so count items instead.)
        await signTeaImagePaths([path('a')])

        expect(getSignedTeaImageUrls().get(path('a'))).toBeDefined()
        expect(localStorage.length).toBe(0)
    })

    it('throws nothing and shows no link when the batch fails, and signs again on the next call', async () => {
        server.signer = async () => ({ data: null, error: { message: 'storage unavailable' } })
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        await expect(signTeaImagePaths([path('a')])).resolves.toBeUndefined()
        expect(teaImageSrc({ image_path: path('a'), image: STALE }, getSignedTeaImageUrls())).toBeUndefined()

        server.signer = null
        await signTeaImagePaths([path('a')])

        expect(server.signCalls).toHaveLength(2)
        expect(teaImageSrc({ image_path: path('a') }, getSignedTeaImageUrls())).toBe(`https://storage.test/teas/${path('a')}?sig=2`)
    })

    it('throws nothing when the request itself rejects', async () => {
        server.signer = () => Promise.reject(new TypeError('Failed to fetch'))
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        await expect(signTeaImagePaths([path('a')])).resolves.toBeUndefined()
        expect(getSignedTeaImageUrls().get(path('a'))).toBeUndefined()
    })

    it('makes no request offline, and signs once the device is back online', async () => {
        const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

        await expect(signTeaImagePaths([path('a')])).resolves.toBeUndefined()
        expect(server.signCalls).toHaveLength(0)

        onLine.mockReturnValue(true)
        await signTeaImagePaths([path('a')])
        expect(server.signCalls).toHaveLength(1)
    })

    it('leaves out a path the server could not sign and keeps the others', async () => {
        server.signer = async ({ paths }) => ({
            data: paths.map(p => p === path('gone')
                ? { path: p, error: 'Object not found', signedUrl: null }
                : { path: p, error: null, signedUrl: `https://storage.test/teas/${p}?ok` }),
            error: null,
        })

        await signTeaImagePaths([path('gone'), path('here')])

        expect(getSignedTeaImageUrls().get(path('gone'))).toBeUndefined()
        expect(getSignedTeaImageUrls().get(path('here'))?.url).toBe(`https://storage.test/teas/${path('here')}?ok`)
    })
})

describe('useSignedTeaImages', () => {
    it('signs the shown teas in one batch and re-signs before the links expire', async () => {
        vi.useFakeTimers()
        const teas = [{ image_path: path('a') }, { image_path: path('b') }, { image: 'https://shop.example/x.png' }]

        const { result } = renderHook(() => useSignedTeaImages(teas))
        await act(() => vi.advanceTimersByTimeAsync(0))

        expect(server.signCalls.map(c => c.paths)).toEqual([[path('a'), path('b')]])
        const first = result.current.get(path('a'))!
        expect(first.url).toBe(`https://storage.test/teas/${path('a')}?sig=1`)

        const resignAt = first.expiresAt - RESIGN_BEFORE_EXPIRY_MS
        await act(() => vi.advanceTimersByTimeAsync(resignAt - Date.now() - 1000))
        expect(server.signCalls).toHaveLength(1)

        await act(() => vi.advanceTimersByTimeAsync(2000))
        expect(server.signCalls.map(c => c.paths)).toEqual([[path('a'), path('b')], [path('a'), path('b')]])
        expect(Date.now()).toBeLessThan(first.expiresAt)
        const second = result.current.get(path('a'))!
        expect(second.url).toBe(`https://storage.test/teas/${path('a')}?sig=2`)
        expect(second.expiresAt).toBeGreaterThan(first.expiresAt)
    })

    it('still re-signs when another caller had already asked for the same paths (StrictMode mounts twice)', async () => {
        vi.useFakeTimers()
        const teas = [{ image_path: path('a') }]
        // The server takes a moment to answer, as a real one does.
        server.signer = call => new Promise(resolve => setTimeout(() => resolve({
            data: call.paths.map(p => ({ path: p, error: null, signedUrl: `https://storage.test/teas/${p}?n=${server.signCalls.length}` })),
            error: null,
        }), 200))

        renderHook(() => useSignedTeaImages(teas), { reactStrictMode: true })
        await act(() => vi.advanceTimersByTimeAsync(500))
        expect(server.signCalls).toHaveLength(1)

        await act(() => vi.advanceTimersByTimeAsync(SIGNED_URL_TTL_SECONDS * 1000 - RESIGN_BEFORE_EXPIRY_MS + 1000))

        expect(server.signCalls).toHaveLength(2)
    })

    it('stops re-signing once the teas are no longer shown', async () => {
        vi.useFakeTimers()
        const teas = [{ image_path: path('a') }]

        const { unmount } = renderHook(() => useSignedTeaImages(teas))
        await act(() => vi.advanceTimersByTimeAsync(0))
        unmount()
        await act(() => vi.advanceTimersByTimeAsync(SIGNED_URL_TTL_SECONDS * 1000 * 3))

        expect(server.signCalls).toHaveLength(1)
    })

    it('signs nothing when no shown tea has an uploaded photo', async () => {
        renderHook(() => useSignedTeaImages([{ image: 'https://shop.example/x.png' }, {}]))
        await act(async () => {})

        expect(server.signCalls).toHaveLength(0)
    })
})

describe('teaImageSrc', () => {
    const signed = (url: string, expiresAt: number) => new Map([[path('a'), { url, expiresAt }]])

    it('shows the path-derived link for a tea with image_path and ignores tea.image', () => {
        const tea = Object.freeze({ image_path: path('a'), image: STALE })

        expect(teaImageSrc(tea, signed('https://fresh', 2_000), 1_000)).toBe('https://fresh')
    })

    it('shows nothing for a tea with image_path until its link is signed, and once that link has expired', () => {
        const tea = { image_path: path('a'), image: STALE }

        expect(teaImageSrc(tea, new Map(), 1_000)).toBeUndefined()
        expect(teaImageSrc(tea, signed('https://fresh', 2_000), 2_000)).toBeUndefined()
    })

    it('shows tea.image exactly as stored for a tea with no image_path', () => {
        expect(teaImageSrc({ image: 'https://shop.example/x.png' }, new Map())).toBe('https://shop.example/x.png')
        expect(teaImageSrc({ image: 'https://shop.example/x.png', image_path: null }, new Map())).toBe('https://shop.example/x.png')
    })

    it('shows nothing for a tea with neither', () => {
        expect(teaImageSrc({ image: '' }, new Map())).toBeUndefined()
        expect(teaImageSrc({}, new Map())).toBeUndefined()
    })
})

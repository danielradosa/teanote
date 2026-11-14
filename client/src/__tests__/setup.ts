import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Node 25+ defines its own global `localStorage`, which is undefined unless Node
// runs with --localstorage-file, and it hides jsdom's. Use jsdom's Storage.
if (typeof globalThis.localStorage === 'undefined' && 'jsdom' in globalThis) {
    const { window: domWindow } = (globalThis as unknown as { jsdom: { window: Window } }).jsdom
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: domWindow.localStorage })
}

afterEach(() => {
    cleanup()
})

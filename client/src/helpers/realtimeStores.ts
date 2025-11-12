import { useTeasStore } from '../stores/useTeasStore'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useSettingsStore } from '../stores/useSettingsStore'

const stores = [
  useTeasStore,
  useJournalsStore,
  useBrewsStore,
  useSettingsStore,
]

export function initAllRealtime() {
  stores.forEach(store => store.getState().initRealtime?.())
}

export function stopAllRealtime() {
  stores.forEach(store => store.getState().stopRealtime?.())
}
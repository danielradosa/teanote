import { useAuthStore } from '../stores/useAuthStore'
import { useTeasStore } from '../stores/useTeasStore'
import { useBrewsStore } from '../stores/useBrewsStore'
import { useJournalsStore } from '../stores/useJournalsStore'
import { useSettingsStore } from '../stores/useSettingsStore'

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function exportTeanoteDataAsJson() {
  const { user } = useAuthStore.getState()

  const teasState = useTeasStore.getState()
  const brewsState = useBrewsStore.getState()
  const journalsState = useJournalsStore.getState()
  const settingsState = useSettingsStore.getState()

  const payload = {
    schema: 'teanote.export.v1',
    exportedAt: new Date().toISOString(),
    user: user ? { id: user.id, email: (user as any)?.email } : null,
    data: {
      teas: teasState.teas,
      brews: brewsState.brews,
      presets: brewsState.presets,
      journals: journalsState.journals,
      settings: settingsState.settings,
    },
  }

  const safeDate = payload.exportedAt.slice(0, 10)
  const filename = `teanote-export-${safeDate}.json`
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  downloadBlob(filename, blob)
}

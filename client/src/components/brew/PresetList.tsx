import PresetItem from '@/components/brew/PresetItem'
import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'
import { t } from 'i18next'

interface PresetListProps {
    presets: Preset[]
    teas: Tea[]
    onEdit: (preset: Preset) => void
    onDelete: (id: string) => void
    onSyncType: (presetId: string, newType: string) => void
}

export default function PresetList({ presets, teas, onEdit, onDelete, onSyncType }: PresetListProps) {
    return (
        <div style={{ marginTop: '16px' }}>
            <h2>{t('presets_all_title')}</h2>
            <ul className="brew-list">
                {presets.length === 0 && <p>{t('presets_none')}</p>}
                {presets.map(preset => (
                    <PresetItem
                        key={preset.id}
                        preset={preset}
                        teas={teas}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onSyncType={onSyncType}
                    />
                ))}
            </ul>
        </div>
    )
}

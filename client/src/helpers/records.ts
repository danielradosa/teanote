import type { Journal } from '@/types/Journal'
import type { Preset } from '@/types/Brew'
import type { Tea } from '@/types/Tea'

// Records as the server's tables take them (supabase/schema-snapshot.sql). A
// store passes each record it builds through these (add and update), and
// syncData passes every stored record through them before sending, so a
// record an older version left in localStorage is repaired on the next sync.
// They only change what the server would refuse, and date a journal or tea
// stored without dateAdded; updated_at is never touched, so a repair does not
// count as an edit and cannot win over a newer server copy.

const INT4_MIN = -2147483648
const INT4_MAX = 2147483647

/**
 * A number as a Postgres integer column takes it: a fraction is rounded to
 * the nearest whole number, and the result is kept within the integer range.
 * Non-finite numbers are left as they are (JSON already sends them as null).
 */
export function toInteger(value: number): number {
    if (!Number.isFinite(value)) return value
    return Math.min(INT4_MAX, Math.max(INT4_MIN, Math.round(value)))
}

/**
 * dateAdded is when the journal or tea was written on the device. Older
 * versions never set it, so the column's default (now()) dated a record by its
 * first insert, days late for one written offline or stuck. A record without
 * it is dated by its own updated_at, the closest it carries; one that has a
 * dateAdded keeps it.
 */
function withDateAdded<T extends { dateAdded?: string; updated_at?: string }>(record: T): T {
    return !record.dateAdded && record.updated_at ? { ...record, dateAdded: record.updated_at } : record
}

/**
 * brew_preset_id is a uuid column, so "no brew" is null there, never '' (the
 * form's empty choice). rating is an integer column: a fraction is rounded, but
 * a rating outside the integer range is left as typed, so the server refuses it
 * as before. The journal form brings a typed rating into 1 to 5; what else a
 * stored rating may become is the owner's call, so there is no range rule here.
 */
export function toJournalRecord<T extends Partial<Journal>>(journal: T): T {
    let record = withDateAdded(journal)
    if (record.brew_preset_id === '') record = { ...record, brew_preset_id: null }
    if (typeof record.rating === 'number' && !Object.is(Math.round(record.rating), record.rating)) {
        record = { ...record, rating: Math.round(record.rating) }
    }
    return record
}

/** A tea needs no repair the server would refuse; only a missing dateAdded is set. */
export function toTeaRecord<T extends Partial<Tea>>(tea: T): T {
    return withDateAdded(tea)
}

/** infusionTimes is an integer[] column: whole seconds. */
export function toPresetRecord<T extends Partial<Preset>>(preset: T): T {
    const times = preset.infusionTimes
    if (!Array.isArray(times)) return preset
    const whole = times.map(toInteger)
    return whole.every((t, i) => Object.is(t, times[i])) ? preset : { ...preset, infusionTimes: whole }
}

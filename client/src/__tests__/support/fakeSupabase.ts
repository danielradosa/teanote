/**
 * In-memory stand-in for the shared Supabase client (`@/utils/supa`), for tests only.
 *
 * It keeps rows per table and answers the query shapes the app uses
 * (`select … eq … order … range`, `upsert`, `update … eq`, `insert … select … single`,
 * `maybeSingle`), realtime channels as no-ops, and the storage calls of the
 * tea photo flow. A test can cap the rows one select returns (as PostgREST's
 * max-rows does), make chosen reads or writes fail, and inspect every call.
 *
 * Writes to the synced tables are checked against their columns (`TABLES`,
 * from supabase/schema-snapshot.sql) the way the server checks them, so a
 * record the real server would refuse is refused here too.
 *
 * Wire it up at the top of a test file:
 *
 *     vi.mock('@/utils/supa', async () => ({
 *         default: (await import('@/__tests__/support/fakeSupabase')).fakeSupabase.client,
 *     }))
 *
 * and call `fakeSupabase.reset()` in `beforeEach`.
 */

export interface Row {
    id: string
    [column: string]: unknown
}

export interface FakeError {
    message: string
    code?: string
}

type ColumnType = 'uuid' | 'text' | 'integer' | 'integer[]' | 'jsonb' | 'timestamp'

interface Column {
    type: ColumnType
    notNull?: boolean
}

/**
 * The columns of the synced tables, as supabase/schema-snapshot.sql declares
 * them ("timestamp" stands for both timestamp types, "text" for varchar too).
 * A write to one of these tables is refused as PostgREST and Postgres refuse
 * it: a key that is not a column (PGRST204), an empty string in a uuid or
 * timestamp column, a fraction or an out-of-range number in an integer column
 * or integer[] element (22P02 / 22007 / 22003), and an explicit null in a
 * not-null column (23502). A uuid is not checked further: the tests use short
 * readable ids.
 */
export const TABLES: Record<string, Record<string, Column>> = {
    brews: {
        id: { type: 'uuid', notNull: true },
        user_id: { type: 'uuid', notNull: true },
        teaId: { type: 'uuid', notNull: true },
        journalId: { type: 'uuid' },
        startedAt: { type: 'timestamp', notNull: true },
        finishedAt: { type: 'timestamp' },
        infusions: { type: 'jsonb', notNull: true },
        notes: { type: 'text' },
        rating: { type: 'integer' },
        created_at: { type: 'timestamp', notNull: true },
        updated_at: { type: 'timestamp', notNull: true },
        deleted_at: { type: 'timestamp' },
        presetId: { type: 'text' },
    },
    journals: {
        id: { type: 'uuid', notNull: true },
        user_id: { type: 'uuid', notNull: true },
        teaId: { type: 'text', notNull: true },
        brew_preset_id: { type: 'uuid' },
        title: { type: 'text', notNull: true },
        rating: { type: 'integer' },
        content: { type: 'text', notNull: true },
        dateAdded: { type: 'timestamp' },
        updated_at: { type: 'timestamp' },
        deleted_at: { type: 'timestamp' },
        images: { type: 'jsonb' },
    },
    presets: {
        id: { type: 'uuid', notNull: true },
        user_id: { type: 'uuid', notNull: true },
        name: { type: 'text', notNull: true },
        teaId: { type: 'uuid' },
        teaType: { type: 'text' },
        infusionsAmount: { type: 'integer', notNull: true },
        infusionTimes: { type: 'integer[]', notNull: true },
        created_at: { type: 'timestamp', notNull: true },
        updated_at: { type: 'timestamp', notNull: true },
        deleted_at: { type: 'timestamp' },
    },
    teas: {
        id: { type: 'uuid', notNull: true },
        user_id: { type: 'uuid', notNull: true },
        name: { type: 'text', notNull: true },
        type: { type: 'text', notNull: true },
        origin: { type: 'text' },
        year: { type: 'text' },
        vendor: { type: 'text' },
        notes: { type: 'text' },
        image: { type: 'text' },
        link: { type: 'text' },
        dateAdded: { type: 'timestamp' },
        updated_at: { type: 'timestamp' },
        deleted_at: { type: 'timestamp' },
        inventory: { type: 'text' },
        image_path: { type: 'text' },
    },
}

const INT4_MIN = -2147483648
const INT4_MAX = 2147483647

function integerError(value: unknown): FakeError | null {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return { code: '22P02', message: `invalid input syntax for type integer: "${String(value)}"` }
    }
    if (value < INT4_MIN || value > INT4_MAX) {
        return { code: '22003', message: `value "${value}" is out of range for type integer` }
    }
    return null
}

function valueError(type: ColumnType, value: unknown): FakeError | null {
    switch (type) {
        case 'uuid':
            return typeof value === 'string' && value !== ''
                ? null
                : { code: '22P02', message: `invalid input syntax for type uuid: "${String(value)}"` }
        case 'timestamp':
            return typeof value === 'string' && value !== ''
                ? null
                : { code: '22007', message: `invalid input syntax for type timestamp: "${String(value)}"` }
        case 'integer':
            return integerError(value)
        case 'integer[]':
            if (!Array.isArray(value)) return { code: '22P02', message: `malformed array literal: "${String(value)}"` }
            for (const item of value) {
                const error = item === null ? null : integerError(item)
                if (error) return error
            }
            return null
        default:
            return null
    }
}

/** What the server says about one row written to `table`, as it arrives over the wire (JSON). */
function schemaError(table: string, row: Record<string, unknown>): FakeError | null {
    const columns = TABLES[table]
    if (!columns) return null
    for (const [key, value] of Object.entries(row)) {
        const column = columns[key]
        if (!column) {
            return { code: 'PGRST204', message: `Could not find the '${key}' column of '${table}' in the schema cache` }
        }
        if (value === null) {
            if (column.notNull) {
                return { code: '23502', message: `null value in column "${key}" of relation "${table}" violates not-null constraint` }
            }
            continue
        }
        const error = valueError(column.type, value)
        if (error) return error
    }
    return null
}

interface Result {
    data: unknown
    error: FakeError | null
}

type Filter = [column: string, value: unknown]

export interface ReadCall {
    table: string
    filters: Filter[]
    order: { column: string; ascending: boolean } | null
    from: number | null
    to: number | null
}

export interface WriteCall {
    table: string
    op: 'insert' | 'upsert' | 'update'
    payload: unknown
    filters: Filter[]
}

export interface SignCall {
    bucket: string
    paths: string[]
    expiresIn: number
}

type WriteFailer = (call: WriteCall, row: Row | null) => FakeError | null

class FakeQuery implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'upsert' | 'update' = 'select'
    private payload: unknown = undefined
    private filters: Filter[] = []
    private orderBy: { column: string; ascending: boolean } | null = null
    private rangeFrom: number | null = null
    private rangeTo: number | null = null
    private singleMode: 'one' | 'maybe' | null = null
    private server: FakeSupabase
    private table: string

    constructor(server: FakeSupabase, table: string) {
        this.server = server
        this.table = table
    }

    select() { return this }
    insert(payload: unknown) { this.op = 'insert'; this.payload = payload; return this }
    upsert(payload: unknown) { this.op = 'upsert'; this.payload = payload; return this }
    update(payload: unknown) { this.op = 'update'; this.payload = payload; return this }
    eq(column: string, value: unknown) { this.filters.push([column, value]); return this }
    order(column: string, options?: { ascending?: boolean }) {
        this.orderBy = { column, ascending: options?.ascending ?? true }
        return this
    }
    range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this }
    limit(count: number) { this.rangeFrom = 0; this.rangeTo = count - 1; return this }
    single() { this.singleMode = 'one'; return this }
    maybeSingle() { this.singleMode = 'maybe'; return this }

    then<A = Result, B = never>(
        onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
        onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
    ): PromiseLike<A | B> {
        return Promise.resolve()
            .then(() => this.server.run(this.table, {
                op: this.op,
                payload: this.payload,
                filters: this.filters,
                order: this.orderBy,
                from: this.rangeFrom,
                to: this.rangeTo,
                single: this.singleMode,
            }))
            .then(onfulfilled, onrejected)
    }
}

function matches(row: Row, filters: Filter[]) {
    return filters.every(([column, value]) => row[column] === value)
}

export class FakeSupabase {
    /** Rows per table, as the server holds them. */
    tables = new Map<string, Row[]>()
    /** Most rows one select may return, like PostgREST's max-rows. */
    maxRows = Infinity
    reads: ReadCall[] = []
    writes: WriteCall[] = []
    /** Return an error to make a read of that table fail. */
    failRead: (table: string) => FakeError | null = () => null
    /** Return an error to make that write fail (for a row-level check, `row` is the row written). */
    failWrite: WriteFailer = () => null

    /** Files in storage, per bucket. */
    files = new Map<string, Set<string>>()
    signCalls: SignCall[] = []
    removeCalls: { bucket: string; paths: string[] }[] = []
    /** Replaces the batch signer's behaviour; return what createSignedUrls returns. */
    signer: ((call: SignCall) => Promise<unknown>) | null = null
    /** Called as storage.remove runs, before the files go: lets a test look at the rows at that moment. */
    onRemove: ((bucket: string, paths: string[]) => void) | null = null

    readonly client = {
        from: (table: string) => new FakeQuery(this, table),
        channel: () => {
            const channel = { on: () => channel, subscribe: () => channel }
            return channel
        },
        removeChannel: () => Promise.resolve('ok'),
        storage: {
            from: (bucket: string) => ({
                upload: async (path: string) => {
                    this.bucket(bucket).add(path)
                    return { data: { path }, error: null }
                },
                createSignedUrl: async (path: string, expiresIn: number) => ({
                    data: { signedUrl: `https://storage.test/${bucket}/${path}?fresh&expires=${expiresIn}` },
                    error: null,
                }),
                createSignedUrls: (paths: string[], expiresIn: number) => {
                    const call = { bucket, paths: [...paths], expiresIn }
                    this.signCalls.push(call)
                    if (this.signer) return this.signer(call)
                    return Promise.resolve({
                        data: paths.map(path => ({
                            path,
                            error: null,
                            signedUrl: `https://storage.test/${bucket}/${path}?sig=${this.signCalls.length}`,
                        })),
                        error: null,
                    })
                },
                remove: async (paths: string[]) => {
                    this.removeCalls.push({ bucket, paths: [...paths] })
                    this.onRemove?.(bucket, [...paths])
                    paths.forEach(p => this.bucket(bucket).delete(p))
                    return { data: [], error: null }
                },
            }),
        },
    }

    reset() {
        this.tables = new Map()
        this.maxRows = Infinity
        this.reads = []
        this.writes = []
        this.failRead = () => null
        this.failWrite = () => null
        this.files = new Map()
        this.signCalls = []
        this.removeCalls = []
        this.signer = null
        this.onRemove = null
    }

    rows(table: string): Row[] {
        if (!this.tables.has(table)) this.tables.set(table, [])
        return this.tables.get(table)!
    }

    row(table: string, id: string): Row | undefined {
        return this.rows(table).find(r => r.id === id)
    }

    seed(table: string, rows: Row[]) {
        this.tables.set(table, rows.map(r => ({ ...r })))
    }

    bucket(name: string): Set<string> {
        if (!this.files.has(name)) this.files.set(name, new Set())
        return this.files.get(name)!
    }

    run(table: string, q: {
        op: 'select' | 'insert' | 'upsert' | 'update'
        payload: unknown
        filters: Filter[]
        order: { column: string; ascending: boolean } | null
        from: number | null
        to: number | null
        single: 'one' | 'maybe' | null
    }): Result {
        if (q.op === 'select') {
            this.reads.push({ table, filters: q.filters, order: q.order, from: q.from, to: q.to })
            const readError = this.failRead(table)
            if (readError) return { data: null, error: readError }

            let rows = this.rows(table).filter(r => matches(r, q.filters))
            if (q.order) {
                const { column, ascending } = q.order
                rows = [...rows].sort((a, b) => {
                    const cmp = String(a[column]).localeCompare(String(b[column]))
                    return ascending ? cmp : -cmp
                })
            }
            const start = q.from ?? 0
            const end = q.to === null ? rows.length : q.to + 1
            rows = rows.slice(start, end).slice(0, this.maxRows).map(r => ({ ...r }))

            if (q.single) {
                if (rows.length === 0) {
                    return q.single === 'maybe'
                        ? { data: null, error: null }
                        : { data: null, error: { message: 'no rows' } }
                }
                return { data: rows[0], error: null }
            }
            return { data: rows, error: null }
        }

        const call: WriteCall = { table, op: q.op, payload: q.payload, filters: q.filters }
        this.writes.push(call)

        if (q.op === 'update') {
            const patch = JSON.parse(JSON.stringify(q.payload)) as Record<string, unknown>
            const error = schemaError(table, patch) ?? this.failWrite(call, null)
            if (error) return { data: null, error }
            this.tables.set(table, this.rows(table).map(r => matches(r, q.filters) ? { ...r, ...patch } : r))
            return { data: null, error: null }
        }

        const incoming = (Array.isArray(q.payload) ? q.payload : [q.payload]) as Row[]
        for (const row of incoming) {
            const error = schemaError(table, JSON.parse(JSON.stringify(row))) ?? this.failWrite(call, row)
            if (error) return { data: null, error }
        }
        const table_ = this.rows(table)
        for (const row of incoming) {
            const withId = { ...row, id: row.id ?? `generated-${table_.length + 1}` }
            const i = table_.findIndex(r => r.id === withId.id)
            // JSON over the wire drops undefined, so a missing column keeps its value on the server.
            const sent = JSON.parse(JSON.stringify(withId)) as Row
            if (i >= 0) table_[i] = { ...table_[i], ...sent }
            else table_.push(sent)
        }
        const written = incoming.map(r => ({ ...r }))
        return { data: q.single ? written[0] : written, error: null }
    }
}

export const fakeSupabase = new FakeSupabase()

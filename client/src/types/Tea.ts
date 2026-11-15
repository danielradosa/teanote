export interface Tea {
    id: string
    user_id?: string
    name: string
    type: 'green' | 'purple' | 'red' | 'white' | 'yellow' | 'puerh' | 'oolong'
    inventory: string
    origin?: string
    year?: string
    vendor?: string
    notes?: string
    /** Storage path of an uploaded photo in the "teas" bucket; null once the photo is removed. */
    image_path?: string | null
    /** External image URL. Older records may also hold an expired signed link here, which is ignored when image_path is set. */
    image?: string
    link?: string
    dateAdded?: string
    updated_at: string
    deleted_at?: string | null
}
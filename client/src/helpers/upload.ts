import supabase from '../utils/supa'

export type BucketType = 'teas' | 'sessions'

interface UploadResult {
    path: string
    signedUrl: string
}

export async function uploadImage(
    bucket: BucketType,
    file: File,
    userId: string
): Promise<UploadResult> {
    if (!userId) throw new Error('User not authenticated')

    const ext = file.name.split('.').pop() || 'png'
    const fileName = `${crypto.randomUUID()}.${ext}`
    const filePath = `${userId}/${fileName}`

    const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
            upsert: true,
            contentType: file.type
        })

    if (uploadError) throw uploadError

    const { data, error: urlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60)

    if (urlError || !data?.signedUrl) {
        throw urlError || new Error('Failed creating signed URL')
    }

    return {
        path: filePath,
        signedUrl: data.signedUrl
    }
}

export async function deleteImage(
    bucket: BucketType,
    path: string
) {
    if (!path) return

    const { error } = await supabase.storage
        .from(bucket)
        .remove([path])

    if (error) throw error
}
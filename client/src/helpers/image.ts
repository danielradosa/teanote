export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const COMPRESS_THRESHOLD_BYTES = 500 * 1024
const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

export interface ImageValidationError {
    kind: 'too-big' | 'bad-type'
}

export function validateImage(file: File): ImageValidationError | null {
    if (!file.type.startsWith('image/')) return { kind: 'bad-type' }
    if (file.size > MAX_UPLOAD_BYTES) return { kind: 'too-big' }
    return null
}

export async function compressImageIfNeeded(file: File): Promise<File> {
    if (file.size <= COMPRESS_THRESHOLD_BYTES) return file
    if (file.type === 'image/gif') return file // animated gifs would lose frames

    const url = URL.createObjectURL(file)
    try {
        const img = await loadImage(url)
        const { width, height } = scaleDown(img.width, img.height, MAX_DIMENSION)

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return file
        ctx.drawImage(img, 0, 0, width, height)

        const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY)
        if (!blob || blob.size >= file.size) return file

        const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
    } catch {
        return file
    } finally {
        URL.revokeObjectURL(url)
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('image decode failed'))
        img.src = src
    })
}

function scaleDown(w: number, h: number, max: number): { width: number; height: number } {
    if (w <= max && h <= max) return { width: w, height: h }
    const ratio = Math.min(max / w, max / h)
    return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

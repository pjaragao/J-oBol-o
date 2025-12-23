import { createClient } from './server'

/**
 * Downloads an image from an external URL and uploads it to Supabase Storage.
 * Returns the public URL of the localized image.
 */
export async function localizeExternalImage(
    externalUrl: string,
    bucket: string,
    fileName: string
): Promise<string | null> {
    if (!externalUrl) return null

    try {
        const supabase = await createClient()

        // 1. Check if it's already localized (internal URL)
        const { data: { publicUrl: currentUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)

        // This is a bit tricky to verify if it exists, so let's try to head the URL or just download.
        // For simplicity, we'll download and overwrite if necessary, or check existence.

        // 2. Fetch the external image
        const response = await fetch(externalUrl)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

        const blob = await response.blob()
        const contentType = response.headers.get('content-type') || 'image/png'

        // 3. Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(fileName, blob, {
                contentType,
                upsert: true
            })

        if (uploadError) throw uploadError

        // 4. Return the new public URL
        const { data } = supabase.storage.from(bucket).getPublicUrl(fileName)
        return data.publicUrl

    } catch (error) {
        console.error(`Error localizing image from ${externalUrl}:`, error)
        return externalUrl // Fallback to external URL if localization fails
    }
}

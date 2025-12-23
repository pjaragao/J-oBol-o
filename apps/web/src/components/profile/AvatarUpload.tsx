'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AvatarUploadProps {
    uid: string
    url: string | null
    onUpload: (url: string) => void
}

export default function AvatarUpload({ uid, url, onUpload }: AvatarUploadProps) {
    const supabase = createClient()
    const [avatarUrl, setAvatarUrl] = useState<string | null>(url)
    const [uploading, setUploading] = useState(false)

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true)

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.')
            }

            const file = event.target.files[0]
            const fileExt = file.name.split('.').pop()
            const filePath = `${uid}-${Math.random()}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            // Get public URL
            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

            setAvatarUrl(data.publicUrl)
            onUpload(data.publicUrl)

        } catch (error: any) {
            alert('Error uploading avatar: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-gray-100">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                        👤
                    </div>
                )}
                {uploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center text-white text-xs">
                        Uploading...
                    </div>
                )}
            </div>

            <div className="relative">
                <input
                    type="file"
                    id="single"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <label
                    htmlFor="single"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md cursor-pointer hover:bg-indigo-700 text-sm font-medium"
                >
                    {uploading ? 'Enviando...' : 'Alterar Foto'}
                </label>
            </div>
        </div>
    )
}

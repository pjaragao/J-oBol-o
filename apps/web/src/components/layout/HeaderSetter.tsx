'use client'

import * as React from 'react'
import { useLayout } from './LayoutContext'

interface HeaderSetterProps {
    title?: string | React.ReactNode
    content?: React.ReactNode
}

export function HeaderSetter({ title, content }: HeaderSetterProps) {
    const { setHeaderTitle, setHeaderContent } = useLayout()

    React.useEffect(() => {
        if (title !== undefined) setHeaderTitle(title)
        if (content !== undefined) setHeaderContent(content)

        return () => {
            // Reset on unmount
            if (title !== undefined) setHeaderTitle('JãoBolão')
            if (content !== undefined) setHeaderContent(null)
        }
    }, [title, content, setHeaderTitle, setHeaderContent])

    return null
}

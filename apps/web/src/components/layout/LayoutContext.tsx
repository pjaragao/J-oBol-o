'use client'

import * as React from 'react'

interface LayoutContextType {
    headerTitle: string | React.ReactNode
    setHeaderTitle: (title: string | React.ReactNode) => void
    headerContent: React.ReactNode | null
    setHeaderContent: (content: React.ReactNode | null) => void
}

const LayoutContext = React.createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const [headerTitle, setHeaderTitle] = React.useState<string | React.ReactNode>('JãoBolão')
    const [headerContent, setHeaderContent] = React.useState<React.ReactNode | null>(null)

    return (
        <LayoutContext.Provider value={{ headerTitle, setHeaderTitle, headerContent, setHeaderContent }}>
            {children}
        </LayoutContext.Provider>
    )
}

export function useLayout() {
    const context = React.useContext(LayoutContext)
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider')
    }
    return context
}

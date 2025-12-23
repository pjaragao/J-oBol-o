'use client'

import * as React from 'react'
import { AppSidebar } from './AppSidebar'
import { AppHeader } from './AppHeader'

interface AppLayoutProps {
    children: React.ReactNode
    user?: any
    profile?: any
    isAdmin?: boolean
}

export function AppLayout({ children, user, profile, isAdmin }: AppLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = React.useState(false)

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <AppSidebar
                isOpen={sidebarOpen}
                setIsOpen={setSidebarOpen}
                isAdmin={isAdmin}
            />

            <div className="flex flex-1 flex-col overflow-hidden">
                <AppHeader
                    setSidebarOpen={setSidebarOpen}
                    user={user}
                    profile={profile}
                />

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}

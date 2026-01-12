import { cn } from "@/lib/utils"
import { Shield } from "lucide-react"

interface Team {
    name: string
    short_name: string
    tla?: string
    logo_url?: string
}

interface TeamNameProps {
    team: Team
    variant?: 'auto' | 'full' | 'short' | 'tla' | 'logo'
    className?: string
    showLogo?: boolean
}

export function TeamName({
    team,
    variant = 'auto',
    className,
    showLogo = false
}: TeamNameProps) {
    // Helper to get names safely
    const fullName = team.name
    const shortName = team.short_name || team.name
    const tla = team.tla || team.short_name?.substring(0, 3).toUpperCase() || team.name.substring(0, 3).toUpperCase()

    const logo = (
        <img
            src={team.logo_url}
            alt={fullName}
            className="w-5 h-5 object-contain shrink-0"
            onError={(e) => {
                e.currentTarget.style.display = 'none'
            }}
        />
    )

    const fallbackLogo = (
        <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
            <Shield className="w-3 h-3 text-slate-400" />
        </div>
    )

    if (variant === 'logo') {
        return team.logo_url ? logo : fallbackLogo
    }

    return (
        <div className={cn("flex items-center gap-2 min-w-0 select-none", className)}>
            {showLogo && (team.logo_url ? logo : fallbackLogo)}

            {variant === 'auto' ? (
                <>
                    {/* Mobile: TLA (always visible on small, hidden on sm+) */}
                    <span className={cn("truncate sm:hidden", showLogo ? "text-[10px]" : "")}>
                        {tla}
                    </span>
                    {/* Desktop: Short Name (hidden on small, visible on sm+) */}
                    <span className={cn("truncate hidden sm:inline")}>
                        {shortName}
                    </span>
                </>
            ) : (
                <span className="truncate">
                    {variant === 'full' && fullName}
                    {variant === 'short' && shortName}
                    {variant === 'tla' && tla}
                </span>
            )}
        </div>
    )
}

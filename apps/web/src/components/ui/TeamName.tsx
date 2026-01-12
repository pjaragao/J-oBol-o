import { cn } from "@/lib/utils"

interface TeamNameProps {
    team: {
        name?: string
        short_name?: string
        tla?: string
        logo_url?: string
    }
    variant?: 'full' | 'short' | 'tla' | 'logo' | 'auto'
    showLogo?: boolean
    className?: string
    logoClassName?: string
}

export function TeamName({
    team,
    variant = 'auto',
    showLogo = false,
    className,
    logoClassName
}: TeamNameProps) {
    if (!team) return null

    const logo = team.logo_url && (
        <img
            src={team.logo_url}
            alt={team.name || 'Team'}
            className={cn("w-6 h-6 object-contain", logoClassName)}
            onError={(e) => (e.currentTarget.style.display = 'none')}
        />
    )

    // Helper to render text with priority fallback
    const renderText = () => {
        // Explicit variants
        if (variant === 'full') return team.name || team.short_name || team.tla
        if (variant === 'short') return team.short_name || team.name || team.tla
        if (variant === 'tla') return team.tla || team.short_name?.substring(0, 3).toUpperCase() || team.name?.substring(0, 3).toUpperCase()
        if (variant === 'logo') return null

        // Auto variant (responsive)
        return (
            <>
                {/* Desktop: Full Name */}
                <span className="hidden lg:inline truncate text-ellipsis">{team.name}</span>

                {/* Tablet: Short Name */}
                <span className="hidden sm:inline lg:hidden truncate text-ellipsis">{team.short_name || team.name}</span>

                {/* Mobile: TLA (or short name if TLA missing) */}
                <span className="sm:hidden inline">{team.tla || team.short_name || team.name?.substring(0, 3).toUpperCase()}</span>
            </>
        )
    }

    return (
        <div className={cn("flex items-center gap-2 min-w-0 select-none", className)} title={team.name}>
            {showLogo && logo}
            <span className={cn("truncate", variant === 'logo' && "sr-only")}>
                {renderText()}
            </span>
        </div>
    )
}

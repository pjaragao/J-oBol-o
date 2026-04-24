import { View, Text, ViewProps } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);
const StyledText = styled(Text);

interface BadgeProps extends ViewProps {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
}

export function Badge({ label, variant = 'default', className, ...props }: BadgeProps) {
    const variants = {
        default: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200",
        success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
        warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        destructive: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
        outline: "bg-transparent border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400",
    };

    return (
        <StyledView className={`px-2.5 py-0.5 rounded-full self-start ${variants[variant]} ${className}`} {...props}>
            <StyledText className={`text-[10px] font-bold uppercase tracking-wider ${className}`}>
                {label}
            </StyledText>
        </StyledView>
    );
}

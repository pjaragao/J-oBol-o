import { View, ViewProps } from 'react-native';
import { styled } from 'nativewind';

const StyledView = styled(View);

export function Card({ className, ...props }: ViewProps) {
    return (
        <StyledView
            className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: ViewProps) {
    return <StyledView className={`p-4 border-b border-slate-100 dark:border-slate-700/50 ${className}`} {...props} />;
}

export function CardContent({ className, ...props }: ViewProps) {
    return <StyledView className={`p-4 ${className}`} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
    return <StyledView className={`p-4 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/50 flex-row items-center justify-between ${className}`} {...props} />;
}

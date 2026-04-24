import { Text, TouchableOpacity, ActivityIndicator, TouchableOpacityProps } from 'react-native';
import { styled } from 'nativewind';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    isLoading?: boolean;
}

export function Button({ title, variant = 'primary', isLoading, className, disabled, ...props }: ButtonProps) {
    const baseStyles = "h-12 rounded-xl flex-row items-center justify-center px-4";

    const variants = {
        primary: "bg-green-600 active:bg-green-700",
        secondary: "bg-slate-200 active:bg-slate-300 dark:bg-slate-800 dark:active:bg-slate-700",
        outline: "bg-transparent border border-slate-300 dark:border-slate-600 active:bg-slate-50 dark:active:bg-slate-800",
        ghost: "bg-transparent active:bg-slate-100 dark:active:bg-slate-800",
        destructive: "bg-red-600 active:bg-red-700",
    };

    const textVariants = {
        primary: "text-white font-bold text-base",
        secondary: "text-slate-900 dark:text-white font-bold text-base",
        outline: "text-slate-700 dark:text-slate-200 font-medium text-base",
        ghost: "text-slate-600 dark:text-slate-300 font-medium text-base",
        destructive: "text-white font-bold text-base",
    };

    return (
        <StyledTouchableOpacity
            className={`${baseStyles} ${variants[variant]} ${disabled || isLoading ? 'opacity-50' : ''} ${className}`}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading ? (
                <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#475569' : '#ffffff'} />
            ) : (
                <StyledText className={textVariants[variant]}>
                    {title}
                </StyledText>
            )}
        </StyledTouchableOpacity>
    );
}

import { View, Text, TextInput, TextInputProps } from 'react-native';
import { styled } from 'nativewind';

const StyledTextInput = styled(TextInput);
const StyledText = styled(Text);
const StyledView = styled(View);

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
    return (
        <StyledView className="w-full space-y-2 mb-4">
            {label && (
                <StyledText className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                </StyledText>
            )}
            <StyledTextInput
                className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:border-green-500 dark:focus:border-green-400 ${error ? 'border-red-500' : ''} ${className}`}
                placeholderTextColor="#94a3b8"
                {...props}
            />
            {error && (
                <StyledText className="text-xs text-red-500 font-medium">
                    {error}
                </StyledText>
            )}
        </StyledView>
    );
}

import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'white' },
            }}
        >
            <Stack.Screen
                name="login"
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="register"
                options={{
                    headerShown: true,
                    presentation: 'card',
                    headerTitle: '',
                    headerTransparent: true,
                }}
            />
        </Stack>
    );
}

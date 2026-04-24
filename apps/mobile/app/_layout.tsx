import { registerForPushNotificationsAsync, syncPushToken } from '@/lib/notifications';

export default function RootLayout() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
            if (session) {
                registerForPushNotificationsAsync().then(token => {
                    if (token) syncPushToken(token);
                });
            }
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                registerForPushNotificationsAsync().then(token => {
                    if (token) syncPushToken(token);
                });
            }
        });
    }, []);

    return (
        <Stack screenOptions={{ headerShown: false }}>
            {/* 
         In Expo Router, file-based routing handles navigation.
         We can protect routes here or inside the screens.
         For simplicity, we'll let screens redirect if not auth.
       */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/login" options={{ presentation: 'modal' }} />
        </Stack>
    );
}

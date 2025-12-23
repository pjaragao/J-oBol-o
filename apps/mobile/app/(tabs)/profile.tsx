import { View, Text, Button, StyleSheet } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function ProfileScreen() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    }, []);

    async function handleSignOut() {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Perfil</Text>

            <View style={styles.infoContainer}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{user?.email}</Text>
            </View>

            <View style={styles.buttonContainer}>
                <Button title="Sair" onPress={handleSignOut} color="#ef4444" />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#f9fafb',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 40,
        marginBottom: 20,
    },
    infoContainer: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 8,
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    value: {
        fontSize: 16,
        fontWeight: '500',
    },
    buttonContainer: {
        marginTop: 'auto',
        marginBottom: 20,
    }
});

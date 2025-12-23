import { View, Text, StyleSheet, Button } from 'react-native';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export default function HomeScreen() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
            setLoading(false)
        })
    }, []);

    if (loading) return <View style={styles.container}><Text>Carregando...</Text></View>

    if (!session) {
        // In a real app, you would redirect to /login
        // For now rendering login prompt
        return (
            <View style={styles.container}>
                <Text style={styles.title}>JãoBolão Mobile</Text>
                <Text>Você precisa fazer login.</Text>
            </View>
        )
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bem-vindo ao JãoBolão!</Text>
            <Text style={styles.subtitle}>Dashboard Mobile</Text>

            <View style={styles.card}>
                <Text>Seus Grupos: 0</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: 'gray',
        marginBottom: 20,
    },
    card: {
        padding: 20,
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        width: '100%',
        alignItems: 'center',
    }
});

import { View, Text, Image } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';

export default function ProfileScreen() {
    const router = useRouter();
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
    };

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 pt-20">
            <View className="items-center mb-10">
                <View className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full items-center justify-center mb-4 border-2 border-slate-300 dark:border-slate-700">
                    <Text className="text-4xl">👤</Text>
                </View>
                <Text className="text-xl font-bold text-slate-900 dark:text-white">
                    {session?.user?.email || 'Usuário'}
                </Text>
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                    Membro desde 2024
                </Text>
            </View>

            <View className="space-y-4">
                <Button
                    title="Editar Perfil"
                    variant="outline"
                    onPress={() => alert('Em breve')}
                />

                <Button
                    title="Sair da Conta"
                    variant="destructive"
                    onPress={handleLogout}
                />
            </View>

            <View className="mt-auto items-center">
                <Text className="text-xs text-slate-400">JãoBolão Mobile v1.0.0</Text>
            </View>
        </View>
    );
}

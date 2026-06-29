import { View, Text, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, Link } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signInWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Erro no Login', error.message);
        } else {
            router.replace('/(tabs)');
        }
        setLoading(false);
    }

    async function handleForgotPassword() {
        if (!email.trim()) {
            Alert.alert('E-mail necessário', 'Por favor, digite seu e-mail no campo de email acima.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: 'https://jaobolao.com.br/auth/callback?next=/reset-password',
            });

            if (error) {
                Alert.alert('Erro', error.message);
            } else {
                Alert.alert('Sucesso', 'Um link de recuperação de senha foi enviado para o seu e-mail.');
            }
        } catch (err: any) {
            Alert.alert('Erro', err.message || 'Erro ao solicitar recuperação de senha.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white dark:bg-slate-950"
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
                <View className="items-center mb-8">
                    {/* Placeholder for Logo */}
                    <View className="h-20 w-20 bg-green-100 rounded-2xl items-center justifyContent-center mb-4">
                        <Text className="text-4xl">⚽</Text>
                    </View>
                    <Text className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        JãoBolão
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 mt-2 text-center">
                        Entre para gerenciar seus bolões and palpites.
                    </Text>
                </View>

                <View className="space-y-4 w-full max-w-sm mx-auto">
                    <Input
                        label="Email"
                        placeholder="seu@email.com"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <Input
                        label="Senha"
                        placeholder="••••••••"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    <Button
                        title="Entrar na minha conta"
                        onPress={signInWithEmail}
                        isLoading={loading}
                        className="mt-4"
                    />

                    <Link href="/(auth)/register" asChild>
                        <Button
                            title="Criar nova conta"
                            variant="outline"
                            className="mt-2"
                        />
                    </Link>

                    <Button
                        title="Esqueci minha senha"
                        variant="ghost"
                        className="mt-2"
                        onPress={handleForgotPassword}
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

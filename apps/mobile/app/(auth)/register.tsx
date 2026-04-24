import { View, Text, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, Stack } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function signUpWithEmail() {
        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Erro no Cadastro', error.message);
        } else {
            Alert.alert(
                'Sucesso!',
                'Verifique seu email para confirmar o cadastro.',
                [{ text: 'OK', onPress: () => router.back() }]
            );
        }
        setLoading(false);
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-white dark:bg-slate-950"
        >
            <Stack.Screen options={{ title: 'Criar Conta', headerBackTitle: 'Voltar' }} />

            <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
                <View className="mb-8">
                    <Text className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Criar Conta
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 mt-2">
                        Junte-se ao JãoBolão e comece a palpitar.
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
                        placeholder="Crie uma senha segura"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                    />

                    <Button
                        title="Criar minha conta"
                        onPress={signUpWithEmail}
                        isLoading={loading}
                        className="mt-4"
                    />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

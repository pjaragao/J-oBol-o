import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { GroupCard } from '@/components/GroupCard';
import { useRouter, Stack } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

export default function HomeScreen() {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();

    async function fetchGroups() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data, error } = await supabase
                .from('group_members')
                .select(`
                    role,
                    groups (
                        id,
                        name,
                        description,
                        is_public,
                        is_paid,
                        entry_fee,
                        events (
                            name,
                            logo_url
                        )
                    )
                `)
                .eq('user_id', session.user.id);

            if (error) {
                console.error('Error fetching groups:', error);
                return;
            }

            // Flatten data structure
            const formattedGroups = data.map((item: any) => ({
                ...item.groups,
                role: item.role,
                status: 'approved'
            }));

            setGroups(formattedGroups);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useFocusEffect(
        useCallback(() => {
            fetchGroups();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchGroups();
    }, []);

    // Helper to calculate mock ranking for now (since we don't have full ranking logic ported yet)
    const getMockRanking = (groupId: string) => ({ rank: 1, total: 10 }); // TODO: Implement real ranking

    if (loading && !refreshing) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-slate-950">
                <ActivityIndicator size="large" color="#16a34a" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-950 px-4 pt-4">
            <Stack.Screen options={{ title: 'Meus Grupos' }} />

            <FlatList
                data={groups}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <GroupCard
                        group={item}
                        role={item.role}
                        status={item.status}
                        ranking={getMockRanking(item.id)}
                        memberCount={1} // TODO: Fetch real count
                        onPress={() => router.push(`/groups/${item.id}`)}
                    />
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center py-10 mt-10 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <MaterialIcons name="emoji-events" size={48} color="#cbd5e1" />
                        <Text className="text-slate-500 dark:text-slate-400 mt-4 text-center font-medium">
                            Você ainda não participa de nenhum grupo.
                        </Text>
                        <Button
                            title="Criar Primeiro Grupo"
                            onPress={() => router.push('/groups/create')}
                            className="mt-6"
                        />
                        <Button
                            title="Buscar Grupos Públicos"
                            variant="outline"
                            onPress={() => router.push('/(tabs)/search')}
                            className="mt-3"
                        />
                    </View>
                }
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
                }
                contentContainerStyle={{ paddingBottom: 100 }}
            />
        </View>
    );
}

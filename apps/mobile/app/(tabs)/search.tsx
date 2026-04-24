import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { GroupCard } from '@/components/GroupCard';
import { useRouter, Stack } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce'; // We need to create this or impl simple timeout
import { MaterialIcons } from '@expo/vector-icons';

export default function SearchScreen() {
    const [query, setQuery] = useState('');
    const debouncedQuery = useDebounce(query, 500);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (debouncedQuery.length >= 3) {
            handleSearch(debouncedQuery);
        } else {
            setResults([]);
            setSearched(false);
        }
    }, [debouncedQuery]);

    const handleSearch = async (text: string) => {
        setLoading(true);
        setSearched(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Search public groups
            const { data: groups, error } = await supabase
                .from('groups')
                .select(`
                    id,
                    name,
                    description,
                    is_public,
                    is_paid,
                    entry_fee,
                    payment_method,
                    events ( 
                        name,
                        logo_url,
                        online_fee_percent
                    )
                `)
                .eq('is_public', true)
                .ilike('name', `%${text}%`)
                .limit(20);

            if (error) throw error;
            if (!groups || groups.length === 0) {
                setResults([]);
                return;
            }

            // 2. Filter out my groups (client side for simplicity in mobile, or optimized query)
            // Ideally we do this with an RPC or exclusion query, but for now:
            const { data: myMemberships } = await supabase
                .from('group_members')
                .select('group_id')
                .eq('user_id', user.id);

            const myGroupIds = new Set(myMemberships?.map(m => m.group_id));
            const availableGroups = groups.filter(g => !myGroupIds.has(g.id));

            // 3. Fetch counts (mocked or aggregated)
            // For MVP mobile, we can fetch distinct counts or just use a simple approach
            // We'll iterate and fetch count (not efficient, but works for MVP) or assumes count view exists

            // Better: Get counts for displayed groups
            const groupIds = availableGroups.map(g => g.id);
            if (groupIds.length > 0) {
                const { data: counts } = await supabase
                    .from('group_members')
                    .select('group_id')
                    .in('group_id', groupIds);

                const countMap = new Map();
                counts?.forEach(c => {
                    countMap.set(c.group_id, (countMap.get(c.group_id) || 0) + 1);
                });

                const enriched = availableGroups.map(g => ({
                    ...g,
                    memberCount: countMap.get(g.id) || 0
                }));
                setResults(enriched);
            } else {
                setResults([]);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-950 px-4 pt-4">
            <Stack.Screen options={{ title: 'Explorar', headerLargeTitle: true }} />

            <View className="mb-4">
                <Input
                    placeholder="Buscar grupos (min. 3 letras)"
                    value={query}
                    onChangeText={setQuery}
                    className="mb-0"
                />
            </View>

            {loading ? (
                <ActivityIndicator className="mt-10" color="#16a34a" />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <GroupCard
                            group={item}
                            memberCount={item.memberCount}
                            onPress={() => router.push(`/groups/join?code=${item.id}`)}
                        />
                    )}
                    ListEmptyComponent={
                        searched ? (
                            <View className="items-center justify-center py-10">
                                <Text className="text-slate-500 font-medium">Nenhum grupo encontrado.</Text>
                            </View>
                        ) : (
                            <View className="items-center justify-center py-10 opacity-50">
                                <MaterialIcons name="search" size={64} color="#cbd5e1" />
                                <Text className="text-slate-500 mt-4 text-center">
                                    Pesquise por nome do grupo para encontrar e participar.
                                </Text>
                            </View>
                        )
                    }
                />
            )}
        </View>
    );
}

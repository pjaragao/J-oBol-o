import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MatchCard } from '@/components/MatchCard';
import { styled } from 'nativewind';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const StyledText = styled(Text);
const StyledView = styled(View);

export default function GroupDetailsScreen() {
    const { id } = useLocalSearchParams();
    const [group, setGroup] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [bets, setBets] = useState<Map<string, any>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'matches' | 'ranking'>('matches');

    useEffect(() => {
        fetchGroupDetails();
    }, [id]);

    async function fetchGroupDetails() {
        if (!id) return;
        try {
            // 1. Fetch Group Info
            const { data: groupData, error: groupError } = await supabase
                .from('groups')
                .select(`
                    id, name, description, is_paid, entry_fee,
                    events ( id, name, logo_url )
                `)
                .eq('id', id)
                .single();

            if (groupError) throw groupError;
            setGroup(groupData);

            // 2. Fetch Matches
            if (groupData.events?.id) {
                const { data: matchesData } = await supabase
                    .from('matches')
                    .select(`
                        id, timestamp, status, home_score, away_score,
                        home_team:teams!home_team_id(name, badge_url, iso_code),
                        away_team:teams!away_team_id(name, badge_url, iso_code)
                    `)
                    .eq('event_id', groupData.events.id)
                    .order('timestamp', { ascending: true });

                setMatches(matchesData || []);

                // 3. Fetch User Bets
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: userBets } = await supabase
                        .from('bets')
                        .select('*')
                        .eq('group_id', id)
                        .eq('user_id', user.id);

                    const betsMap = new Map();
                    userBets?.forEach(b => betsMap.set(b.match_id, b));
                    setBets(betsMap);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleBetChange(matchId: string, homeScore: string, awayScore: string) {
        // Update local state optimistic
        const currentBet = bets.get(matchId) || {};
        const newBet = {
            ...currentBet,
            home_score: homeScore === '' ? null : parseInt(homeScore),
            away_score: awayScore === '' ? null : parseInt(awayScore)
        };

        const newBets = new Map(bets);
        newBets.set(matchId, newBet);
        setBets(newBets);

        // Save to Supabase (debounced ideally, but here direct for simplicity or use useEffect debounce hook)
        // For MVP, simple direct upsert on blur or delay 
        // We'll trust the user typing speed or add simple timeout

        if (homeScore !== '' && awayScore !== '') {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !id) return;

            await supabase
                .from('bets')
                .upsert({
                    match_id: matchId,
                    group_id: id,
                    user_id: user.id,
                    home_score: parseInt(homeScore),
                    away_score: parseInt(awayScore)
                }, { onConflict: 'match_id, group_id, user_id' });
        }
    }

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-50 dark:bg-slate-950">
                <ActivityIndicator size="large" color="#16a34a" />
            </View>
        );
    }

    if (!group) return <View><Text>Grupo não encontrado</Text></View>;

    return (
        <View className="flex-1 bg-slate-50 dark:bg-slate-950">
            <Stack.Screen options={{ title: group.name }} />

            {/* Tabs */}
            <View className="flex-row bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <TabButton
                    title="Palpites"
                    isActive={activeTab === 'matches'}
                    onPress={() => setActiveTab('matches')}
                    icon="sports-soccer"
                />
                <TabButton
                    title="Classificação"
                    isActive={activeTab === 'ranking'}
                    onPress={() => setActiveTab('ranking')}
                    icon="leaderboard"
                />
            </View>

            {/* Content */}
            {activeTab === 'matches' ? (
                <FlatList
                    data={matches}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ padding: 16 }}
                    renderItem={({ item }) => (
                        <MatchCard
                            match={item}
                            bet={bets.get(item.id)}
                            isEditable={item.status === 'SCHEDULED'}
                            onBetChange={(h, a) => handleBetChange(item.id, h, a)}
                        />
                    )}
                />
            ) : (
                <RankingView group={group} />
            )}
        </View>
    );
}

function TabButton({ title, isActive, onPress, icon }: any) {
    return (
        <TouchableOpacity
            onPress={onPress}
            className={`flex-1 flex-row items-center justify-center p-4 border-b-2 ${isActive ? 'border-green-600 bg-green-50/50 dark:bg-green-900/10' : 'border-transparent'}`}
        >
            <MaterialIcons name={icon} size={20} color={isActive ? '#16a34a' : '#64748b'} style={{ marginRight: 8 }} />
            <Text className={`font-bold ${isActive ? 'text-green-600' : 'text-slate-500'}`}>
                {title}
            </Text>
        </TouchableOpacity>
    );
}

function RankingView({ group }: any) {
    return (
        <View className="flex-1 justify-center items-center p-8">
            <FontAwesome5 name="trophy" size={48} color="#cbd5e1" />
            <Text className="text-slate-500 mt-4 text-center">
                Classificação em breve.
            </Text>
        </View>
    );
}

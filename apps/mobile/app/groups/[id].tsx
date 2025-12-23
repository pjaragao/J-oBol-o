import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function GroupParams() {
    const { id } = useLocalSearchParams();
    const [group, setGroup] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);

    // Betting state
    const [homeScore, setHomeScore] = useState('');
    const [awayScore, setAwayScore] = useState('');

    useEffect(() => {
        async function fetchGroupDetails() {
            try {
                const { data: groupData, error: groupError } = await supabase
                    .from('groups')
                    .select('*, events(name), group_members(count)')
                    .eq('id', id)
                    .single();

                if (groupError) throw groupError;
                setGroup(groupData);

                const { data: matchesData, error: matchesError } = await supabase
                    .from('matches')
                    .select('*, home_team:teams!home_team_id(logo_url, short_name), away_team:teams!away_team_id(logo_url, short_name)')
                    .eq('event_id', groupData.event_id)
                    .order('match_date', { ascending: true });

                if (matchesError) throw matchesError;
                setMatches(matchesData || []);

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }

        if (id) fetchGroupDetails();
    }, [id]);

    const openBetModal = (match: any) => {
        setSelectedMatch(match);
        setHomeScore('');
        setAwayScore('');
        setModalVisible(true);
    }

    const submitBet = async () => {
        if (!homeScore || !awayScore) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('bets')
                .upsert({
                    user_id: user.id,
                    group_id: id,
                    match_id: selectedMatch.id,
                    home_score_bet: parseInt(homeScore),
                    away_score_bet: parseInt(awayScore)
                }, {
                    onConflict: 'user_id,group_id,match_id'
                });

            if (error) throw error;

            Alert.alert('Sucesso', 'Aposta salva!');
            setModalVisible(false);
        } catch (e: any) {
            Alert.alert('Erro', e.message);
        }
    }

    if (loading) return <View style={styles.container}><Text>Carregando...</Text></View>
    if (!group) return <View style={styles.container}><Text>Grupo não encontrado</Text></View>

    return (
        <ScrollView style={styles.container}>
            <Stack.Screen options={{ title: group.name }} />

            <View style={styles.headerCard}>
                <Text style={styles.eventName}>🏆 {group.events.name}</Text>
                <Text style={styles.groupDesc}>{group.description}</Text>
                <View style={styles.statsRow}>
                    <Text style={styles.statsText}>👥 {group.group_members[0].count} membros</Text>
                    <Text style={styles.statsText}>🔑 {group.invite_code}</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Jogos Disponíveis</Text>

            {matches.map((match) => (
                <View key={match.id} style={styles.matchCard}>
                    <Text style={styles.matchDate}>{new Date(match.match_date).toLocaleDateString()}</Text>

                    <View style={styles.teamsRow}>
                        <View style={styles.teamContainer}>
                            <Text style={styles.teamName}>{match.home_team.short_name}</Text>
                            {match.home_team.logo_url &&
                                <Image source={{ uri: match.home_team.logo_url }} style={styles.teamLogo} />
                            }
                        </View>

                        <Text style={styles.vsText}>X</Text>

                        <View style={styles.teamContainer}>
                            {match.away_team.logo_url &&
                                <Image source={{ uri: match.away_team.logo_url }} style={styles.teamLogo} />
                            }
                            <Text style={styles.teamName}>{match.away_team.short_name}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.betButton}
                        onPress={() => openBetModal(match)}
                    >
                        <Text style={styles.betButtonText}>Apostar</Text>
                    </TouchableOpacity>
                </View>
            ))}

            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Fazer Aposta</Text>
                    {selectedMatch && (
                        <View style={styles.modalMatchInfo}>
                            <Text style={styles.modalTeam}>{selectedMatch.home_team.short_name} x {selectedMatch.away_team.short_name}</Text>
                        </View>
                    )}

                    <View style={styles.scoreInputRow}>
                        <TextInput
                            style={styles.scoreInput}
                            keyboardType="numeric"
                            value={homeScore}
                            onChangeText={setHomeScore}
                        />
                        <Text style={styles.scoreSeparator}>x</Text>
                        <TextInput
                            style={styles.scoreInput}
                            keyboardType="numeric"
                            value={awayScore}
                            onChangeText={setAwayScore}
                        />
                    </View>

                    <View style={styles.modalButtons}>
                        <Button title="Cancelar" onPress={() => setModalVisible(false)} color="gray" />
                        <Button title="Salvar" onPress={submitBet} />
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f9fafb',
    },
    headerCard: {
        backgroundColor: '#4f46e5',
        padding: 20,
        borderRadius: 12,
        marginBottom: 20,
    },
    eventName: {
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    groupDesc: {
        color: '#e0e7ff',
        fontSize: 16,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    statsText: {
        color: 'white',
        fontSize: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#1f2937',
    },
    matchCard: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    matchDate: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 12,
    },
    teamsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    teamContainer: {
        alignItems: 'center',
        flex: 1,
    },
    teamLogo: {
        width: 40,
        height: 40,
        resizeMode: 'contain',
        marginVertical: 4,
    },
    teamName: {
        fontWeight: '600',
        fontSize: 14,
    },
    vsText: {
        color: '#9ca3af',
        fontWeight: 'bold',
        fontSize: 18,
    },
    betButton: {
        backgroundColor: '#eff6ff',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    betButtonText: {
        color: '#2563eb',
        fontWeight: '600',
    },
    // Modal
    modalView: {
        margin: 20,
        marginTop: 'auto',
        marginBottom: 'auto',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    modalMatchInfo: {
        marginBottom: 20,
    },
    modalTeam: {
        fontSize: 16,
        fontWeight: '500',
    },
    scoreInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
    },
    scoreInput: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        width: 60,
        height: 60,
        textAlign: 'center',
        fontSize: 24,
    },
    scoreSeparator: {
        fontSize: 20,
        color: '#6b7280',
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 16,
    }
});

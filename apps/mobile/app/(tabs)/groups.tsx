import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Link } from 'expo-router';

export default function GroupsScreen() {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function fetchGroups() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('group_members')
                .select('groups(*, events(name)), role')
                .eq('user_id', user.id);

            if (error) throw error;
            setGroups(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        fetchGroups();
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchGroups();
    }

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Meus Bolões</Text>

            <FlatList
                data={groups}
                keyExtractor={(item) => item.groups.id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListEmptyComponent={<Text style={styles.empty}>Você não tem grupos.</Text>}
                renderItem={({ item }) => (
                    <Link href={`/groups/${item.groups.id}`} asChild>
                        <TouchableOpacity style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.groupName}>{item.groups.name}</Text>
                                <View style={[styles.badge, item.role === 'admin' ? styles.adminBadge : styles.memberBadge]}>
                                    <Text style={[styles.badgeText, item.role === 'admin' ? styles.adminText : styles.memberText]}>
                                        {item.role === 'admin' ? 'Admin' : 'Membro'}
                                    </Text>
                                </View>
                            </View>
                            <Text style={styles.eventName}>{item.groups.events.name}</Text>
                            <Text numberOfLines={1} style={styles.description}>{item.groups.description}</Text>
                        </TouchableOpacity>
                    </Link>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f9fafb', // gray-50
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        marginTop: 40,
    },
    empty: {
        textAlign: 'center',
        marginTop: 20,
        color: '#6b7280',
    },
    card: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '600',
        flex: 1,
    },
    eventName: {
        fontSize: 14,
        color: '#4f46e5', // indigo-600
        marginBottom: 4,
        fontWeight: '500',
    },
    description: {
        fontSize: 14,
        color: '#6b7280',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    adminBadge: {
        backgroundColor: '#f3e8ff', // purple-100
    },
    memberBadge: {
        backgroundColor: '#f3f4f6', // gray-100
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '500',
    },
    adminText: {
        color: '#6b21a8', // purple-800
    },
    memberText: {
        color: '#374151', // gray-700
    }
});

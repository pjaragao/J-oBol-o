import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { styled } from 'nativewind';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const StyledText = styled(Text);
const StyledView = styled(View);

interface GroupCardProps {
    group: {
        id: string;
        name: string;
        description: string | null;
        is_public: boolean;
        is_paid: boolean;
        entry_fee?: number;
        events?: {
            name: string;
            logo_url: string | null;
            online_fee_percent?: number;
        } | {
            name: string;
            logo_url: string | null;
            online_fee_percent?: number;
        }[]; // Handle array or single object from Supabase join
    };
    role?: string;
    status?: 'approved' | 'pending';
    memberCount?: number;
    ranking?: {
        rank: number;
        total: number;
    };
    onPress: () => void;
}

export function GroupCard({ group, role, status, memberCount = 0, ranking, onPress }: GroupCardProps) {
    const event = Array.isArray(group.events) ? group.events[0] : group.events;
    const isPending = status === 'pending';

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <Card className={`mb-4 ${isPending ? 'opacity-80 border-amber-200 dark:border-amber-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                <View className="p-4">
                    {/* Header: Event & Privacy */}
                    <View className="flex-row justify-between items-start mb-3">
                        <View className="flex-row items-center space-x-2">
                            {event?.logo_url && (
                                <View className="w-8 h-8 bg-white rounded-lg p-1 items-center justify-center border border-slate-100 dark:border-slate-700">
                                    <Image
                                        source={{ uri: event.logo_url }}
                                        className="w-full h-full"
                                        resizeMode="contain"
                                    />
                                </View>
                            )}
                            <Badge
                                label={event?.name || 'Evento'}
                                variant="success"
                                className="bg-green-50 dark:bg-green-900/20"
                            />
                        </View>
                        <View className="flex-row items-center space-x-2">
                            {isPending && <Badge label="Pendente" variant="warning" />}
                            {!group.is_public ? (
                                <MaterialIcons name="lock" size={16} color="#94a3b8" />
                            ) : (
                                <MaterialIcons name="public" size={16} color="#94a3b8" />
                            )}
                        </View>
                    </View>

                    {/* Content */}
                    <StyledText className="text-lg font-bold text-slate-900 dark:text-white mb-1" numberOfLines={1}>
                        {group.name}
                    </StyledText>

                    <StyledText className="text-sm text-slate-500 dark:text-slate-400 mb-4" numberOfLines={2}>
                        {group.description || 'Sem descrição'}
                    </StyledText>

                    {/* Footer Stats */}
                    <View className="flex-row items-center space-x-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                        {ranking && !isPending && (
                            <View className="flex-row items-center space-x-1">
                                <FontAwesome5 name="trophy" size={12} color="#eab308" />
                                <StyledText className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    #{ranking.rank}
                                </StyledText>
                            </View>
                        )}

                        <View className="flex-row items-center space-x-1">
                            <FontAwesome5 name="users" size={12} color="#64748b" />
                            <StyledText className="text-xs font-medium text-slate-600 dark:text-slate-400">
                                {memberCount}
                            </StyledText>
                        </View>

                        {group.is_paid && (
                            <View className="flex-row items-center space-x-1 ml-auto">
                                <Text className="text-xs font-bold text-green-600 dark:text-green-400">
                                    💰 R$ {group.entry_fee?.toFixed(0)}
                                </Text>
                            </View>
                        )}

                        {!group.is_paid && role && (
                            <StyledText className="text-xs font-bold text-slate-400 ml-auto uppercase">
                                {role === 'admin' ? 'Admin' : 'Membro'}
                            </StyledText>
                        )}
                    </View>
                </View>
            </Card>
        </TouchableOpacity>
    );
}

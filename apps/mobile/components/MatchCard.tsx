import { View, Text, Image, TextInput } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { styled } from 'nativewind';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const StyledText = styled(Text);
const StyledTextInput = styled(TextInput);

interface MatchCardProps {
    match: {
        id: string;
        home_team: { name: string; badge_url: string; iso_code: string };
        away_team: { name: string; badge_url: string; iso_code: string };
        timestamp: string;
        status: string;
        home_score?: number;
        away_score?: number;
    };
    bet?: {
        home_score: number | null;
        away_score: number | null;
    };
    onBetChange?: (home: string, away: string) => void;
    isEditable?: boolean;
}

export function MatchCard({ match, bet, onBetChange, isEditable = false }: MatchCardProps) {
    const date = new Date(match.timestamp);
    const dateStr = format(date, "dd 'de' MMM, HH:mm", { locale: ptBR });

    return (
        <Card className="mb-4 border-slate-200 dark:border-slate-700">
            {/* Header */}
            <View className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b border-slate-100 dark:border-slate-700 flex-row justify-between items-center">
                <StyledText className="text-xs text-slate-500 font-medium capitalize">
                    {dateStr}
                </StyledText>
                <Badge
                    label={match.status === 'FINISHED' ? 'Encerrado' : 'Aberto'}
                    variant={match.status === 'FINISHED' ? 'default' : 'success'}
                />
            </View>

            {/* Teams & Scores */}
            <View className="p-4 py-6">
                <View className="flex-row items-center justify-between">
                    {/* Home */}
                    <View className="items-center flex-1">
                        <Image source={{ uri: match.home_team.badge_url }} className="w-12 h-12 mb-2" resizeMode="contain" />
                        <StyledText className="text-sm font-bold text-center" numberOfLines={1}>{match.home_team.name}</StyledText>
                    </View>

                    {/* Score / Inputs */}
                    <View className="flex-row items-center justify-center space-x-3 w-1/3">
                        <ScoreInput
                            value={bet?.home_score?.toString() ?? ''}
                            editable={isEditable}
                            placeholder={match.home_score?.toString() ?? '-'}
                            onChangeText={(v) => onBetChange?.(v, bet?.away_score?.toString() ?? '')}
                        />
                        <StyledText className="text-slate-400 font-bold">X</StyledText>
                        <ScoreInput
                            value={bet?.away_score?.toString() ?? ''}
                            editable={isEditable}
                            placeholder={match.away_score?.toString() ?? '-'}
                            onChangeText={(v) => onBetChange?.(bet?.home_score?.toString() ?? '', v)}
                        />
                    </View>

                    {/* Away */}
                    <View className="items-center flex-1">
                        <Image source={{ uri: match.away_team.badge_url }} className="w-12 h-12 mb-2" resizeMode="contain" />
                        <StyledText className="text-sm font-bold text-center" numberOfLines={1}>{match.away_team.name}</StyledText>
                    </View>
                </View>
            </View>
        </Card>
    );
}

function ScoreInput({ value, editable, onChangeText, placeholder }: any) {
    return (
        <StyledTextInput
            className={`w-10 h-10 text-center text-lg font-bold border rounded-lg ${editable ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-100 border-transparent text-slate-500'}`}
            value={value}
            onChangeText={onChangeText}
            editable={editable}
            placeholder={placeholder}
            keyboardType="number-pad"
            maxLength={2}
        />
    );
}

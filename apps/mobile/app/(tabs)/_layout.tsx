import { Tabs } from 'expo-router';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';

export default function TabLayout() {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#16a34a', // green-600
                tabBarInactiveTintColor: isDark ? '#94a3b8' : '#64748b',
                tabBarStyle: {
                    backgroundColor: isDark ? '#020617' : '#ffffff',
                    borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
                }
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Meus Grupos',
                    tabBarIcon: ({ color }) => <FontAwesome5 name="users" size={20} color={color} />,
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Explorar',
                    tabBarIcon: ({ color }) => <MaterialIcons name="search" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color }) => <FontAwesome5 name="user" size={20} color={color} />,
                }}
            />
        </Tabs>
    );
}

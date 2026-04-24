import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            alert('Falha ao obter permissão para envio de notificações!');
            return;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                // Should be set in app.json, but for dev we might fallback or just try
                // console.warn('Project ID not found');
            }

            token = (await Notifications.getExpoPushTokenAsync({
                projectId,
            })).data;

        } catch (e) {
            console.error(e);
        }
    } else {
        // alert('Must use physical device for Push Notifications');
    }

    return token;
}

export async function syncPushToken(token: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Attempt to update profile with push token
    // Assumes 'profiles' has 'expo_push_token' column
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, expo_push_token: token }, { onConflict: 'id' });

    if (error) {
        console.error('Error syncing push token:', error);
    }
}

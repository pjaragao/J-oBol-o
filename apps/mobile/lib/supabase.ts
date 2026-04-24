import { AppState } from 'react-native'
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// Replace with your actual Supabase URL and Anon Key
// In a real app, use expo-constants or .env
const supabaseUrl = 'https://hbmtkaeymmvpjfarjpij.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibXRrYWV5bW12cGpmYXJqcGlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MDc2NjcsImV4cCI6MjA4MTM4MzY2N30.pae3uwAOYfq8H5Tqcfc2FhNLLnuIHhsWhZ1N3qraP_A'

const ExpoSecureStoreAdapter = {
    getItem: (key: string) => {
        if (typeof window === 'undefined') return Promise.resolve(null)
        return AsyncStorage.getItem(key)
    },
    setItem: (key: string, value: string) => {
        if (typeof window === 'undefined') return Promise.resolve(null)
        return AsyncStorage.setItem(key, value)
    },
    removeItem: (key: string) => {
        if (typeof window === 'undefined') return Promise.resolve(null)
        return AsyncStorage.removeItem(key)
    },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
if (typeof AppState !== 'undefined') {
    AppState.addEventListener('change', (state) => {
        if (state === 'active') {
            supabase.auth.startAutoRefresh()
        } else {
            supabase.auth.stopAutoRefresh()
        }
    })
}

import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';
import { createClient } from '@/lib/supabase/server';

export default getRequestConfig(async () => {
    // Prioridade de detecção:
    // 1. Locale do perfil do usuário logado (banco de dados)
    // 2. Cookie 'locale'
    // 3. Default (pt)

    const cookieStore = await cookies();
    let locale: Locale = defaultLocale;

    // Tentar pegar do perfil do usuário logado primeiro
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('locale')
                .eq('id', user.id)
                .single();

            if (profile?.locale && locales.includes(profile.locale as Locale)) {
                locale = profile.locale as Locale;
                // Atualizar cookie para manter sincronizado
                cookieStore.set('locale', locale);
                return {
                    locale,
                    messages: (await import(`../../messages/${locale}.json`)).default
                };
            }
        }
    } catch (error) {
        // Se falhar ao buscar do banco, continua para o cookie
        console.log('Locale detection from profile failed, using cookie/default');
    }

    // Fallback para cookie se usuário não logado ou sem locale no perfil
    const localeCookie = cookieStore.get('locale')?.value;
    if (localeCookie && locales.includes(localeCookie as Locale)) {
        locale = localeCookie as Locale;
    }

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default
    };
});

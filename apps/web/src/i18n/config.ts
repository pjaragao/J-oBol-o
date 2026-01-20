export const locales = ['pt', 'es', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt';

export const localeNames: Record<Locale, string> = {
    pt: 'Português',
    es: 'Español',
    en: 'English'
};

export const localeFlags: Record<Locale, string> = {
    pt: '🇧🇷',
    es: '🇪🇸',
    en: '🇺🇸'
};

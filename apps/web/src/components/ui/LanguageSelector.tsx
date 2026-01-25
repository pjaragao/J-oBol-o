'use client';

import { useState, useEffect } from 'react';
import { locales, localeNames, localeFlags, type Locale, defaultLocale } from '@/i18n/config';
import { Globe, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLocale } from 'next-intl';

interface LanguageSelectorProps {
    value?: Locale;
    onChange?: (locale: Locale) => void;
    variant?: 'inline' | 'dropdown';
    showLabel?: boolean;
}

export function LanguageSelector({
    value,
    onChange,
    variant = 'dropdown',
    showLabel = true
}: LanguageSelectorProps) {
    const locale = useLocale() as Locale;
    const [currentLocale, setCurrentLocale] = useState<Locale>(value || locale || defaultLocale);
    const [isOpen, setIsOpen] = useState(false);

    // Detectar idioma do navegador na primeira vez se nenhum valor ou locale for provido
    useEffect(() => {
        if (!value && !locale) {
            const browserLang = navigator.language.split('-')[0] as Locale;
            const detectedLocale = locales.includes(browserLang) ? browserLang : defaultLocale;
            setCurrentLocale(detectedLocale);
            if (onChange) {
                onChange(detectedLocale);
            }
        } else if (!value && locale) {
            setCurrentLocale(locale);
        }
    }, [value, locale, onChange]);

    const handleChange = async (newLocale: Locale) => {
        setCurrentLocale(newLocale);
        setIsOpen(false);

        // Se tem onChange (usado em formulários), apenas chama
        if (onChange) {
            onChange(newLocale);
            return;
        }

        // Caso contrário, salva no cookie e banco de dados
        document.cookie = `locale=${newLocale};path=/;max-age=31536000`;

        // Tentar salvar no perfil do usuário se estiver logado
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            await supabase
                .from('profiles')
                .update({ locale: newLocale })
                .eq('id', user.id);
        }

        // Recarregar para aplicar
        window.location.reload();
    };

    if (variant === 'inline') {
        return (
            <div className="space-y-2">
                {showLabel && (
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                        {localeFlags[currentLocale]} Idioma / Language / Idioma
                    </label>
                )}
                <div className="grid grid-cols-3 gap-2">
                    {locales.map((locale) => (
                        <button
                            key={locale}
                            type="button"
                            onClick={() => handleChange(locale)}
                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${currentLocale === locale
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold'
                                : 'border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700'
                                }`}
                        >
                            <span className="text-2xl">{localeFlags[locale]}</span>
                            <span className="text-sm">{localeNames[locale]}</span>
                            {currentLocale === locale && <Check className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
                <Globe className="h-4 w-4" />
                <span className="text-sm font-medium">{localeFlags[currentLocale]} {localeNames[currentLocale]}</span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-20 min-w-[180px]">
                        {locales.map((locale) => (
                            <button
                                key={locale}
                                type="button"
                                onClick={() => handleChange(locale)}
                                className={`flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg ${locale === currentLocale ? 'text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20' : ''
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    <span className="text-lg">{localeFlags[locale]}</span>
                                    {localeNames[locale]}
                                </span>
                                {locale === currentLocale && <Check className="h-4 w-4" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

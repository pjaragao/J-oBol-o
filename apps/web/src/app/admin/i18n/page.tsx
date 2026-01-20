'use client';

import { useState, useEffect } from 'react';
import { Globe, Save, AlertCircle, Check, FileText } from 'lucide-react';
import { locales, localeNames, localeFlags } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

export default function I18nEditorPage() {
    const [selectedLocale, setSelectedLocale] = useState<Locale>('pt');
    const [translations, setTranslations] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadTranslations(selectedLocale);
    }, [selectedLocale]);

    const loadTranslations = async (locale: Locale) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/translations/${locale}`);
            if (!response.ok) throw new Error('Erro ao carregar traduções');
            const data = await response.json();
            setTranslations(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveTranslations = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            const response = await fetch(`/api/admin/translations/${selectedLocale}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(translations)
            });
            if (!response.ok) throw new Error('Erro ao salvar traduções');
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const renderEditor = (obj: any, path: string = '') => {
        return Object.keys(obj).map((key) => {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];

            if (typeof value === 'object' && value !== null) {
                return (
                    <div key={currentPath} className="ml-4 mt-4">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
                            {key}
                        </h4>
                        {renderEditor(value, currentPath)}
                    </div>
                );
            }

            return (
                <div key={currentPath} className="mb-3">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {currentPath}
                    </label>
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => {
                            const newTranslations = { ...translations };
                            const keys = currentPath.split('.');
                            let current: any = newTranslations;

                            for (let i = 0; i < keys.length - 1; i++) {
                                current = current[keys[i]];
                            }
                            current[keys[keys.length - 1]] = e.target.value;

                            setTranslations(newTranslations);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white text-sm"
                    />
                </div>
            );
        });
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase border-l-4 border-green-500 pl-4">
                    Editor de Traduções
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 ml-4">
                    Edite as traduções da aplicação para cada idioma suportado
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-4 mb-6 flex gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-400 font-medium">{error}</p>
                </div>
            )}

            {saved && (
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl p-4 mb-6 flex gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <p className="text-sm text-green-700 dark:text-green-400 font-medium">Tradução salva com sucesso!</p>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Header com seletor de idioma */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-slate-500" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Idioma:</span>
                    </div>
                    <div className="flex gap-2">
                        {locales.map((locale) => (
                            <button
                                key={locale}
                                onClick={() => setSelectedLocale(locale)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${selectedLocale === locale
                                        ? 'bg-green-600 text-white font-bold'
                                        : 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800'
                                    }`}
                            >
                                <span className="text-lg">{localeFlags[locale]}</span>
                                {localeNames[locale]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor de traduções */}
                <div className="p-6 max-h-[600px] overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="inline-block h-8 w-8 border-4 border-slate-300 border-t-green-600 rounded-full animate-spin"></div>
                            <p className="text-slate-500 mt-4">Carregando traduções...</p>
                        </div>
                    ) : (
                        renderEditor(translations)
                    )}
                </div>

                {/* Footer com botão salvar */}
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        onClick={saveTranslations}
                        disabled={saving || loading}
                        className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="h-5 w-5" />
                                Salvar Traduções
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

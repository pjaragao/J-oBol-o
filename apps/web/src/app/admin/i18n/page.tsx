'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Globe, Save, AlertCircle, Check, Search, Filter, ArrowUpDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { locales, localeNames, localeFlags } from '@/i18n/config';
import type { Locale } from '@/i18n/config';

interface TranslationGrid {
    [key: string]: {
        [locale in Locale]: string;
    };
}

export default function I18nEditorPage() {
    const [flatTranslations, setFlatTranslations] = useState<TranslationGrid>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(null);

    const flatten = (obj: any, prefix = ''): Record<string, string> => {
        return Object.keys(obj).reduce((acc: any, k) => {
            const pre = prefix.length ? prefix + '.' : '';
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
                Object.assign(acc, flatten(obj[k], pre + k));
            } else {
                acc[pre + k] = obj[k];
            }
            return acc;
        }, {});
    };

    const unflatten = (data: Record<string, string>): any => {
        const result: any = {};
        for (const key in data) {
            const keys = key.split('.');
            let current = result;
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i];
                if (i === keys.length - 1) {
                    current[k] = data[key];
                } else {
                    current[k] = current[k] || {};
                    current = current[k];
                }
            }
        }
        return result;
    };

    const loadAllTranslations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const results = await Promise.all(
                locales.map(async (locale) => {
                    const response = await fetch(`/api/admin/translations/${locale}`);
                    if (!response.ok) throw new Error(`Erro ao carregar ${locale}`);
                    return { locale, data: await response.json() };
                })
            );

            const grid: TranslationGrid = {};
            results.forEach((res) => {
                const flattened = flatten(res.data);
                Object.entries(flattened).forEach(([key, value]) => {
                    if (!grid[key]) {
                        grid[key] = { pt: '', en: '', es: '' };
                    }
                    grid[key][res.locale as Locale] = value;
                });
            });
            setFlatTranslations(grid);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAllTranslations();
    }, [loadAllTranslations]);

    const rows = useMemo(() => {
        return Object.keys(flatTranslations).sort().map(key => ({
            key,
            ...flatTranslations[key]
        }));
    }, [flatTranslations]);

    const filteredRows = useMemo(() => {
        return rows.filter(row => {
            const matchesSearch = row.key.toLowerCase().includes(search.toLowerCase()) ||
                row.pt.toLowerCase().includes(search.toLowerCase()) ||
                row.en.toLowerCase().includes(search.toLowerCase()) ||
                row.es.toLowerCase().includes(search.toLowerCase());

            const matchesSection = !activeSection || row.key.startsWith(activeSection + '.');

            return matchesSearch && matchesSection;
        });
    }, [rows, search, activeSection]);

    const sections = useMemo(() => {
        const s = new Set<string>();
        rows.forEach(r => {
            const parts = r.key.split('.');
            if (parts.length > 1) s.add(parts[0]);
        });
        return Array.from(s).sort();
    }, [rows]);

    const handleUpdate = (key: string, locale: Locale, value: string) => {
        setFlatTranslations(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [locale]: value
            }
        }));
    };

    const saveAll = async () => {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            await Promise.all(
                locales.map(locale => {
                    const localeData: Record<string, string> = {};
                    Object.entries(flatTranslations).forEach(([key, values]) => {
                        localeData[key] = values[locale as Locale];
                    });
                    const nested = unflatten(localeData);

                    return fetch(`/api/admin/translations/${locale}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(nested)
                    }).then(res => {
                        if (!res.ok) throw new Error(`Falha ao salvar ${locale}`);
                    });
                })
            );
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-full mx-auto py-4 px-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
            <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-green-600 p-2 rounded-xl shadow-lg shadow-green-600/20">
                        <Globe className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
                            Excel i18n Editor
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                            Gerencie {rows.length} chaves em 3 idiomas simultaneamente
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs w-48 lg:w-64 focus:ring-2 focus:ring-green-500/50 focus:outline-none transition-all shadow-sm"
                        />
                    </div>

                    <button
                        onClick={saveAll}
                        disabled={saving || loading}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-5 rounded-xl shadow-lg shadow-green-600/20 transition-all disabled:opacity-50 text-xs"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {saving ? 'Gravando...' : 'Salvar Tudo'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <p className="text-xs text-red-500 font-bold">{error}</p>
                </div>
            )}

            {saved && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 mb-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <p className="text-xs text-green-500 font-bold">Configurações salvas com sucesso!</p>
                </div>
            )}

            <div className="flex gap-4 h-[calc(100vh-120px)]">
                {/* Lateral: Seções */}
                <div className="w-40 flex-shrink-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                        <Filter className="h-3 w-3 text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escopo</span>
                    </div>
                    <div className="overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                        <button
                            onClick={() => setActiveSection(null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${!activeSection ? 'bg-green-600 text-white shadow-md shadow-green-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                            Global
                        </button>
                        {sections.map(section => (
                            <button
                                key={section}
                                onClick={() => setActiveSection(section)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all truncate ${activeSection === section ? 'bg-green-600 text-white shadow-md shadow-green-600/20' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                                {section}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid principal */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm">
                    <div className="overflow-auto w-full h-full custom-scrollbar">
                        <table className="w-full border-collapse table-fixed min-w-[1000px]">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
                                    <th className="w-1/4 p-3 text-left border-r border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Chave (Path)
                                        </div>
                                    </th>
                                    {locales.map(locale => (
                                        <th key={locale} className="p-3 text-left border-r border-slate-200 dark:border-slate-800">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <span className="text-base">{localeFlags[locale]}</span>
                                                <span>{localeNames[locale]}</span>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-32 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
                                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Indexando traduções...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-32 text-center">
                                            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Nada encontrado</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row, idx) => (
                                        <tr
                                            key={row.key}
                                            className="group hover:bg-green-500/[0.02] dark:hover:bg-green-500/[0.05] transition-colors"
                                        >
                                            <td className="p-2 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                                                <div className="flex items-center justify-between gap-2">
                                                    <code className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 break-all">
                                                        {row.key}
                                                    </code>
                                                </div>
                                            </td>
                                            {locales.map(locale => (
                                                <td key={locale} className="p-1 border-r border-slate-100 dark:border-slate-800">
                                                    <textarea
                                                        rows={1}
                                                        value={row[locale as Locale]}
                                                        onChange={(e) => handleUpdate(row.key, locale as Locale, e.target.value)}
                                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-green-500/30 rounded p-2 text-xs dark:text-white resize-none min-h-[34px] transition-all overflow-hidden focus:bg-white dark:focus:bg-slate-800/50"
                                                        placeholder="..."
                                                        onFocus={(e) => {
                                                            const target = e.target as HTMLTextAreaElement;
                                                            target.style.height = 'auto';
                                                            target.style.height = target.scrollHeight + 'px';
                                                        }}
                                                        onInput={(e) => {
                                                            const target = e.target as HTMLTextAreaElement;
                                                            target.style.height = 'auto';
                                                            target.style.height = target.scrollHeight + 'px';
                                                        }}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                    height: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #1e293b;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}

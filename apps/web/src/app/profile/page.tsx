'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AvatarUpload from '@/components/profile/AvatarUpload'
import { AppLayout } from '@/components/layout/AppLayout'
import { User, Mail, CreditCard, MapPin, Hash, Home, Map, Building2, Globe2, Trophy, Check, ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LanguageSelector } from '@/components/ui/LanguageSelector'
import type { Locale } from '@/i18n/config'

// Masks helpers
const maskCPF = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .replace(/(-\d{2})\d+?$/, '$1')
}

const maskCEP = (value: string) => {
    return value
        .replace(/\D/g, '')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{3})\d+?$/, '$1')
}

const BRAZIL_STATES = [
    { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
    { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
    { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
    { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
    { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
    { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
    { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
    { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
    { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' }
]

export default function ProfilePage() {
    const supabase = createClient()
    const router = useRouter()
    const t = useTranslations('profile')
    const tCommon = useTranslations('common')

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [user, setUser] = useState<any>(null)
    const [profile, setProfile] = useState<any>(null)
    const [cities, setCities] = useState<string[]>([])
    const [showFullStates, setShowFullStates] = useState(false)

    // Form states
    const [formData, setFormData] = useState({
        displayName: '',
        fullName: '',
        cpf: '',
        cep: '',
        addressStreet: '',
        addressNumber: '',
        addressComplement: '',
        addressNeighborhood: '',
        addressCity: '',
        addressState: '',
        locale: 'pt' as Locale
    })
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

    const fetchProfile = useCallback(async () => {
        try {
            setLoading(true)
            const { data: { user: authUser } } = await supabase.auth.getUser()

            if (!authUser) {
                router.push('/login')
                return
            }

            setUser(authUser)

            const { data, error, status } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (error && status !== 406) throw error

            if (data) {
                setProfile(data)
                setAvatarUrl(data.avatar_url)
                setFormData({
                    displayName: data.display_name || '',
                    fullName: data.full_name || '',
                    cpf: data.cpf || '',
                    cep: data.cep || '',
                    addressStreet: data.address_street || '',
                    addressNumber: data.address_number || '',
                    addressComplement: data.address_complement || '',
                    addressNeighborhood: data.address_neighborhood || '',
                    addressCity: data.address_city || '',
                    addressState: data.address_state || '',
                    locale: (data.locale || 'pt') as Locale
                })
            }
        } catch (error: any) {
            console.error('Error loading user data:', error.message)
        } finally {
            setLoading(false)
        }
    }, [supabase, router])

    useEffect(() => {
        fetchProfile()
    }, [fetchProfile])

    // Fetch cities when state changes
    useEffect(() => {
        if (formData.addressState) {
            const fetchCities = async () => {
                try {
                    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${formData.addressState}/municipios`)
                    const data = await response.json()
                    setCities(data.map((c: any) => c.nome).sort())
                } catch (error) {
                    console.error('Error fetching cities:', error)
                }
            }
            fetchCities()
        } else {
            setCities([])
        }
    }, [formData.addressState])

    // CEP Lookup
    useEffect(() => {
        const cleanCep = formData.cep.replace(/\D/g, '')
        if (cleanCep.length === 8) {
            const fetchCep = async () => {
                try {
                    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
                    const data = await response.json()
                    if (!data.erro) {
                        setFormData(prev => ({
                            ...prev,
                            addressStreet: data.logradouro,
                            addressNeighborhood: data.bairro,
                            addressCity: data.localidade,
                            addressState: data.uf
                        }))
                    }
                } catch (error) {
                    console.error('Error fetching CEP:', error)
                }
            }
            fetchCep()
        }
    }, [formData.cep])

    async function updateProfile() {
        try {
            setSaving(true)
            setSaved(false)

            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    email: user.email,
                    display_name: formData.displayName,
                    full_name: formData.fullName,
                    cpf: formData.cpf,
                    cep: formData.cep,
                    address_street: formData.addressStreet,
                    address_number: formData.addressNumber,
                    address_complement: formData.addressComplement,
                    address_neighborhood: formData.addressNeighborhood,
                    address_city: formData.addressCity,
                    address_state: formData.addressState,
                    avatar_url: avatarUrl,
                    locale: formData.locale,
                    updated_at: new Date().toISOString(),
                })

            if (error) throw error
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
            router.refresh()
        } catch (error: any) {
            alert('Erro ao atualizar dados: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen dark:bg-slate-900">
            <div className="text-slate-500 animate-pulse font-medium">{t('loadingProfile')}</div>
        </div>
    )

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase border-l-4 border-green-500 pl-4">
                    {t('title')}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1 ml-4">{t('subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Sidebar: Avatar & Basic Info */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center">
                        <AvatarUpload
                            uid={user?.id || ''}
                            url={avatarUrl}
                            onUpload={(url) => setAvatarUrl(url)}
                        />
                        <div className="mt-6 text-center">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{formData.displayName || 'Jogador'}</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                        </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-800/30 rounded-2xl p-6">
                        <h3 className="text-green-800 dark:text-green-400 font-bold text-sm mb-2 flex items-center gap-2">
                            <Trophy className="h-4 w-4" /> {t('championTip')}
                        </h3>
                        <p className="text-xs text-green-700/80 dark:text-green-500/80 leading-relaxed">
                            {t('championTipText')}
                        </p>
                    </div>
                </div>

                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-6 md:p-8 space-y-8">

                            {/* Identificação Section */}
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <Hash className="h-3 w-3" /> {t('identificationSection')}
                                </h3>
                                <div className="grid gap-6">
                                    <div className="grid gap-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('displayName')}</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <input
                                                type="text"
                                                value={formData.displayName}
                                                onChange={(e) => setFormData(p => ({ ...p, displayName: e.target.value }))}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                placeholder={t('displayNamePlaceholder')}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('fullName')}</label>
                                        <input
                                            type="text"
                                            value={formData.fullName}
                                            onChange={(e) => setFormData(p => ({ ...p, fullName: e.target.value }))}
                                            className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                            placeholder={t('fullNamePlaceholder')}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('email')}</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={user?.email || ''}
                                                    disabled
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('cpf')}</label>
                                            <div className="relative">
                                                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={formData.cpf}
                                                    onChange={(e) => setFormData(p => ({ ...p, cpf: maskCPF(e.target.value) }))}
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                    placeholder={t('cpfPlaceholder')}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Localização Section */}
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <MapPin className="h-3 w-3" /> {t('addressSection')}
                                </h3>
                                <div className="grid gap-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('cep')}</label>
                                            <input
                                                type="text"
                                                value={formData.cep}
                                                onChange={(e) => setFormData(p => ({ ...p, cep: maskCEP(e.target.value) }))}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                placeholder={t('cepPlaceholder')}
                                            />
                                        </div>
                                        <div className="md:col-span-2 grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('street')}</label>
                                            <div className="relative">
                                                <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={formData.addressStreet}
                                                    onChange={(e) => setFormData(p => ({ ...p, addressStreet: e.target.value }))}
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                    placeholder={t('streetPlaceholder')}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('number')}</label>
                                            <input
                                                type="text"
                                                value={formData.addressNumber}
                                                onChange={(e) => setFormData(p => ({ ...p, addressNumber: e.target.value }))}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                placeholder={t('numberPlaceholder')}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('complement')}</label>
                                            <input
                                                type="text"
                                                value={formData.addressComplement}
                                                onChange={(e) => setFormData(p => ({ ...p, addressComplement: e.target.value }))}
                                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                placeholder={t('complementPlaceholder')}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        <div className="md:col-span-4 grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('neighborhood')}</label>
                                            <div className="relative">
                                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={formData.addressNeighborhood}
                                                    onChange={(e) => setFormData(p => ({ ...p, addressNeighborhood: e.target.value }))}
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                    placeholder={t('neighborhoodPlaceholder')}
                                                />
                                            </div>
                                        </div>
                                        <div className="md:col-span-3 grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('state')}</label>
                                            <div className="relative">
                                                <select
                                                    value={formData.addressState}
                                                    onChange={(e) => setFormData(p => ({ ...p, addressState: e.target.value, addressCity: '' }))}
                                                    onFocus={() => setShowFullStates(true)}
                                                    onBlur={() => setShowFullStates(false)}
                                                    className="w-full pl-3 pr-8 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white appearance-none cursor-pointer text-sm"
                                                >
                                                    <option value="">{t('stateSelect')}</option>
                                                    {BRAZIL_STATES.map(s => (
                                                        <option key={s.uf} value={s.uf}>
                                                            {showFullStates ? `${s.uf} - ${s.name}` : s.uf}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-5 grid gap-2">
                                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('city')}</label>
                                            <div className="relative">
                                                <Map className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                                <input
                                                    list="cities-list"
                                                    type="text"
                                                    value={formData.addressCity}
                                                    onChange={(e) => setFormData(p => ({ ...p, addressCity: e.target.value }))}
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-green-500 focus:outline-none dark:text-white"
                                                    placeholder={t('cityPlaceholder')}
                                                />
                                                <datalist id="cities-list">
                                                    {cities.map(c => (
                                                        <option key={c} value={c} />
                                                    ))}
                                                </datalist>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Preferências Section */}
                            <section>
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <Globe2 className="h-3 w-3" /> {t('preferencesSection')}
                                </h3>
                                <div className="grid gap-6">
                                    <LanguageSelector
                                        variant="inline"
                                        value={formData.locale}
                                        onChange={(locale) => {
                                            setFormData(p => ({ ...p, locale }));
                                            // Salvar no cookie também
                                            document.cookie = `locale=${locale};path=/;max-age=31536000`;
                                        }}
                                        showLabel={true}
                                    />
                                </div>
                            </section>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <button
                                    onClick={updateProfile}
                                    disabled={saving}
                                    className={`w-full font-bold py-4 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${saved ? 'bg-green-500 text-white shadow-green-200 dark:shadow-none' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200 dark:shadow-none'
                                        }`}
                                >
                                    {saving ? (
                                        <>
                                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            {t('saving')}
                                        </>
                                    ) : saved ? (
                                        <>
                                            <Check className="h-5 w-5" /> {t('saved')}
                                        </>
                                    ) : (
                                        <>{t('saveChanges')}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

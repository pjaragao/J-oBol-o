"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { MoveRight, Trophy, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

interface HomeClientProps {
    // Add any props if needed
}

export default function HomeClient({ }: HomeClientProps) {
    const t = useTranslations("home");

    return (
        <div className="flex flex-col min-h-screen bg-background overflow-hidden ">
            {/* Navigation Bar */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b">
                <div className="container max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-primary/20 group-hover:scale-110 transition-transform">
                            <Image src="/logo-circle.png" alt="Logo" fill className="object-cover" />
                        </div>
                        <span className="font-black text-xl md:text-2xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                            {t("appName")}
                        </span>
                    </Link>
                    <div className="flex items-center gap-1 md:gap-4">
                        <div className="scale-75 md:scale-100">
                            <LanguageSelector />
                        </div>
                        <Button variant="ghost" asChild className="hidden md:flex rounded-full">
                            <Link href="/login">{t("loginCard.title")}</Link>
                        </Button>
                        <Button size="sm" className="hidden sm:flex rounded-full px-6 font-bold" asChild>
                            <Link href="/register">{t("hero.cta")}</Link>
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative h-screen flex items-center justify-center pt-20 px-4 md:px-8">
                <div className="absolute inset-0 z-0 opacity-40">
                    <Image
                        src="/hero-stadium.png" // We'll move the generated image here
                        alt="Stadium Background"
                        fill
                        className="object-cover"
                        priority
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
                </div>

                <div className="container relative z-10 max-w-6xl mx-auto text-center space-y-8">
                    <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary animate-in fade-in slide-in-from-top-4 duration-1000">
                        <div className="relative w-6 h-6 rounded-full overflow-hidden shadow-lg animate-pulse">
                            <Image src="/logo-circle.png" alt="Logo Small" fill className="object-cover" />
                        </div>
                        <span className="text-sm font-bold tracking-wider uppercase">{t("welcome")} {t("appName")}</span>
                    </div>

                    <h1 className="text-5xl md:text-8xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-blue-500 to-green-500 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        {t("hero.title")}
                    </h1>

                    <p className="max-w-2xl mx-auto text-xl md:text-2xl text-muted-foreground animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                        {t("hero.subtitle")}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                        <Button size="lg" className="rounded-full px-10 py-7 text-lg group" asChild>
                            <Link href="/register">
                                {t("hero.cta")}
                                <MoveRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="rounded-full px-10 py-7 text-lg" asChild>
                            <Link href="/login">{t("loginCard.title")}</Link>
                        </Button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-24 px-4 md:px-8 bg-muted/30 relative">
                <div className="container max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="p-8 rounded-3xl bg-card border hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
                            <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 w-fit">
                                <Users className="w-8 h-8 text-blue-500" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">{t("features.groups.title")}</h3>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                {t("features.groups.description")}
                            </p>
                            <div className="mt-8 relative h-48 rounded-xl overflow-hidden border">
                                <Image
                                    src="/render-dashboard.png"
                                    alt="Dashboard Render"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>
                        </div>

                        <div className="p-8 rounded-3xl bg-card border hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
                            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 w-fit">
                                <Trophy className="w-8 h-8 text-amber-500" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">{t("features.ranking.title")}</h3>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                {t("features.ranking.description")}
                            </p>
                            <div className="mt-8 relative h-48 rounded-xl overflow-hidden border">
                                <Image
                                    src="/render-ranking.png"
                                    alt="Ranking Render"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                            </div>
                        </div>

                        <div className="p-8 rounded-3xl bg-card border hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
                            <div className="mb-6 p-4 rounded-2xl bg-green-500/10 w-fit">
                                <Zap className="w-8 h-8 text-green-500" />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">{t("features.live.title")}</h3>
                            <p className="text-muted-foreground text-lg leading-relaxed">
                                {t("features.live.description")}
                            </p>
                            <div className="mt-8 relative h-48 rounded-xl overflow-hidden border group">
                                <Image
                                    src="/render-matches.png"
                                    alt="Live Results Render"
                                    fill
                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-2xl font-black text-primary animate-pulse tracking-widest">LIVE</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer / CTA Section */}
            <section className="py-24 px-4 md:px-8">
                <div className="container max-w-4xl mx-auto rounded-[3rem] bg-foreground text-background p-12 md:p-20 text-center space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -ml-32 -mb-32" />

                    <h2 className="text-4xl md:text-6xl font-black relative z-10">Pronto para entrar em campo?</h2>
                    <p className="text-xl md:text-2xl text-background/70 relative z-10 max-w-xl mx-auto">
                        Junte-se a milhares de torcedores e transforme seu conhecimento em prêmios e glória.
                    </p>
                    <div className="pt-8 relative z-10">
                        <Button size="lg" variant="secondary" className="rounded-full px-12 py-8 text-xl" asChild>
                            <Link href="/register">Criar Minha Conta Grátis</Link>
                        </Button>
                    </div>
                </div>
            </section>

            <footer className="py-12 border-t px-4 md:px-8">
                <div className="container max-w-6xl mx-auto flex flex-col md:row items-center justify-between gap-6 opacity-60 italic">
                    <span>&copy; {new Date().getFullYear()} JãoBolão. Todos os direitos reservados.</span>
                    <div className="flex gap-8">
                        <Link href="/terms" className="hover:text-primary transition-colors">Termos</Link>
                        <Link href="/privacy" className="hover:text-primary transition-colors">Privacidade</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

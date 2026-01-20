import { getTranslations } from 'next-intl/server'

export default async function Home() {
    const t = await getTranslations('home');

    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
                <h1 className="text-6xl font-bold">
                    {t('welcome')} <a className="text-blue-600" href="#">{t('appName')}</a>
                </h1>

                <p className="mt-3 text-2xl">
                    {t('tagline')}
                </p>

                <div className="flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full">
                    <a
                        href="/login"
                        className="p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600"
                    >
                        <h3 className="text-2xl font-bold">{t('loginCard.title')} &rarr;</h3>
                        <p className="mt-4 text-xl">
                            {t('loginCard.description')}
                        </p>
                    </a>

                    <a
                        href="/dashboard"
                        className="p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600"
                    >
                        <h3 className="text-2xl font-bold">{t('dashboardCard.title')} &rarr;</h3>
                        <p className="mt-4 text-xl">
                            {t('dashboardCard.description')}
                        </p>
                    </a>
                </div>
            </main>
        </div>
    )
}

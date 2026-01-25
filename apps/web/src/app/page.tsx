import { getTranslations } from 'next-intl/server'
import HomeClient from '@/components/layout/HomeClient'

export default async function Home() {
    return <HomeClient />
}

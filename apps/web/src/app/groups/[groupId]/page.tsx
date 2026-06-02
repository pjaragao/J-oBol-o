import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'

export default async function GroupDetailsPage(props: {
    params: Promise<{ groupId: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { groupId } = await props.params
    const resolvedSearchParams = await props.searchParams
    const supabase = await createClient()

    const { data: group } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single()

    if (!group) {
        notFound()
    }

    const clean = (s: string) => 
        s.normalize('NFD')
         .replace(/[\u0300-\u036f]/g, '') // remove accents
         .replace(/[^a-zA-Z0-9]/g, '')     // remove special chars

    const slug = clean(group.name)

    const query = new URLSearchParams()
    Object.entries(resolvedSearchParams).forEach(([key, val]) => {
        if (val !== undefined) {
            query.set(key, Array.isArray(val) ? val.join(',') : val)
        }
    })
    const queryString = query.toString()

    redirect(`/${slug}${queryString ? `?${queryString}` : ''}`)
}

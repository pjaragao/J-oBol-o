import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ locale: string }> }
) {
    try {
        const { locale } = await params;

        // Validar locale
        const validLocales = ['pt', 'es', 'en'];
        if (!validLocales.includes(locale)) {
            return NextResponse.json(
                { error: 'Idioma inválido' },
                { status: 400 }
            );
        }

        // Obter dados do body
        const translations = await request.json();

        // Salvar arquivo de tradução
        const filePath = path.join(process.cwd(), 'messages', `${locale}.json`);
        await writeFile(filePath, JSON.stringify(translations, null, 2), 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving translations:', error);
        return NextResponse.json(
            { error: 'Erro ao salvar traduções' },
            { status: 500 }
        );
    }
}

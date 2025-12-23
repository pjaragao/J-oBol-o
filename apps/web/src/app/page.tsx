export default function Home() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen py-2">
            <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
                <h1 className="text-6xl font-bold">
                    Bem-vindo ao <a className="text-blue-600" href="#">JãoBolão!</a>
                </h1>

                <p className="mt-3 text-2xl">
                    A plataforma definitiva para seus bolões de futebol.
                </p>

                <div className="flex flex-wrap items-center justify-around max-w-4xl mt-6 sm:w-full">
                    <a
                        href="/login"
                        className="p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600"
                    >
                        <h3 className="text-2xl font-bold">Login &rarr;</h3>
                        <p className="mt-4 text-xl">
                            Entre na sua conta para ver seus jogos e apostas.
                        </p>
                    </a>

                    <a
                        href="/dashboard"
                        className="p-6 mt-6 text-left border w-96 rounded-xl hover:text-blue-600 focus:text-blue-600"
                    >
                        <h3 className="text-2xl font-bold">Dashboard &rarr;</h3>
                        <p className="mt-4 text-xl">
                            Gerencie seus grupos e acompanhe o ranking.
                        </p>
                    </a>
                </div>
            </main>
        </div>
    )
}

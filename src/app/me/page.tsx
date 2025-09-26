"use client";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MePage() {
  const { data } = useSWR("/api/me", fetcher);

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Meu histórico</h1>
      {!data ? (
        <p className="text-sm text-zinc-500">Carregando…</p>
      ) : (
        <ul className="space-y-4">
          {data.recommendations?.map((r: any) => (
            <li key={r.id} className="rounded-2xl border p-4">
              <div className="mb-2 text-sm text-zinc-500">
                {new Date(r.createdAt).toLocaleString()} — {r.weather.tempC}°C
              </div>
              <div className="flex flex-wrap gap-2">
                {r.items.map((it: any) => (
                  <span
                    key={it.coffee.id}
                    className="rounded-full bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                    {it.coffee.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                {r.explanation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

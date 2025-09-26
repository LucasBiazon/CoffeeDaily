"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

export type DrinkType = "hot" | "iced";
export type RecommendationItem = {
  coffee: {
    id: string;
    name: string;
    imageUrl: string | null;
    tags: string[];
    tempAllowed: DrinkType[];
  };
  score: number;
};
export type APIRecommendationResponse = {
  weather: {
    tempC: number;
    feelsLikeC: number | null;
    humidity: number | null;
    isRaining: boolean;
    tz: string;
    source: string;
  };
  items: RecommendationItem[];
  explanation: string;
  recommendationId: string;
};

const PURPLE = "rgba(160, 101, 199, 1)";

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<APIRecommendationResponse | null>(null);

  const recommendNow = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const coords = await getCoordsWithFallback();
      const res = await fetch("/api/recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coords }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(j?.message || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as APIRecommendationResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao recomendar");
    } finally {
      setLoading(false);
    }
  }, []);

  // Faz 1ª recomendação automática ao entrar
  useEffect(() => {
    // Evita dupla chamada em dev strict mode
    let mounted = true;
    getCoordsWithFallback()
      .then((coords) =>
        fetch("/api/recommendation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coords }),
        })
      )
      .then(async (res) => {
        if (!res?.ok) return;
        const json = (await res.json()) as APIRecommendationResponse;
        if (mounted) setData(json);
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Coffee Recommender
        </h1>
        <div className="flex gap-2">
          <Link
            href="/onboarding"
            className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
            Preferências
          </Link>
          <button
            onClick={recommendNow}
            className="rounded-xl px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: PURPLE }}
            disabled={loading}>
            {loading ? "Recomendando…" : "Recomendar agora"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {data?.explanation && (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {data.explanation}
        </p>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data?.items?.map((item) => (
          <RecommendationCard key={item.coffee.id} item={item} />
        ))}
      </section>

      {data?.recommendationId && data?.items?.length ? (
        <div className="rounded-xl border p-4 text-sm">
          <p className="mb-2 font-medium">Curtiu as sugestões?</p>
          <div className="flex gap-2">
            <FeedbackButton
              recommendationId={data.recommendationId}
              coffeeId={data.items[0].coffee.id}
              rating={1}
            />
            <FeedbackButton
              recommendationId={data.recommendationId}
              coffeeId={data.items[0].coffee.id}
              rating={-1}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function RecommendationCard({ item }: { item: RecommendationItem }) {
  const pct = Math.round(item.score * 100);
  return (
    <article className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {item.coffee.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.coffee.imageUrl}
          alt={item.coffee.name}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="h-40 w-full bg-zinc-100 dark:bg-zinc-800" />
      )}
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold leading-tight">
            {item.coffee.name}
          </h3>
          <span
            className="rounded-full px-2 py-0.5 text-xs text-white"
            style={{ backgroundColor: PURPLE }}>
            {pct}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {item.coffee.tempAllowed.map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
              {t === "hot" ? "quente" : "gelado"}
            </span>
          ))}
          {item.coffee.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function FeedbackButton({
  recommendationId,
  coffeeId,
  rating,
}: {
  recommendationId: string;
  coffeeId: string;
  rating: -1 | 1;
}) {
  const [sent, setSent] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  const label = rating === 1 ? "👍 Gostei" : "👎 Não curti";

  const send = async () => {
    setErr(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recommendationId, coffeeId, rating }),
      });
      if (!res.ok) throw new Error("Falha ao enviar feedback");
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro desconhecido");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={send}
        disabled={sent}
        className="rounded-xl px-3 py-2 text-sm text-white disabled:opacity-60"
        style={{ backgroundColor: PURPLE }}>
        {sent ? "Obrigado!" : label}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  );
}

async function getCoordsWithFallback(): Promise<{ lat: number; lon: number }> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return { lat: -23.55052, lon: -46.633308 };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: -23.55052, lon: -46.633308 }),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

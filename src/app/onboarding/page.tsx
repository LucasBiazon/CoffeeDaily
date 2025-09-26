import { useState } from "react";

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
        style={{ backgroundColor: "purple" }}>
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

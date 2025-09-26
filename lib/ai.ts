import OpenAI from "openai";
import { z } from "zod";
import type { PreferencesInput } from "./schemas";
import type { CurrentWeather } from "./weather";
import type { CoffeeCatalogItem } from "./catalog";

const RecoSchema = z.object({
  items: z.array(z.object({
    coffeeId: z.string(),
    score: z.number().min(0).max(1),
  })).min(1).max(3),
  explanation_pt: z.string().max(240)
});
export type RecoOutput = z.infer<typeof RecoSchema>;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function rerankAndExplain(
  preRanked: { coffee: CoffeeCatalogItem; score: number }[],
  weather: CurrentWeather,
  prefs: PreferencesInput,
  model: string = process.env.OPENAI_MODEL || "gpt-4o-mini"
): Promise<RecoOutput> {
  if (!process.env.OPENAI_API_KEY) {
    const items = preRanked.slice(0, 3).map(({ coffee, score }) => ({ coffeeId: coffee.id, score }));
    return {
      items,
      explanation_pt: "Usei regras simples: temperatura e preferências para ordenar os cafés.",
    };
  }

  const payload = {
    CLIMA: {
      tempC: weather.tempC,
      feelsLikeC: weather.feelsLikeC,
      humidity: weather.humidity,
      isRaining: weather.isRaining,
      tz: weather.tz,
    },
    PREFERENCIAS: prefs,
    CANDIDATOS: preRanked.map(({ coffee, score }) => ({
      id: coffee.id, name: coffee.name, tags: coffee.tags, tempAllowed: coffee.tempAllowed, base: score,
    })),
    TAREFA: "Reordene e devolva no formato solicitado (até 3 itens) com explicação_pt curta (<=240 chars).",
  };

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "Você é um barista. Responda SOMENTE com JSON válido conforme o schema fornecido. Não inclua comentários.",
        },
        {
          role: "user",
          content:
            `SCHEMA: ${RecoSchema.toString()}\n\n` +
            `ENTRADA:\n${JSON.stringify(payload)}`,
        },
      ],
      response_format: { type: "json_object" } 
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = RecoSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) throw new Error("AI JSON inválido");
    return parsed.data;
  } catch (err) {
    const items = preRanked.slice(0, 3).map(({ coffee, score }) => ({ coffeeId: coffee.id, score }));
    return {
      items,
      explanation_pt:
        "Tive um problema ao usar a IA agora; usei a ordenação base por clima e preferências.",
    };
  }
}

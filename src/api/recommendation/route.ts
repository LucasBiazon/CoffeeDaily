import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { coordsSchema, preferenceSchema } from "@/lib/schemas";
import { getCurrentWeather } from "@/lib/weather";
import { getCatalog } from "@/lib/catalog";
import { scoreCandidates, climateBucket } from "@/lib/scoring";
import { rerankAndExplain } from "@/lib/ai";
import { getOrCreateUserFromCookie } from "../_user";

export const runtime = "nodejs";


export async function POST(req: NextRequest) {
  try {
    const { user, setCookie } = await getOrCreateUserFromCookie();

 
    let body: any = {};
    try { body = await req.json(); } catch {}
    const coords = body?.coords
      ? coordsSchema.parse(body.coords)
      : { lat: -23.55052, lon: -46.633308 }; 

    const weather = await getCurrentWeather(coords);

    const prefRaw = await prisma.preference.findUnique({ where: { userId: user.id } });
    const prefs = preferenceSchema.partial().parse({
      roast: prefRaw?.roast ?? undefined,
      tempPref: prefRaw?.tempPref ?? undefined,
      dairy: prefRaw?.dairy ?? undefined,
      sweetness: prefRaw?.sweetness ?? undefined,
      caffeine: prefRaw?.caffeine ?? undefined,
      flavorNotes: (prefRaw?.flavorNotes as string[] | undefined) ?? [],
    });

    const bucket = climateBucket(weather.tempC);
    const mainType =
      prefs.tempPref ??
      (bucket === "hot" ? "iced" : bucket === "cold" ? "hot" : "hot");

    const catalog = await getCatalog(mainType);

    const preRanked = scoreCandidates(catalog, weather, prefs, 8);

    const reco = await rerankAndExplain(preRanked, weather, prefs);

    const weatherRec = await prisma.weatherSnapshot.create({
      data: {
        userId: user.id,
        lat: coords.lat,
        lon: coords.lon,
        tz: weather.tz,
        tempC: weather.tempC,
        feelsLikeC: weather.feelsLikeC,
        humidity: weather.humidity ?? null,
        isRaining: weather.isRaining,
        raw: weather as any,
      },
    });

    const recommendation = await prisma.recommendation.create({
      data: {
        userId: user.id,
        weatherId: weatherRec.id,
        explanation: reco.explanation_pt,
        modelVersion: "v1",
        rawModel: reco as any,
        items: {
          create: reco.items.map((it) => ({
            coffeeId: it.coffeeId,
            score: it.score,
          })),
        },
      },
      include: { items: true },
    });

    const coffees = await prisma.coffee.findMany({
     // app/api/recommendation/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { coordsSchema, preferenceSchema } from "@/lib/schemas";
import { getCurrentWeather } from "@/lib/weather";
import { getCatalog } from "@/lib/catalog";
import { scoreCandidates, climateBucket } from "@/lib/scoring";
import { rerankAndExplain } from "@/lib/ai";
import { getOrCreateUserFromCookie } from "../_user";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type DrinkType = "hot" | "iced";
type TempAllowed = Array<DrinkType>;

const bodySchema = z.object({
  coords: coordsSchema.optional(),
});

// validação dos campos JSON vindos do banco
const tagsZ = z.array(z.string());
const tempAllowedZ = z.array(z.enum(["hot", "iced"]));

// helper para garantir JSON serializável (sem cast para any)
function toJson<T>(obj: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(obj)) as Prisma.InputJsonValue;
}

export async function POST(req: NextRequest) {
  try {
    const { user, setCookie } = await getOrCreateUserFromCookie();

    // 1) Body + coords tipados
    const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
    const coords = parsedBody.success
      ? parsedBody.data.coords ?? { lat: -23.55052, lon: -46.633308 }
      : { lat: -23.55052, lon: -46.633308 };

    // 2) Clima atual
    const weather = await getCurrentWeather(coords);

    // 3) Preferências (parcial) tipadas
    const prefRaw = await prisma.preference.findUnique({ where: { userId: user.id } });
    const prefs = preferenceSchema.partial().parse({
      roast: prefRaw?.roast ?? undefined,
      tempPref: prefRaw?.tempPref ?? undefined,
      dairy: prefRaw?.dairy ?? undefined,
      sweetness: prefRaw?.sweetness ?? undefined,
      caffeine: prefRaw?.caffeine ?? undefined,
      flavorNotes: (prefRaw?.flavorNotes as unknown as string[] | undefined) ?? [],
    });

    // 4) Heurística de catálogo
    const bucket = climateBucket(weather.tempC);
    const mainType: DrinkType =
      prefs.tempPref ??
      (bucket === "hot" ? "iced" : bucket === "cold" ? "hot" : "hot");

    // 5) Catálogo
    const catalog = await getCatalog(mainType);

    // 6) Score determinístico → top-8
    const preRanked = scoreCandidates(catalog, weather, prefs, 8);

    // 7) IA re-rank + explicação
    const reco = await rerankAndExplain(preRanked, weather, prefs);

    // 8) Persistência
    const weatherRec = await prisma.weatherSnapshot.create({
      data: {
        userId: user.id,
        lat: coords.lat,
        lon: coords.lon,
        tz: weather.tz,
        tempC: weather.tempC,
        feelsLikeC: weather.feelsLikeC,
        humidity: weather.humidity ?? null,
        isRaining: weather.isRaining,
        raw: toJson(weather),
      },
    });

    const recommendation = await prisma.recommendation.create({
      data: {
        userId: user.id,
        weatherId: weatherRec.id,
        explanation: reco.explanation_pt,
        modelVersion: "v1",
        rawModel: toJson(reco),
        items: {
          create: reco.items.map((it) => ({
            coffeeId: it.coffeeId,
            score: it.score,
          })),
        },
      },
      include: { items: true },
    });

    // 9) Monta resposta com cafés (sem any)
    const coffeeIds: string[] = recommendation.items.map((i) => i.coffeeId);

    const coffees = await prisma.coffee.findMany({
      where: { id: { in: coffeeIds } },
    });

    // Tipar e validar os campos JSON do banco
    const coffeeViewById = new Map(
      coffees.map((c) => {
        const tags = tagsZ.safeParse(c.tags).success
          ? (c.tags as string[])
          : [];
        const tempAllowed = tempAllowedZ.safeParse(c.tempAllowed).success
          ? (c.tempAllowed as TempAllowed)
          : [];
        return [
          c.id,
          {
            id: c.id,
            name: c.name,
            imageUrl: c.imageUrl ?? null,
            tags,
            tempAllowed,
          },
        ] as const;
      })
    );

    const items = recommendation.items
      .map((it) => {
        const cv = coffeeViewById.get(it.coffeeId);
        return {
          coffee:
            cv ??
            ({
              id: it.coffeeId,
              name: it.coffeeId,
              imageUrl: null,
              tags: [] as string[],
              tempAllowed: [] as TempAllowed,
            } as const),
          score: it.score,
        };
      })
      .sort((a, b) => b.score - a.score);

    const res = NextResponse.json({
      weather: {
        tempC: weather.tempC,
        feelsLikeC: weather.feelsLikeC,
        humidity: weather.humidity,
        isRaining: weather.isRaining,
        tz: weather.tz,
        source: weather.source,
      },
      items,
      explanation: recommendation.explanation,
      recommendationId: recommendation.id,
    });

    if (setCookie) {
      res.cookies.set(setCookie.name, setCookie.value, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { error: "recommendation_failed", message },
      { status: 500 }
    );
  }
}


    const res = NextResponse.json({
      weather: {
        tempC: weather.tempC,
        feelsLikeC: weather.feelsLikeC,
        humidity: weather.humidity,
        isRaining: weather.isRaining,
        tz: weather.tz,
        source: weather.source,
      },
      items,
      explanation: recommendation.explanation,
      recommendationId: recommendation.id,
    });

    if (setCookie) res.cookies.set(setCookie.name, setCookie.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "recommendation_failed", message: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}

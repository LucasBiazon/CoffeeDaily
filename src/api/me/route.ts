import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateUserFromCookie } from "../_user";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const { user, setCookie } = await getOrCreateUserFromCookie();
    const preferences = await prisma.preference.findUnique({ where: { userId: user.id } });
    const recs = await prisma.recommendation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { items: true, weather: true },
    });

    // traz info dos cafés para os itens
    const coffeeIds = recs.flatMap(r => r.items.map(i => i.coffeeId));
    const coffees = await prisma.coffee.findMany({ where: { id: { in: coffeeIds } } });
    const byId = new Map(coffees.map(c => [c.id, c]));

    const payload = {
      user: { id: user.id, email: user.email, name: user.name },
      preferences,
      recommendations: recs.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        explanation: r.explanation,
        weather: {
          tempC: r.weather.tempC,
          isRaining: r.weather.isRaining,
          tz: r.weather.tz,
        },
        items: r.items
          .map(i => ({
            score: i.score,
            coffee: {
              id: i.coffeeId,
              name: byId.get(i.coffeeId)?.name ?? i.coffeeId,
              imageUrl: byId.get(i.coffeeId)?.imageUrl ?? null,
              tags: (byId.get(i.coffeeId)?.tags as string[]) ?? [],
              tempAllowed: (byId.get(i.coffeeId)?.tempAllowed as ("hot"|"iced")[]) ?? [],
            }
          }))
          .sort((a,b) => b.score - a.score),
      })),
    };

    const res = NextResponse.json(payload);
    if (setCookie) res.cookies.set(setCookie.name, setCookie.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "me_failed", message: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}

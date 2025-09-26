import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { preferenceSchema } from "@/lib/schemas";
import { getOrCreateUserFromCookie } from "../_user"; 

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prefs = preferenceSchema.parse(body);

    const { user, setCookie } = await getOrCreateUserFromCookie();

    const saved = await prisma.preference.upsert({
      where: { userId: user.id },
      update: {
        roast: prefs.roast ?? null,
        tempPref: prefs.tempPref ?? null,
        dairy: prefs.dairy ?? null,
        sweetness: prefs.sweetness ?? null,
        caffeine: prefs.caffeine ?? null,
        flavorNotes: (prefs.flavorNotes ?? []) as any, 
      },
      create: {
        userId: user.id,
        roast: prefs.roast ?? null,
        tempPref: prefs.tempPref ?? null,
        dairy: prefs.dairy ?? null,
        sweetness: prefs.sweetness ?? null,
        caffeine: prefs.caffeine ?? null,
        flavorNotes: (prefs.flavorNotes ?? []) as any,
      },
    });

    const res = NextResponse.json({ ok: true, preferences: saved });
    if (setCookie) res.cookies.set(setCookie.name, setCookie.value, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "preferences_invalid", message: err?.message ?? "unknown" },
      { status: 400 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const t = searchParams.get("type");
    const type = t === "iced" ? "iced" : "hot";
    const items = await getCatalog(type);
    return NextResponse.json({ type, items });
  } catch (err: any) {
    return NextResponse.json(
      { error: "catalog_failed", message: err?.message ?? "unknown" },
      { status: 500 }
    );
  }
}

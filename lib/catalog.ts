import { prisma } from "./db";

export type CoffeeCatalogItem = {
  id: string;                          
  name: string;
  tempAllowed: ("hot" | "iced")[];      
  tags: string[];                       
  imageUrl?: string | null;
  provider: "sampleapis";
  externalId: string;
};

function normalizeItem(raw: any, type: "hot" | "iced"): CoffeeCatalogItem {
  const name = raw?.title ?? raw?.name ?? `Coffee ${raw?.id ?? ""}`.trim();
  const ingredients: string[] = Array.isArray(raw?.ingredients) ? raw.ingredients : [];
  const desc: string = typeof raw?.description === "string" ? raw.description : "";

  const baseTags = new Set<string>();
  for (const t of ingredients) baseTags.add(String(t).toLowerCase());
  const d = desc.toLowerCase();
  if (d.includes("chocolate")) baseTags.add("chocolate");
  if (d.includes("vanilla") || d.includes("baunilha")) baseTags.add("vanilla");
  if (d.includes("caramel")) baseTags.add("caramel");
  if (d.includes("milk") || d.includes("leite")) baseTags.add("milk");
  if (d.includes("espresso")) baseTags.add("espresso");
  if (d.includes("ice") || d.includes("gelado")) baseTags.add("ice");

  return {
    id: `${type}-${raw?.id}`,
    name,
    tempAllowed: [type],
    tags: Array.from(baseTags),
    imageUrl: raw?.image ?? null,
    provider: "sampleapis",
    externalId: String(raw?.id),
  };
}

export async function getCatalog(type: "hot" | "iced"): Promise<CoffeeCatalogItem[]> {
  const fromDb = await prisma.coffee.findMany();
  const filtered = fromDb
    .filter(c => Array.isArray(c.tempAllowed))
    .filter(c => (c.tempAllowed as any[]).includes(type))
    .map(c => ({
      id: c.id,
      name: c.name,
      tempAllowed: c.tempAllowed as ("hot" | "iced")[],
      tags: c.tags as string[],
      imageUrl: c.imageUrl,
      provider: c.provider as "sampleapis",
      externalId: c.externalId,
    }));

  if (filtered.length > 0) return filtered;

  const res = await fetch(`https://api.sampleapis.com/coffee/${type}`);
  if (!res.ok) throw new Error(`catalog http ${res.status}`);
  const list = (await res.json()) as any[];

  const normalized = list.map(item => normalizeItem(item, type));

  await prisma.$transaction(
    normalized.map((it) =>
      prisma.coffee.upsert({
        where: { id: it.id },
        update: {
          name: it.name,
          tags: it.tags as any,
          tempAllowed: it.tempAllowed as any,
          imageUrl: it.imageUrl,
          provider: it.provider,
          externalId: it.externalId,
        },
        create: {
          id: it.id,
          name: it.name,
          tags: it.tags as any,
          tempAllowed: it.tempAllowed as any,
          imageUrl: it.imageUrl,
          provider: it.provider,
          externalId: it.externalId,
        },
      })
    )
  );

  return normalized;
}

import { prisma } from "../lib/db";

async function main() {
  for (const type of ["hot","iced"] as const) {
    const res = await fetch(`https://api.sampleapis.com/coffee/${type}`);
    const list = await res.json() as any[];
    for (const it of list) {
      await prisma.coffee.upsert({
        where: { id: `${type}-${it.id}` },
        update: {},
        create: {
          id: `${type}-${it.id}`,
          name: it.title || it.name || `Coffee ${it.id}`,
          tags: it.ingredients ? it.ingredients : [],
          tempAllowed: [type],
          imageUrl: it.image || null,
          provider: "sampleapis",
          externalId: String(it.id),
        },
      });
    }
  }
  console.log("Seed ok");
}
main().then(() => process.exit(0));

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export async function getOrCreateUserFromCookie() {
  const jar = await cookies();
  const uid = jar.get("uid")?.value;

  if (uid) {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (user) return { user, setCookie: null as null | {name:string,value:string} };
  }

  const user = await prisma.user.create({ data: {} });
  return { user, setCookie: { name: "uid", value: user.id } };
}

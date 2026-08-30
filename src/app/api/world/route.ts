import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { worlds } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: worlds.id,
        name: worlds.name,
        seedText: worlds.seedText,
        updatedAt: worlds.updatedAt,
        createdAt: worlds.createdAt,
      })
      .from(worlds)
      .orderBy(desc(worlds.updatedAt));
    return NextResponse.json({ worlds: rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "Unnamed World").slice(0, 80);
    const [row] = await db
      .insert(worlds)
      .values({
        name,
        seedText: String(body.seedText ?? ""),
        params: body.params ?? {},
        overrides: body.overrides ?? {},
      })
      .returning();
    return NextResponse.json({ world: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

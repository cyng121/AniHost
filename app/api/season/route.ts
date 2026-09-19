import { NextResponse } from "next/server";
import { loadTitle } from "@/lib/catalogue";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ ok: false, error: "Missing slug parameter" }, { status: 400 });
  }

  try {
    const result = await loadTitle(slug);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, status: result.status }, { status: 200 });
    }

    const { info, episodes } = result;

    return NextResponse.json({
      ok: true,
      slug,
      info,
      episodes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

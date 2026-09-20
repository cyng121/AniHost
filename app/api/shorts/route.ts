import { NextResponse } from "next/server";
import { fetchAniCoreShorts } from "@/lib/anicore-trailers";

export const runtime = "edge";
export const dynamic = "force-dynamic";


export async function GET() {
  try {
    // Pull a fresh batch of randomly sampled world anime trailers
    const shorts = await fetchAniCoreShorts({ randomPages: true });
    return NextResponse.json({ shorts }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      }
    });
  } catch (err) {
    console.error("[api/shorts] error:", err);
    return NextResponse.json({ shorts: [] }, { status: 500 });
  }
}

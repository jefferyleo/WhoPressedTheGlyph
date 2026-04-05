import { NextResponse } from "next/server";
import { fetchStratzGlyphEvents } from "@/lib/stratz";
import { getCachedGlyphEvents, requestParse } from "@/lib/supabase";

/**
 * Unified glyph endpoint:
 * 1. Try STRATZ first (fast)
 * 2. Check Supabase cache (already parsed?)
 * 3. If not cached, create a pending parse job
 * 4. Return status for client to poll
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  const matchId = Number(id);

  // 1. Try STRATZ first
  try {
    const result = await fetchStratzGlyphEvents(id);
    if (result.glyphEvents.length > 0) {
      return NextResponse.json({
        glyphEvents: result.glyphEvents,
        source: "stratz",
        status: "completed",
      });
    }
  } catch {
    // STRATZ failed, continue to fallback
  }

  // 2. Check Supabase cache
  const cached = await getCachedGlyphEvents(matchId);

  if (cached) {
    if (cached.status === "completed" && cached.glyph_data) {
      return NextResponse.json({
        glyphEvents: cached.glyph_data,
        source: "parser",
        status: "completed",
      });
    }
    if (cached.status === "failed") {
      return NextResponse.json({
        glyphEvents: [],
        source: "parser",
        status: "failed",
        error: cached.error || "Parse failed",
      });
    }
    if (cached.status === "pending" || cached.status === "parsing") {
      return NextResponse.json({
        glyphEvents: [],
        source: "parser",
        status: cached.status,
      });
    }
  }

  // 3. No STRATZ data and no cache — request a parse job
  const job = await requestParse(matchId);

  if (job) {
    return NextResponse.json({
      glyphEvents: [],
      source: "parser",
      status: job.status,
    });
  }

  // 4. Supabase not configured — return empty
  return NextResponse.json({
    glyphEvents: [],
    source: "none",
    status: "completed",
    error: "No glyph timestamp data available.",
  });
}

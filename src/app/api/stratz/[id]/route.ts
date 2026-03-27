import { NextResponse } from "next/server";
import { getMatch } from "@/lib/opendota";
import type { GlyphEvent } from "@/lib/types";

const STRATZ_API_URL = "https://api.stratz.com/graphql";
const STRATZ_TOKEN = process.env.STRATZ_API_KEY || "";

// STRATZ chat event type 12 = CHAT_MESSAGE_GLYPH_USED
const GLYPH_CHAT_TYPE = 12;

const MATCH_QUERY = `
  query GetMatchGlyphData($matchId: Long!) {
    match(id: $matchId) {
      id
      chatEvents {
        time
        type
        isRadiant
        fromHeroId
        value
      }
      players {
        heroId
        isRadiant
        playerSlot
      }
    }
  }
`;

interface StratzChatEvent {
  time: number;
  type: number;
  isRadiant: boolean | null;
  fromHeroId: number | null;
  value: number;
}

interface StratzPlayer {
  heroId: number;
  isRadiant: boolean;
  playerSlot: number;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  if (!STRATZ_TOKEN) {
    return NextResponse.json(
      { error: "STRATZ API key not configured. Set STRATZ_API_KEY env var." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(STRATZ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRATZ_TOKEN}`,
        "User-Agent": "WhoPressedTheGlyph/1.0",
      },
      body: JSON.stringify({
        query: MATCH_QUERY,
        variables: { matchId: Number(id) },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (text.includes("Just a moment") || text.includes("challenge")) {
        return NextResponse.json(
          {
            error:
              "STRATZ API is temporarily unavailable (Cloudflare challenge). Please try again later.",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: `STRATZ API returned status ${res.status}` },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (data.errors) {
      return NextResponse.json(
        { error: data.errors[0]?.message || "STRATZ GraphQL error" },
        { status: 502 }
      );
    }

    const match = data.data?.match;
    if (!match) {
      return NextResponse.json(
        { error: "Match not found on STRATZ." },
        { status: 404 }
      );
    }

    // Get OpenDota data for per-player glyph counts (to attribute hero)
    let playerGlyphCounts: Record<
      number,
      { heroId: number; glyphUses: number; isRadiant: boolean }
    > = {};
    try {
      const odMatch = await getMatch(id);
      for (const p of odMatch.players) {
        const glyphUses = p.actions?.["24"] ?? 0;
        if (glyphUses > 0) {
          playerGlyphCounts[p.hero_id] = {
            heroId: p.hero_id,
            glyphUses,
            isRadiant: p.isRadiant,
          };
        }
      }
    } catch {
      // OpenDota not available, proceed without hero attribution
    }

    const stratzPlayers: StratzPlayer[] = match.players || [];
    const chatEvents: StratzChatEvent[] = match.chatEvents || [];

    // Extract glyph events
    const rawGlyphs = chatEvents.filter((e) => e.type === GLYPH_CHAT_TYPE);

    // Attribute hero to each glyph event using OpenDota per-player counts
    // Strategy: for each team, track glyph users and assign chronologically
    const radiantGlyphers = Object.values(playerGlyphCounts)
      .filter((p) => p.isRadiant)
      .sort((a, b) => b.glyphUses - a.glyphUses);
    const direGlyphers = Object.values(playerGlyphCounts)
      .filter((p) => !p.isRadiant)
      .sort((a, b) => b.glyphUses - a.glyphUses);

    // Build assignment queues: each hero gets N slots in the queue
    const radiantQueue: number[] = [];
    for (const p of radiantGlyphers) {
      for (let i = 0; i < p.glyphUses; i++) radiantQueue.push(p.heroId);
    }
    const direQueue: number[] = [];
    for (const p of direGlyphers) {
      for (let i = 0; i < p.glyphUses; i++) direQueue.push(p.heroId);
    }

    let radiantIdx = 0;
    let direIdx = 0;

    const glyphEvents: GlyphEvent[] = rawGlyphs.map((e) => {
      const isRadiant = e.isRadiant ?? null;
      let heroId: number | null = null;

      // Assign hero from the queue for this team
      if (isRadiant === true && radiantIdx < radiantQueue.length) {
        heroId = radiantQueue[radiantIdx++];
      } else if (isRadiant === false && direIdx < direQueue.length) {
        heroId = direQueue[direIdx++];
      }

      // Find playerSlot from STRATZ players data
      let playerSlot = -1;
      if (heroId) {
        const sp = stratzPlayers.find((p) => p.heroId === heroId);
        if (sp) playerSlot = sp.playerSlot;
      }

      return {
        time: e.time,
        playerSlot,
        isRadiant,
        heroId,
      };
    });

    return NextResponse.json({
      glyphEvents,
      source: "stratz",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch from STRATZ: ${message}` },
      { status: 502 }
    );
  }
}

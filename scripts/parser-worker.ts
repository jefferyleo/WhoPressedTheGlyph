/**
 * Parser Worker — runs on Mac Mini alongside Docker odota/parser
 *
 * Polls Supabase for pending parse jobs, processes them locally,
 * and writes results back to Supabase.
 *
 * Usage:
 *   npx tsx scripts/parser-worker.ts
 *
 * Requires:
 *   - Docker running: docker run -p 5600:5600 odota/parser
 *   - Environment variables in .env.local
 */

import { createClient } from "@supabase/supabase-js";

// Load .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";
const PARSER_URL = process.env.PARSER_URL || "http://localhost:5600";
const POLL_INTERVAL = 30_000; // 30 seconds

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface GlyphEvent {
  time: number;
  playerSlot: number;
  isRadiant: boolean | null;
  heroId: number | null;
}

async function getReplayUrl(matchId: number): Promise<string | null> {
  const res = await fetch(`https://api.opendota.com/api/matches/${matchId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.replay_url || null;
}

async function parseReplay(replayUrl: string): Promise<GlyphEvent[]> {
  // Download the replay file
  console.log("  Downloading replay...");
  const downloadRes = await fetch(replayUrl, {
    signal: AbortSignal.timeout(120_000),
  });
  if (!downloadRes.ok) {
    throw new Error(`Failed to download replay: HTTP ${downloadRes.status}`);
  }
  const replayBuffer = Buffer.from(await downloadRes.arrayBuffer());
  console.log(`  Downloaded ${(replayBuffer.length / 1024 / 1024).toFixed(1)}MB`);

  // Decompress bz2 if needed
  let demBuffer: Buffer;
  if (replayUrl.endsWith(".bz2")) {
    console.log("  Decompressing bz2...");
    const { execSync } = await import("child_process");
    // Write to temp file, decompress, read back
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const tmpBz2 = path.join(os.tmpdir(), `replay_${Date.now()}.dem.bz2`);
    const tmpDem = tmpBz2.replace(".bz2", "");
    fs.writeFileSync(tmpBz2, replayBuffer);
    try {
      execSync(`bunzip2 -f "${tmpBz2}"`, { timeout: 60_000 });
      demBuffer = fs.readFileSync(tmpDem);
      fs.unlinkSync(tmpDem);
    } catch {
      // Try with bzip2 -d as fallback
      try {
        execSync(`bzip2 -d -f "${tmpBz2}"`, { timeout: 60_000 });
        demBuffer = fs.readFileSync(tmpDem);
        fs.unlinkSync(tmpDem);
      } catch {
        // Clean up
        try { fs.unlinkSync(tmpBz2); } catch {}
        try { fs.unlinkSync(tmpDem); } catch {}
        throw new Error("Failed to decompress replay (bunzip2/bzip2 not found)");
      }
    }
    console.log(`  Decompressed to ${(demBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  } else {
    demBuffer = replayBuffer;
  }

  // Send raw .dem to parser POST / endpoint (returns NDJSON)
  console.log("  Sending to parser...");
  const res = await fetch(PARSER_URL, {
    method: "POST",
    body: demBuffer,
    headers: { "Content-Type": "application/octet-stream" },
    signal: AbortSignal.timeout(300_000),
  });

  if (res.status === 204) {
    throw new Error("Replay file is corrupted or unavailable");
  }
  if (!res.ok) {
    throw new Error(`Parser returned status ${res.status}`);
  }

  const text = await res.text();
  const glyphEvents: GlyphEvent[] = [];

  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (
        event.type === "chat_message_glyph_used" ||
        event.type === "CHAT_MESSAGE_GLYPH_USED" ||
        event.type === 12
      ) {
        glyphEvents.push({
          time: Math.round(event.time ?? 0),
          playerSlot: event.player1 ?? event.playerid_1 ?? event.slot ?? -1,
          isRadiant: null,
          heroId: null,
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return glyphEvents;
}

async function processJob(matchId: number): Promise<void> {
  console.log(`[${new Date().toISOString()}] Processing match ${matchId}...`);

  // Mark as parsing
  await supabase
    .from("glyph_events")
    .update({ status: "parsing", updated_at: new Date().toISOString() })
    .eq("match_id", matchId);

  try {
    // Get replay URL
    const replayUrl = await getReplayUrl(matchId);
    if (!replayUrl) {
      throw new Error("No replay URL available (replay may have expired)");
    }

    console.log(`  Replay URL: ${replayUrl}`);
    console.log(`  Parsing... (this may take a few minutes)`);

    // Parse replay
    const glyphEvents = await parseReplay(replayUrl);

    console.log(`  Found ${glyphEvents.length} glyph events`);

    // Write results
    await supabase
      .from("glyph_events")
      .update({
        status: "completed",
        glyph_data: glyphEvents,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("match_id", matchId);

    console.log(`  Done! Match ${matchId} completed.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`  Failed: ${message}`);

    await supabase
      .from("glyph_events")
      .update({
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("match_id", matchId);
  }
}

async function pollForJobs(): Promise<void> {
  const { data: jobs, error } = await supabase
    .from("glyph_events")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    console.error("Failed to poll Supabase:", error.message);
    return;
  }

  if (jobs && jobs.length > 0) {
    await processJob(jobs[0].match_id);
  }
}

// Main loop
console.log("=== Dota 2 Replay Parser Worker ===");
console.log(`Parser URL: ${PARSER_URL}`);
console.log(`Supabase: ${SUPABASE_URL}`);
console.log(`Polling every ${POLL_INTERVAL / 1000}s for pending jobs...`);
console.log("");

// Check parser is running
fetch(PARSER_URL)
  .then((res) => {
    if (res.ok) console.log("Parser is reachable. Ready to process jobs.\n");
    else console.warn("Parser responded with status", res.status, "\n");
  })
  .catch(() => {
    console.error(
      "WARNING: Parser is not reachable at",
      PARSER_URL,
      "\nMake sure to run: docker run -p 5600:5600 odota/parser\n"
    );
  });

// Poll immediately, then on interval
pollForJobs();
setInterval(pollForJobs, POLL_INTERVAL);

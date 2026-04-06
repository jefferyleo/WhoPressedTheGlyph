const STRATZ_API_URL = "https://api.stratz.com/graphql";
const STRATZ_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsd2ZramN5Ym12cGxsbHpienVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTM0MzgyMywiZXhwIjoyMDkwOTE5ODIzfQ.SOgLgcCHJtIP0ypY-tanwWqfhtNv71YFYY1zsQxCpws"; // Using the user provided token if it was for stratz? Wait, user provided a supabase JWT.
// I need the STRATZ_API_KEY from the environment if possible.
// Actually, I can't easily get the STRATZ_API_KEY from the environment in a script without it being passed.
// I'll check if there's a .env.local file.

import fs from 'fs';
import path from 'path';

async function test() {
  const matchId = 8760045249;
  
  // Try to find STRATZ_API_KEY in .env.local
  let stratzKey = process.env.STRATZ_API_KEY;
  if (!stratzKey && fs.existsSync('.env.local')) {
    const env = fs.readFileSync('.env.local', 'utf8');
    const match = env.match(/STRATZ_API_KEY=(.*)/);
    if (match) stratzKey = match[1].trim();
  }

  if (!stratzKey) {
    console.error("STRATZ_API_KEY not found in process.env or .env.local");
    return;
  }

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

  const res = await fetch(STRATZ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${stratzKey}`,
    },
    body: JSON.stringify({
      query: MATCH_QUERY,
      variables: { matchId: Number(matchId) },
    }),
  });

  const data = await res.json();
  console.log("Full data match chatEvents count:", data.data?.match?.chatEvents?.length);
  
  const glyphEvents = data.data?.match?.chatEvents?.filter((e: any) => e.type === 12);
  console.log("Glyph events from STRATZ (type 12):");
  console.log(JSON.stringify(glyphEvents, null, 2));
}

test().catch(console.error);

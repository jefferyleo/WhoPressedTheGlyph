# Who Pressed The Glyph

Dota 2 match analyzer that shows who pressed the Glyph of Fortification.

## Tech Stack

- Next.js 16 (App Router) with React 19 and TypeScript 6
- Tailwind CSS 4 for styling
- Deployed on Vercel: https://who-pressed-the-glyph.vercel.app/

## Architecture

### Data Sources

1. **OpenDota API** (free, no key): match data, player info, per-player glyph counts via `actions["24"]`, building kill objectives
2. **STRATZ GraphQL API** (free key required via `STRATZ_API_KEY`): glyph timestamps from `chatEvents` (type 12 = `CHAT_MESSAGE_GLYPH_USED`), includes `isRadiant` field

### Hero Attribution Logic

STRATZ provides glyph timestamps + team (isRadiant). OpenDota provides per-player glyph counts. The STRATZ API route (`/api/stratz/[id]`) merges them: for each team, it builds a queue of hero IDs (repeated by their glyph count) and assigns them chronologically to STRATZ glyph events.

### Key Files

- `src/app/page.tsx` - Homepage with match ID search
- `src/app/matches/[id]/page.tsx` - Match detail page (server component, fetches from OpenDota)
- `src/app/api/stratz/[id]/route.ts` - STRATZ API route for glyph timestamps + hero attribution
- `src/app/api/replay/[id]/route.ts` - Legacy replay parser route (needs Docker + PARSER_URL)
- `src/app/api/parse/[id]/route.ts` - OpenDota parse request route
- `src/lib/opendota.ts` - OpenDota API client, data transforms, building kill extraction
- `src/lib/types.ts` - TypeScript interfaces (OpenDotaMatch, GlyphEvent, MatchGlyphResult, etc.)
- `src/components/GlyphResult.tsx` - Main result component; loads glyph timestamps on demand via STRATZ
- `src/components/TowerTimeline.tsx` - Timeline with building kills + glyph events
- `src/components/PlayerCard.tsx` - Player card with hero image and stats
- `src/components/MatchInfo.tsx` - Match info header

### Data Flow

1. User enters match ID on homepage
2. Server component (`matches/[id]/page.tsx`) fetches match + heroes from OpenDota
3. `transformMatchData()` extracts player stats, glyph counts, building kills
4. Client component (`GlyphResult`) renders match; user clicks to load glyph timestamps
5. Client fetches `/api/stratz/[id]` which combines STRATZ timestamps with OpenDota player data

## Environment Variables

- `STRATZ_API_KEY` (required) - Bearer token for STRATZ GraphQL API
- `PARSER_URL` (optional) - URL for local odota/parser Docker container (legacy fallback)

## Dev Commands

```bash
npm run dev    # Start dev server on port 3000
npm run build  # Production build
npm run lint   # ESLint
```

## CI/CD

- GitHub Actions: lint + build on push to main
- STRATZ API key set as Vercel environment variable

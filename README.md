# Who Pressed The Glyph?

Dota 2 match analyzer that reveals who pressed the Glyph of Fortification — with exact timestamps, hero attribution, and a building destruction timeline.

**Live:** [who-pressed-the-glyph.vercel.app](https://who-pressed-the-glyph.vercel.app/)

## Features

- **Glyph Attribution** — See which player on each team used Glyph and how many times
- **Glyph Timestamps** — Load exact game-time moments when Glyph was pressed (via STRATZ API)
- **Match Timeline** — Combined chronological view of building destructions and glyph events
- **Team Colors** — Radiant (green) and Dire (red) visual distinction throughout
- **Hero Images** — Player hero portraits from Valve's CDN
- **Parse Requests** — Request OpenDota replay parsing for unparsed matches

## How It Works

1. Enter a Dota 2 match ID
2. The app fetches match data from **OpenDota** (player stats, glyph counts, building kills)
3. Click **"Load Glyph Timestamps"** to fetch exact glyph usage times from **STRATZ**
4. The timeline merges building destructions with glyph events, showing who glyphed and when

### Hero Attribution Logic

STRATZ provides glyph timestamps + team (Radiant/Dire). OpenDota provides per-player glyph counts. The app builds a queue of heroes per team (repeated by their glyph count) and assigns them chronologically to each glyph event.

## Tech Stack

- **Next.js 16** (App Router) with **React 19** and **TypeScript 6**
- **Tailwind CSS 4** for styling
- Deployed on **Vercel**

## Getting Started

### Prerequisites

- Node.js 22+
- A free [STRATZ API key](https://stratz.com/api)

### Setup

```bash
git clone https://github.com/jefferyleo/WhoPressedTheGlyph.git
cd WhoPressedTheGlyph
npm install
```

Create a `.env.local` file:

```env
STRATZ_API_KEY=your_stratz_api_key_here
```

### Development

```bash
npm run dev    # Start dev server on http://localhost:3000
npm run build  # Production build
npm run lint   # Run ESLint
```

## Data Sources

| Source | Auth | Provides |
|--------|------|----------|
| [OpenDota API](https://docs.opendota.com/) | None (free) | Match data, player stats, per-player glyph counts, building kill objectives |
| [STRATZ GraphQL API](https://stratz.com/api) | Free API key | Glyph timestamps, team attribution, hero attribution |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRATZ_API_KEY` | Yes | Bearer token for STRATZ GraphQL API |
| `PARSER_URL` | No | URL for self-hosted [odota/parser](https://github.com/odota/parser) (legacy fallback) |

## Project Structure

```
src/
  app/
    page.tsx                    # Homepage with match ID search
    matches/[id]/page.tsx       # Match detail page (server component)
    api/
      stratz/[id]/route.ts      # STRATZ glyph timestamps + hero attribution
      parse/[id]/route.ts       # OpenDota parse request
      replay/[id]/route.ts      # Legacy replay parser route
  components/
    GlyphResult.tsx             # Main result component
    TowerTimeline.tsx           # Timeline with building kills + glyph events
    PlayerCard.tsx              # Player card with hero and stats
    MatchInfo.tsx               # Match info header
    MatchInput.tsx              # Match ID search input
  lib/
    opendota.ts                 # OpenDota API client and data transforms
    types.ts                    # TypeScript interfaces
```

## Deployment

The app auto-deploys to Vercel on push to `main`. Set `STRATZ_API_KEY` in your Vercel environment variables.

## CI/CD

GitHub Actions runs lint and build on every push to `main` and on pull requests.

## License

MIT

import Script from "next/script";
import MatchInput from "@/components/MatchInput";

export default function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <Script
        src="https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js"
        data-name="bmc-button"
        data-slug="jefferyleo"
        data-color="#FFDD00"
        data-emoji=""
        data-font="Poppins"
        data-text="Buy me a coffee"
        data-outline-color="#000000"
        data-font-color="#000000"
        data-coffee-color="#ffffff"
        strategy="lazyOnload"
      />
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">
          Who Pressed The{" "}
          <span className="text-amber-400">Glyph</span>?
        </h1>
        <p className="text-gray-400 text-lg">
          Enter a Dota 2 Match ID to find out who used the Glyph of
          Fortification
        </p>
      </div>
      <div className="w-full max-w-xl">
        <MatchInput />
      </div>
      <div className="text-sm text-gray-500 max-w-md text-center">
        Glyph data requires the match replay to be parsed. Only matches from the
        last ~2 weeks can be parsed (replays expire on Valve servers).
        <br />
        Powered by{" "}
        <a
          href="https://www.opendota.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-500 hover:underline"
        >
          OpenDota API
        </a>
      </div>
    </div>
  );
}

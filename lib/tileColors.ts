import type { TileType } from "./game/types";

/**
 * The one source of truth for tile-type accent colors, shared by the 3D board
 * bands (components/board/Board3D.tsx) and the 2D portfolio dots
 * (app/room/[roomId]/page.tsx) so the two can never drift apart.
 *
 * Every value is a distinct hue — no two tile types look alike. The eight
 * ownable asset types are spread the furthest apart (they're the ones a player
 * reads at a glance while deciding a landing); corners and card tiles take the
 * cooler/neutral remainder. Tuned to the brand palette (deep green, gold,
 * purple, red on cream) in tailwind.config.ts.
 */
export const TILE_TYPE_COLOR: Record<TileType, string> = {
  // Corners — positionally unmistakable, so they take muted, metallic tones.
  go: "#0B6E4F", // deep brand green — START / home base
  jail: "#7A6E56", // stone / taupe
  go_to_jail: "#8C2F26", // dark maroon (deliberately darker than betting's red)
  exchange_floor: "#55606B", // slate grey — the neutral floor

  // Card tiles.
  chance: "#E8B93B", // bright yellow
  community: "#7BB661", // leaf green

  // Ownable asset types — maximally separated across the wheel.
  property: "#2E8B57", // sea green
  estate: "#D4AF37", // gold (premium tier)
  bond: "#1FA39A", // teal — cool, "fixed income"
  contract: "#9A6528", // bronze — legal / paper
  betting: "#C13A3A", // casino red (brand danger)
  tech_company: "#6C4BB3", // violet
  crypto: "#C0479E", // magenta
  startup: "#E8743B", // orange — energetic
};

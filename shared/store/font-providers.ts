export interface FontFamilyDefinition {
  id: string;
  label: string;
  provider: "google";
  family: string;
  weights: readonly number[];
  category: "playful" | "futuristic" | "pixel" | "display" | "handwritten" | "techno" | "editorial";
  fallback: string;
}

export const GOOGLE_FONT_REGISTRY = [
  { id: "bungee", label: "Bungee", provider: "google", family: "Bungee", weights: [400], category: "playful", fallback: "system-ui" },
  { id: "orbitron", label: "Orbitron", provider: "google", family: "Orbitron", weights: [400, 600, 700], category: "futuristic", fallback: "system-ui" },
  { id: "press-start-2p", label: "Press Start 2P", provider: "google", family: "Press Start 2P", weights: [400], category: "pixel", fallback: "monospace" },
  { id: "bebas-neue", label: "Bebas Neue", provider: "google", family: "Bebas Neue", weights: [400], category: "display", fallback: "sans-serif" },
  { id: "caveat", label: "Caveat", provider: "google", family: "Caveat", weights: [400, 600, 700], category: "handwritten", fallback: "cursive" },
  { id: "space-grotesk", label: "Space Grotesk", provider: "google", family: "Space Grotesk", weights: [400, 500, 600, 700], category: "techno", fallback: "system-ui" },
  { id: "playfair-display", label: "Playfair Display", provider: "google", family: "Playfair Display", weights: [400, 600, 700], category: "editorial", fallback: "serif" },
] as const satisfies readonly FontFamilyDefinition[];

export type GoogleFontId = (typeof GOOGLE_FONT_REGISTRY)[number]["id"];

export function fontDefinitionByFamily(family: string): FontFamilyDefinition | undefined {
  return GOOGLE_FONT_REGISTRY.find((definition) => definition.family === family);
}

export function googleFontCssUrl(definitions: readonly FontFamilyDefinition[]): string {
  const registry = new Map<string, FontFamilyDefinition>(
    GOOGLE_FONT_REGISTRY.map((definition) => [definition.id, definition]),
  );
  const unique = new Map<string, FontFamilyDefinition>();
  for (const definition of definitions) {
    const approved = registry.get(definition.id);
    if (!approved || approved.family !== definition.family) continue;
    unique.set(approved.id, approved);
  }
  const url = new URL("https://fonts.googleapis.com/css2");
  for (const definition of unique.values()) {
    const family = definition.family.replace(/ /g, "+");
    const weights = [...definition.weights].sort((a, b) => a - b).join(";");
    url.searchParams.append("family", weights ? `${family}:wght@${weights}` : family);
  }
  url.searchParams.set("display", "swap");
  return url.toString();
}

export const WORKSPACE_IMAGE_TYPES = [
  "image/png",
  "image/apng",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;
export const WORKSPACE_BACKGROUND_BYTES = 5 * 1024 * 1024;
export const WORKSPACE_CURSOR_BYTES = 128 * 1024;
export const FONT_THEMES = [
  {
    id: "system",
    name: "Kyro Classic",
    description: "Familiar system lettering",
    family: "Inter, system-ui, sans-serif",
  },
  {
    id: "mono",
    name: "Terminal",
    description: "Your device's monospace font",
    family: "ui-monospace, monospace",
  },
  {
    id: "rounded",
    name: "Soft Focus",
    description: "Relaxed rounded lettering",
    family: "'Trebuchet MS', sans-serif",
  },
  {
    id: "orbitron",
    name: "Orbitron Command",
    description: "Squared sci-fi lettering",
    family: "'Orbitron', sans-serif",
  },
  {
    id: "rajdhani",
    name: "Rajdhani Arena",
    description: "Compact competitive type",
    family: "'Rajdhani', sans-serif",
  },
  {
    id: "oxanium",
    name: "Oxanium Neon",
    description: "Angular neon geometry",
    family: "'Oxanium', sans-serif",
  },
  {
    id: "space-grotesk",
    name: "Space Explorer",
    description: "Clean interstellar style",
    family: "'Space Grotesk', sans-serif",
  },
  {
    id: "exo-2",
    name: "Exo Runner",
    description: "Smooth technical lettering",
    family: "'Exo 2', sans-serif",
  },
  {
    id: "audiowide",
    name: "Arcade Wave",
    description: "Wide retro arcade type",
    family: "'Audiowide', sans-serif",
  },
  {
    id: "rubik",
    name: "Rubik Quest",
    description: "Rounded adventure style",
    family: "'Rubik', sans-serif",
  },
  {
    id: "barlow",
    name: "Barlow Racer",
    description: "Light motorsport-inspired type",
    family: "'Barlow', sans-serif",
  },
  {
    id: "outfit",
    name: "Outfit Stream",
    description: "Modern creator lettering",
    family: "'Outfit', sans-serif",
  },
  {
    id: "nunito",
    name: "Nunito Party",
    description: "Soft friendly rounded type",
    family: "'Nunito', sans-serif",
  },
  {
    id: "jetbrains-mono",
    name: "Code Runner",
    description: "Precise monospace lettering",
    family: "'JetBrains Mono', monospace",
  },
  {
    id: "cinzel",
    name: "Cinzel Realm",
    description: "Fantasy-inspired serif type",
    family: "'Cinzel', serif",
  },
] as const;
export const CURSOR_THEMES = [
  {
    id: "kyro",
    name: "Kyro Original",
    description: "The classic purple cursor",
  },
  {
    id: "neon-shard",
    name: "Neon Shard",
    description: "Magenta crystal edges",
  },
  {
    id: "plasma-saber",
    name: "Plasma Saber",
    description: "A luminous energy blade",
  },
  {
    id: "pixel-quest",
    name: "Pixel Quest",
    description: "A classic pixel adventure",
  },
  {
    id: "dragon-fang",
    name: "Dragon Fang",
    description: "A fiery dragon claw",
  },
  {
    id: "orbit-pilot",
    name: "Orbit Pilot",
    description: "An orbital navigator",
  },
  {
    id: "holo-grid",
    name: "Holo Grid",
    description: "A holographic circuit arrow",
  },
  {
    id: "arcane-rune",
    name: "Arcane Rune",
    description: "A violet spellcaster sigil",
  },
  {
    id: "ember-wing",
    name: "Ember Wing",
    description: "A phoenix feather trail",
  },
  {
    id: "frost-byte",
    name: "Frost Byte",
    description: "An icy crystalline arrow",
  },
  {
    id: "royal-crest",
    name: "Royal Crest",
    description: "A golden command crest",
  },
] as const;
export function workspaceFont(id: string) {
  return (
    FONT_THEMES.find((font) => font.id === id)?.family ?? FONT_THEMES[0].family
  );
}
export function cursorAssets(id: string) {
  const known = CURSOR_THEMES.some((cursor) => cursor.id === id) ? id : "kyro";
  return {
    normal: `/cursors/${known}-default.svg`,
    pointer: `/cursors/${known}-pointer.svg`,
  };
}

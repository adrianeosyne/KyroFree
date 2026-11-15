/**
 * Built-in avatar frames — gradient rings drawn around a profile picture.
 *
 * Shared by Convex (validation on save) and the client (editor + renderer),
 * so the id list lives in exactly one place. Class names are written out
 * literally so Tailwind picks them up when scanning this file.
 */
export interface AvatarFrame {
  id: string;
  label: string;
  /** Gradient stops applied as `bg-gradient-to-br ${gradient}` on the ring. */
  gradient: string;
}

export const AVATAR_FRAMES: AvatarFrame[] = [
  {
    id: "ember",
    label: "Ember",
    gradient: "from-amber-300 via-orange-500 to-rose-500",
  },
  {
    id: "aqua",
    label: "Aqua",
    gradient: "from-sky-300 via-cyan-400 to-blue-500",
  },
  {
    id: "forest",
    label: "Forest",
    gradient: "from-emerald-300 via-green-400 to-teal-600",
  },
  { id: "kyro", label: "Kyro", gradient: "from-indigo-400 via-brand to-cyan" },
  {
    id: "gold",
    label: "Gold",
    gradient: "from-yellow-200 via-amber-400 to-orange-500",
  },
  {
    id: "rose",
    label: "Rose",
    gradient: "from-pink-300 via-rose-400 to-red-500",
  },
  {
    id: "gaming-0-0",
    label: "Cyberpunk Sentinel",
    gradient: "from-fuchsia-300 via-lime-400 to-cyan-500",
  },
  {
    id: "gaming-1-0",
    label: "Dragon Sentinel",
    gradient: "from-red-300 via-violet-400 to-amber-500",
  },
  {
    id: "gaming-2-0",
    label: "Frostbite Sentinel",
    gradient: "from-sky-300 via-amber-400 to-indigo-500",
  },
  {
    id: "gaming-3-0",
    label: "Venom Sentinel",
    gradient: "from-lime-300 via-pink-400 to-emerald-500",
  },
  {
    id: "gaming-4-0",
    label: "Voidwalker Sentinel",
    gradient: "from-violet-300 via-blue-400 to-slate-500",
  },
  {
    id: "gaming-5-0",
    label: "Starforge Sentinel",
    gradient: "from-amber-300 via-slate-400 to-violet-500",
  },
  {
    id: "gaming-6-0",
    label: "Sakura Sentinel",
    gradient: "from-pink-300 via-orange-400 to-rose-500",
  },
  {
    id: "gaming-7-0",
    label: "Abyss Sentinel",
    gradient: "from-blue-300 via-purple-400 to-teal-500",
  },
  {
    id: "gaming-8-0",
    label: "Phantom Sentinel",
    gradient: "from-slate-300 via-rose-400 to-purple-500",
  },
  {
    id: "gaming-9-0",
    label: "Plasma Sentinel",
    gradient: "from-orange-300 via-cyan-400 to-fuchsia-500",
  },
  {
    id: "gaming-10-0",
    label: "Arcane Sentinel",
    gradient: "from-purple-300 via-zinc-400 to-emerald-500",
  },
  {
    id: "gaming-11-0",
    label: "Inferno Sentinel",
    gradient: "from-rose-300 via-teal-400 to-orange-500",
  },
  {
    id: "gaming-12-0",
    label: "Pixel Sentinel",
    gradient: "from-cyan-300 via-indigo-400 to-lime-500",
  },
  {
    id: "gaming-13-0",
    label: "Knight Sentinel",
    gradient: "from-zinc-300 via-green-400 to-amber-500",
  },
  {
    id: "gaming-14-0",
    label: "Mecha Sentinel",
    gradient: "from-teal-300 via-yellow-400 to-red-500",
  },
  {
    id: "gaming-15-0",
    label: "Lunar Sentinel",
    gradient: "from-indigo-300 via-fuchsia-400 to-pink-500",
  },
  {
    id: "gaming-16-0",
    label: "Glitch Sentinel",
    gradient: "from-green-300 via-violet-400 to-purple-500",
  },
  {
    id: "gaming-17-0",
    label: "Rune Sentinel",
    gradient: "from-yellow-300 via-fuchsia-400 to-blue-500",
  },
  {
    id: "gaming-18-0",
    label: "Rift Sentinel",
    gradient: "from-fuchsia-300 via-red-400 to-sky-500",
  },
  {
    id: "gaming-19-0",
    label: "Nebula Sentinel",
    gradient: "from-violet-300 via-sky-400 to-orange-500",
  },
  {
    id: "gaming-0-1",
    label: "Cyberpunk Champion",
    gradient: "from-fuchsia-400 via-violet-500 to-cyan-600",
  },
  {
    id: "gaming-1-1",
    label: "Dragon Champion",
    gradient: "from-red-400 via-amber-500 to-amber-600",
  },
  {
    id: "gaming-2-1",
    label: "Frostbite Champion",
    gradient: "from-sky-400 via-pink-500 to-indigo-600",
  },
  {
    id: "gaming-3-1",
    label: "Venom Champion",
    gradient: "from-lime-400 via-blue-500 to-emerald-600",
  },
  {
    id: "gaming-4-1",
    label: "Voidwalker Champion",
    gradient: "from-violet-400 via-slate-500 to-slate-600",
  },
  {
    id: "gaming-5-1",
    label: "Starforge Champion",
    gradient: "from-amber-400 via-orange-500 to-violet-600",
  },
  {
    id: "gaming-6-1",
    label: "Sakura Champion",
    gradient: "from-pink-400 via-purple-500 to-rose-600",
  },
  {
    id: "gaming-7-1",
    label: "Abyss Champion",
    gradient: "from-blue-400 via-rose-500 to-teal-600",
  },
  {
    id: "gaming-8-1",
    label: "Phantom Champion",
    gradient: "from-slate-400 via-cyan-500 to-purple-600",
  },
  {
    id: "gaming-9-1",
    label: "Plasma Champion",
    gradient: "from-orange-400 via-zinc-500 to-fuchsia-600",
  },
  {
    id: "gaming-10-1",
    label: "Arcane Champion",
    gradient: "from-purple-400 via-teal-500 to-emerald-600",
  },
  {
    id: "gaming-11-1",
    label: "Inferno Champion",
    gradient: "from-rose-400 via-indigo-500 to-orange-600",
  },
  {
    id: "gaming-12-1",
    label: "Pixel Champion",
    gradient: "from-cyan-400 via-green-500 to-lime-600",
  },
  {
    id: "gaming-13-1",
    label: "Knight Champion",
    gradient: "from-zinc-400 via-yellow-500 to-amber-600",
  },
  {
    id: "gaming-14-1",
    label: "Mecha Champion",
    gradient: "from-teal-400 via-fuchsia-500 to-red-600",
  },
  {
    id: "gaming-15-1",
    label: "Lunar Champion",
    gradient: "from-indigo-400 via-violet-500 to-pink-600",
  },
  {
    id: "gaming-16-1",
    label: "Glitch Champion",
    gradient: "from-green-400 via-fuchsia-500 to-purple-600",
  },
  {
    id: "gaming-17-1",
    label: "Rune Champion",
    gradient: "from-yellow-400 via-red-500 to-blue-600",
  },
  {
    id: "gaming-18-1",
    label: "Rift Champion",
    gradient: "from-fuchsia-400 via-sky-500 to-sky-600",
  },
  {
    id: "gaming-19-1",
    label: "Nebula Champion",
    gradient: "from-violet-400 via-lime-500 to-orange-600",
  },
  {
    id: "gaming-0-2",
    label: "Cyberpunk Guardian",
    gradient: "from-fuchsia-500 via-amber-600 to-cyan-700",
  },
  {
    id: "gaming-1-2",
    label: "Dragon Guardian",
    gradient: "from-red-500 via-pink-600 to-amber-700",
  },
  {
    id: "gaming-2-2",
    label: "Frostbite Guardian",
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
  },
  {
    id: "gaming-3-2",
    label: "Venom Guardian",
    gradient: "from-lime-500 via-slate-600 to-emerald-700",
  },
  {
    id: "gaming-4-2",
    label: "Voidwalker Guardian",
    gradient: "from-violet-500 via-orange-600 to-slate-700",
  },
  {
    id: "gaming-5-2",
    label: "Starforge Guardian",
    gradient: "from-amber-500 via-purple-600 to-violet-700",
  },
  {
    id: "gaming-6-2",
    label: "Sakura Guardian",
    gradient: "from-pink-500 via-rose-600 to-rose-700",
  },
  {
    id: "gaming-7-2",
    label: "Abyss Guardian",
    gradient: "from-blue-500 via-cyan-600 to-teal-700",
  },
  {
    id: "gaming-8-2",
    label: "Phantom Guardian",
    gradient: "from-slate-500 via-zinc-600 to-purple-700",
  },
  {
    id: "gaming-9-2",
    label: "Plasma Guardian",
    gradient: "from-orange-500 via-teal-600 to-fuchsia-700",
  },
  {
    id: "gaming-10-2",
    label: "Arcane Guardian",
    gradient: "from-purple-500 via-indigo-600 to-emerald-700",
  },
  {
    id: "gaming-11-2",
    label: "Inferno Guardian",
    gradient: "from-rose-500 via-green-600 to-orange-700",
  },
  {
    id: "gaming-12-2",
    label: "Pixel Guardian",
    gradient: "from-cyan-500 via-yellow-600 to-lime-700",
  },
  {
    id: "gaming-13-2",
    label: "Knight Guardian",
    gradient: "from-zinc-500 via-fuchsia-600 to-amber-700",
  },
  {
    id: "gaming-14-2",
    label: "Mecha Guardian",
    gradient: "from-teal-500 via-violet-600 to-red-700",
  },
  {
    id: "gaming-15-2",
    label: "Lunar Guardian",
    gradient: "from-indigo-500 via-fuchsia-600 to-pink-700",
  },
  {
    id: "gaming-16-2",
    label: "Glitch Guardian",
    gradient: "from-green-500 via-red-600 to-purple-700",
  },
  {
    id: "gaming-17-2",
    label: "Rune Guardian",
    gradient: "from-yellow-500 via-sky-600 to-blue-700",
  },
  {
    id: "gaming-18-2",
    label: "Rift Guardian",
    gradient: "from-fuchsia-500 via-lime-600 to-sky-700",
  },
  {
    id: "gaming-19-2",
    label: "Nebula Guardian",
    gradient: "from-violet-500 via-violet-600 to-orange-700",
  },
  {
    id: "gaming-0-3",
    label: "Cyberpunk Raider",
    gradient: "from-fuchsia-600 via-pink-700 to-cyan-800",
  },
  {
    id: "gaming-1-3",
    label: "Dragon Raider",
    gradient: "from-red-600 via-blue-700 to-amber-800",
  },
  {
    id: "gaming-2-3",
    label: "Frostbite Raider",
    gradient: "from-sky-600 via-slate-700 to-indigo-800",
  },
  {
    id: "gaming-3-3",
    label: "Venom Raider",
    gradient: "from-lime-600 via-orange-700 to-emerald-800",
  },
  {
    id: "gaming-4-3",
    label: "Voidwalker Raider",
    gradient: "from-violet-600 via-purple-700 to-slate-800",
  },
  {
    id: "gaming-5-3",
    label: "Starforge Raider",
    gradient: "from-amber-600 via-rose-700 to-violet-800",
  },
  {
    id: "gaming-6-3",
    label: "Sakura Raider",
    gradient: "from-pink-600 via-cyan-700 to-rose-800",
  },
  {
    id: "gaming-7-3",
    label: "Abyss Raider",
    gradient: "from-blue-600 via-zinc-700 to-teal-800",
  },
  {
    id: "gaming-8-3",
    label: "Phantom Raider",
    gradient: "from-slate-600 via-teal-700 to-purple-800",
  },
  {
    id: "gaming-9-3",
    label: "Plasma Raider",
    gradient: "from-orange-600 via-indigo-700 to-fuchsia-800",
  },
  {
    id: "gaming-10-3",
    label: "Arcane Raider",
    gradient: "from-purple-600 via-green-700 to-emerald-800",
  },
  {
    id: "gaming-11-3",
    label: "Inferno Raider",
    gradient: "from-rose-600 via-yellow-700 to-orange-800",
  },
  {
    id: "gaming-12-3",
    label: "Pixel Raider",
    gradient: "from-cyan-600 via-fuchsia-700 to-lime-800",
  },
  {
    id: "gaming-13-3",
    label: "Knight Raider",
    gradient: "from-zinc-600 via-violet-700 to-amber-800",
  },
  {
    id: "gaming-14-3",
    label: "Mecha Raider",
    gradient: "from-teal-600 via-fuchsia-700 to-red-800",
  },
  {
    id: "gaming-15-3",
    label: "Lunar Raider",
    gradient: "from-indigo-600 via-red-700 to-pink-800",
  },
  {
    id: "gaming-16-3",
    label: "Glitch Raider",
    gradient: "from-green-600 via-sky-700 to-purple-800",
  },
  {
    id: "gaming-17-3",
    label: "Rune Raider",
    gradient: "from-yellow-600 via-lime-700 to-blue-800",
  },
  {
    id: "gaming-18-3",
    label: "Rift Raider",
    gradient: "from-fuchsia-600 via-violet-700 to-sky-800",
  },
  {
    id: "gaming-19-3",
    label: "Nebula Raider",
    gradient: "from-violet-600 via-amber-700 to-orange-800",
  },
  {
    id: "gaming-0-4",
    label: "Cyberpunk Legend",
    gradient: "from-fuchsia-700 via-blue-400 to-cyan-500",
  },
  {
    id: "gaming-1-4",
    label: "Dragon Legend",
    gradient: "from-red-700 via-slate-400 to-amber-500",
  },
  {
    id: "gaming-2-4",
    label: "Frostbite Legend",
    gradient: "from-sky-700 via-orange-400 to-indigo-500",
  },
  {
    id: "gaming-3-4",
    label: "Venom Legend",
    gradient: "from-lime-700 via-purple-400 to-emerald-500",
  },
  {
    id: "gaming-4-4",
    label: "Voidwalker Legend",
    gradient: "from-violet-700 via-rose-400 to-slate-500",
  },
  {
    id: "gaming-5-4",
    label: "Starforge Legend",
    gradient: "from-amber-700 via-cyan-400 to-violet-500",
  },
  {
    id: "gaming-6-4",
    label: "Sakura Legend",
    gradient: "from-pink-700 via-zinc-400 to-rose-500",
  },
  {
    id: "gaming-7-4",
    label: "Abyss Legend",
    gradient: "from-blue-700 via-teal-400 to-teal-500",
  },
  {
    id: "gaming-8-4",
    label: "Phantom Legend",
    gradient: "from-slate-700 via-indigo-400 to-purple-500",
  },
  {
    id: "gaming-9-4",
    label: "Plasma Legend",
    gradient: "from-orange-700 via-green-400 to-fuchsia-500",
  },
  {
    id: "gaming-10-4",
    label: "Arcane Legend",
    gradient: "from-purple-700 via-yellow-400 to-emerald-500",
  },
  {
    id: "gaming-11-4",
    label: "Inferno Legend",
    gradient: "from-rose-700 via-fuchsia-400 to-orange-500",
  },
  {
    id: "gaming-12-4",
    label: "Pixel Legend",
    gradient: "from-cyan-700 via-violet-400 to-lime-500",
  },
  {
    id: "gaming-13-4",
    label: "Knight Legend",
    gradient: "from-zinc-700 via-fuchsia-400 to-amber-500",
  },
  {
    id: "gaming-14-4",
    label: "Mecha Legend",
    gradient: "from-teal-700 via-red-400 to-red-500",
  },
  {
    id: "gaming-15-4",
    label: "Lunar Legend",
    gradient: "from-indigo-700 via-sky-400 to-pink-500",
  },
  {
    id: "gaming-16-4",
    label: "Glitch Legend",
    gradient: "from-green-700 via-lime-400 to-purple-500",
  },
  {
    id: "gaming-17-4",
    label: "Rune Legend",
    gradient: "from-yellow-700 via-violet-400 to-blue-500",
  },
  {
    id: "gaming-18-4",
    label: "Rift Legend",
    gradient: "from-fuchsia-700 via-amber-400 to-sky-500",
  },
  {
    id: "gaming-19-4",
    label: "Nebula Legend",
    gradient: "from-violet-700 via-pink-400 to-orange-500",
  },
  {
    id: "gaming-0-5",
    label: "Cyberpunk Ranger",
    gradient: "from-fuchsia-300 via-slate-500 to-cyan-600",
  },
  {
    id: "gaming-1-5",
    label: "Dragon Ranger",
    gradient: "from-red-300 via-orange-500 to-amber-600",
  },
  {
    id: "gaming-2-5",
    label: "Frostbite Ranger",
    gradient: "from-sky-300 via-purple-500 to-indigo-600",
  },
  {
    id: "gaming-3-5",
    label: "Venom Ranger",
    gradient: "from-lime-300 via-rose-500 to-emerald-600",
  },
  {
    id: "gaming-4-5",
    label: "Voidwalker Ranger",
    gradient: "from-violet-300 via-cyan-500 to-slate-600",
  },
  {
    id: "gaming-5-5",
    label: "Starforge Ranger",
    gradient: "from-amber-300 via-zinc-500 to-violet-600",
  },
  {
    id: "gaming-6-5",
    label: "Sakura Ranger",
    gradient: "from-pink-300 via-teal-500 to-rose-600",
  },
  {
    id: "gaming-7-5",
    label: "Abyss Ranger",
    gradient: "from-blue-300 via-indigo-500 to-teal-600",
  },
  {
    id: "gaming-8-5",
    label: "Phantom Ranger",
    gradient: "from-slate-300 via-green-500 to-purple-600",
  },
  {
    id: "gaming-9-5",
    label: "Plasma Ranger",
    gradient: "from-orange-300 via-yellow-500 to-fuchsia-600",
  },
  {
    id: "gaming-10-5",
    label: "Arcane Ranger",
    gradient: "from-purple-300 via-fuchsia-500 to-emerald-600",
  },
  {
    id: "gaming-11-5",
    label: "Inferno Ranger",
    gradient: "from-rose-300 via-violet-500 to-orange-600",
  },
  {
    id: "gaming-12-5",
    label: "Pixel Ranger",
    gradient: "from-cyan-300 via-fuchsia-500 to-lime-600",
  },
  {
    id: "gaming-13-5",
    label: "Knight Ranger",
    gradient: "from-zinc-300 via-red-500 to-amber-600",
  },
  {
    id: "gaming-14-5",
    label: "Mecha Ranger",
    gradient: "from-teal-300 via-sky-500 to-red-600",
  },
  {
    id: "gaming-15-5",
    label: "Lunar Ranger",
    gradient: "from-indigo-300 via-lime-500 to-pink-600",
  },
  {
    id: "gaming-16-5",
    label: "Glitch Ranger",
    gradient: "from-green-300 via-violet-500 to-purple-600",
  },
  {
    id: "gaming-17-5",
    label: "Rune Ranger",
    gradient: "from-yellow-300 via-amber-500 to-blue-600",
  },
  {
    id: "gaming-18-5",
    label: "Rift Ranger",
    gradient: "from-fuchsia-300 via-pink-500 to-sky-600",
  },
  {
    id: "gaming-19-5",
    label: "Nebula Ranger",
    gradient: "from-violet-300 via-blue-500 to-orange-600",
  },
  {
    id: "gaming-0-6",
    label: "Cyberpunk Oracle",
    gradient: "from-fuchsia-400 via-orange-600 to-cyan-700",
  },
  {
    id: "gaming-1-6",
    label: "Dragon Oracle",
    gradient: "from-red-400 via-purple-600 to-amber-700",
  },
  {
    id: "gaming-2-6",
    label: "Frostbite Oracle",
    gradient: "from-sky-400 via-rose-600 to-indigo-700",
  },
  {
    id: "gaming-3-6",
    label: "Venom Oracle",
    gradient: "from-lime-400 via-cyan-600 to-emerald-700",
  },
  {
    id: "gaming-4-6",
    label: "Voidwalker Oracle",
    gradient: "from-violet-400 via-zinc-600 to-slate-700",
  },
  {
    id: "gaming-5-6",
    label: "Starforge Oracle",
    gradient: "from-amber-400 via-teal-600 to-violet-700",
  },
  {
    id: "gaming-6-6",
    label: "Sakura Oracle",
    gradient: "from-pink-400 via-indigo-600 to-rose-700",
  },
  {
    id: "gaming-7-6",
    label: "Abyss Oracle",
    gradient: "from-blue-400 via-green-600 to-teal-700",
  },
  {
    id: "gaming-8-6",
    label: "Phantom Oracle",
    gradient: "from-slate-400 via-yellow-600 to-purple-700",
  },
  {
    id: "gaming-9-6",
    label: "Plasma Oracle",
    gradient: "from-orange-400 via-fuchsia-600 to-fuchsia-700",
  },
  {
    id: "gaming-10-6",
    label: "Arcane Oracle",
    gradient: "from-purple-400 via-violet-600 to-emerald-700",
  },
  {
    id: "gaming-11-6",
    label: "Inferno Oracle",
    gradient: "from-rose-400 via-fuchsia-600 to-orange-700",
  },
  {
    id: "gaming-12-6",
    label: "Pixel Oracle",
    gradient: "from-cyan-400 via-red-600 to-lime-700",
  },
  {
    id: "gaming-13-6",
    label: "Knight Oracle",
    gradient: "from-zinc-400 via-sky-600 to-amber-700",
  },
  {
    id: "gaming-14-6",
    label: "Mecha Oracle",
    gradient: "from-teal-400 via-lime-600 to-red-700",
  },
  {
    id: "gaming-15-6",
    label: "Lunar Oracle",
    gradient: "from-indigo-400 via-violet-600 to-pink-700",
  },
  {
    id: "gaming-16-6",
    label: "Glitch Oracle",
    gradient: "from-green-400 via-amber-600 to-purple-700",
  },
  {
    id: "gaming-17-6",
    label: "Rune Oracle",
    gradient: "from-yellow-400 via-pink-600 to-blue-700",
  },
  {
    id: "gaming-18-6",
    label: "Rift Oracle",
    gradient: "from-fuchsia-400 via-blue-600 to-sky-700",
  },
  {
    id: "gaming-19-6",
    label: "Nebula Oracle",
    gradient: "from-violet-400 via-slate-600 to-orange-700",
  },
  {
    id: "gaming-0-7",
    label: "Cyberpunk Warden",
    gradient: "from-fuchsia-500 via-purple-700 to-cyan-800",
  },
  {
    id: "gaming-1-7",
    label: "Dragon Warden",
    gradient: "from-red-500 via-rose-700 to-amber-800",
  },
  {
    id: "gaming-2-7",
    label: "Frostbite Warden",
    gradient: "from-sky-500 via-cyan-700 to-indigo-800",
  },
  {
    id: "gaming-3-7",
    label: "Venom Warden",
    gradient: "from-lime-500 via-zinc-700 to-emerald-800",
  },
  {
    id: "gaming-4-7",
    label: "Voidwalker Warden",
    gradient: "from-violet-500 via-teal-700 to-slate-800",
  },
  {
    id: "gaming-5-7",
    label: "Starforge Warden",
    gradient: "from-amber-500 via-indigo-700 to-violet-800",
  },
  {
    id: "gaming-6-7",
    label: "Sakura Warden",
    gradient: "from-pink-500 via-green-700 to-rose-800",
  },
  {
    id: "gaming-7-7",
    label: "Abyss Warden",
    gradient: "from-blue-500 via-yellow-700 to-teal-800",
  },
  {
    id: "gaming-8-7",
    label: "Phantom Warden",
    gradient: "from-slate-500 via-fuchsia-700 to-purple-800",
  },
  {
    id: "gaming-9-7",
    label: "Plasma Warden",
    gradient: "from-orange-500 via-violet-700 to-fuchsia-800",
  },
  {
    id: "gaming-10-7",
    label: "Arcane Warden",
    gradient: "from-purple-500 via-fuchsia-700 to-emerald-800",
  },
  {
    id: "gaming-11-7",
    label: "Inferno Warden",
    gradient: "from-rose-500 via-red-700 to-orange-800",
  },
  {
    id: "gaming-12-7",
    label: "Pixel Warden",
    gradient: "from-cyan-500 via-sky-700 to-lime-800",
  },
  {
    id: "gaming-13-7",
    label: "Knight Warden",
    gradient: "from-zinc-500 via-lime-700 to-amber-800",
  },
  {
    id: "gaming-14-7",
    label: "Mecha Warden",
    gradient: "from-teal-500 via-violet-700 to-red-800",
  },
  {
    id: "gaming-15-7",
    label: "Lunar Warden",
    gradient: "from-indigo-500 via-amber-700 to-pink-800",
  },
  {
    id: "gaming-16-7",
    label: "Glitch Warden",
    gradient: "from-green-500 via-pink-700 to-purple-800",
  },
  {
    id: "gaming-17-7",
    label: "Rune Warden",
    gradient: "from-yellow-500 via-blue-700 to-blue-800",
  },
  {
    id: "gaming-18-7",
    label: "Rift Warden",
    gradient: "from-fuchsia-500 via-slate-700 to-sky-800",
  },
  {
    id: "gaming-19-7",
    label: "Nebula Warden",
    gradient: "from-violet-500 via-orange-700 to-orange-800",
  },
  {
    id: "gaming-0-8",
    label: "Cyberpunk Vanguard",
    gradient: "from-fuchsia-600 via-rose-400 to-cyan-500",
  },
  {
    id: "gaming-1-8",
    label: "Dragon Vanguard",
    gradient: "from-red-600 via-cyan-400 to-amber-500",
  },
  {
    id: "gaming-2-8",
    label: "Frostbite Vanguard",
    gradient: "from-sky-600 via-zinc-400 to-indigo-500",
  },
  {
    id: "gaming-3-8",
    label: "Venom Vanguard",
    gradient: "from-lime-600 via-teal-400 to-emerald-500",
  },
  {
    id: "gaming-4-8",
    label: "Voidwalker Vanguard",
    gradient: "from-violet-600 via-indigo-400 to-slate-500",
  },
  {
    id: "gaming-5-8",
    label: "Starforge Vanguard",
    gradient: "from-amber-600 via-green-400 to-violet-500",
  },
  {
    id: "gaming-6-8",
    label: "Sakura Vanguard",
    gradient: "from-pink-600 via-yellow-400 to-rose-500",
  },
  {
    id: "gaming-7-8",
    label: "Abyss Vanguard",
    gradient: "from-blue-600 via-fuchsia-400 to-teal-500",
  },
  {
    id: "gaming-8-8",
    label: "Phantom Vanguard",
    gradient: "from-slate-600 via-violet-400 to-purple-500",
  },
  {
    id: "gaming-9-8",
    label: "Plasma Vanguard",
    gradient: "from-orange-600 via-fuchsia-400 to-fuchsia-500",
  },
  {
    id: "gaming-10-8",
    label: "Arcane Vanguard",
    gradient: "from-purple-600 via-red-400 to-emerald-500",
  },
  {
    id: "gaming-11-8",
    label: "Inferno Vanguard",
    gradient: "from-rose-600 via-sky-400 to-orange-500",
  },
  {
    id: "gaming-12-8",
    label: "Pixel Vanguard",
    gradient: "from-cyan-600 via-lime-400 to-lime-500",
  },
  {
    id: "gaming-13-8",
    label: "Knight Vanguard",
    gradient: "from-zinc-600 via-violet-400 to-amber-500",
  },
  {
    id: "gaming-14-8",
    label: "Mecha Vanguard",
    gradient: "from-teal-600 via-amber-400 to-red-500",
  },
  {
    id: "gaming-15-8",
    label: "Lunar Vanguard",
    gradient: "from-indigo-600 via-pink-400 to-pink-500",
  },
  {
    id: "gaming-16-8",
    label: "Glitch Vanguard",
    gradient: "from-green-600 via-blue-400 to-purple-500",
  },
  {
    id: "gaming-17-8",
    label: "Rune Vanguard",
    gradient: "from-yellow-600 via-slate-400 to-blue-500",
  },
  {
    id: "gaming-18-8",
    label: "Rift Vanguard",
    gradient: "from-fuchsia-600 via-orange-400 to-sky-500",
  },
  {
    id: "gaming-19-8",
    label: "Nebula Vanguard",
    gradient: "from-violet-600 via-purple-400 to-orange-500",
  },
  {
    id: "gaming-0-9",
    label: "Cyberpunk Monarch",
    gradient: "from-fuchsia-700 via-cyan-500 to-cyan-600",
  },
  {
    id: "gaming-1-9",
    label: "Dragon Monarch",
    gradient: "from-red-700 via-zinc-500 to-amber-600",
  },
  {
    id: "gaming-2-9",
    label: "Frostbite Monarch",
    gradient: "from-sky-700 via-teal-500 to-indigo-600",
  },
  {
    id: "gaming-3-9",
    label: "Venom Monarch",
    gradient: "from-lime-700 via-indigo-500 to-emerald-600",
  },
  {
    id: "gaming-4-9",
    label: "Voidwalker Monarch",
    gradient: "from-violet-700 via-green-500 to-slate-600",
  },
  {
    id: "gaming-5-9",
    label: "Starforge Monarch",
    gradient: "from-amber-700 via-yellow-500 to-violet-600",
  },
  {
    id: "gaming-6-9",
    label: "Sakura Monarch",
    gradient: "from-pink-700 via-fuchsia-500 to-rose-600",
  },
  {
    id: "gaming-7-9",
    label: "Abyss Monarch",
    gradient: "from-blue-700 via-violet-500 to-teal-600",
  },
  {
    id: "gaming-8-9",
    label: "Phantom Monarch",
    gradient: "from-slate-700 via-fuchsia-500 to-purple-600",
  },
  {
    id: "gaming-9-9",
    label: "Plasma Monarch",
    gradient: "from-orange-700 via-red-500 to-fuchsia-600",
  },
  {
    id: "gaming-10-9",
    label: "Arcane Monarch",
    gradient: "from-purple-700 via-sky-500 to-emerald-600",
  },
  {
    id: "gaming-11-9",
    label: "Inferno Monarch",
    gradient: "from-rose-700 via-lime-500 to-orange-600",
  },
  {
    id: "gaming-12-9",
    label: "Pixel Monarch",
    gradient: "from-cyan-700 via-violet-500 to-lime-600",
  },
  {
    id: "gaming-13-9",
    label: "Knight Monarch",
    gradient: "from-zinc-700 via-amber-500 to-amber-600",
  },
];

/** Looks up a frame by id; unknown ids fall back to a plain avatar. */
export function findFrame(id: string | null | undefined): AvatarFrame | null {
  if (!id) return null;
  return AVATAR_FRAMES.find((frame) => frame.id === id) ?? null;
}

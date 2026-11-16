export type LobbySection = {
  id: string;
  type: string;
  title: string;
  text?: string;
};
export type LobbyConfig = {
  enabled: boolean;
  title: string;
  intro: string;
  layout: string;
  background: string;
  panel: string;
  accent: string;
  sections: LobbySection[];
  buttons: { id: string; label: string; url: string }[];
};
export const LOBBY_SECTION_TYPES = [
  "welcome",
  "rules",
  "buttons",
  "levels",
  "messages",
  "invites",
  "feed",
] as const;
export const LOBBY_THEMES = [
  {
    name: "Nebula",
    background: "#11121c",
    panel: "#1a1c2b",
    accent: "#b9a4ff",
  },
  {
    name: "Arcade",
    background: "#140e24",
    panel: "#251735",
    accent: "#ffb0e6",
  },
  {
    name: "Aurora",
    background: "#081b1b",
    panel: "#122b2a",
    accent: "#75efcf",
  },
  { name: "Ember", background: "#211311", panel: "#35221d", accent: "#ffc18a" },
  { name: "Ocean", background: "#091a2c", panel: "#152b42", accent: "#87d8ff" },
  {
    name: "Monochrome",
    background: "#121212",
    panel: "#242424",
    accent: "#dedede",
  },
] as const;
export const LOBBY_DEFAULTS: LobbyConfig = {
  enabled: false,
  title: "Welcome to your lobby",
  intro: "Your community starts here.",
  layout: "columns",
  background: "#11121c",
  panel: "#1a1c2b",
  accent: "#9580ff",
  sections: [
    {
      id: "welcome",
      type: "welcome",
      title: "Make yourself at home",
      text: "Say hello, find your people, and start a conversation.",
    },
    { id: "rules", type: "rules", title: "Community rules" },
    { id: "buttons", type: "buttons", title: "Jump right in" },
    { id: "levels", type: "levels", title: "Top levels" },
    { id: "messages", type: "messages", title: "Messages this week" },
    { id: "invites", type: "invites", title: "Community builders" },
    { id: "feed", type: "feed", title: "What's new" },
  ],
  buttons: [],
};

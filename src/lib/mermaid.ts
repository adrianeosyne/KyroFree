export const MERMAID_MAX_SOURCE = 12_000;
export const MERMAID_TEMPLATES = {
  "Basic flowchart":
    "flowchart TD\n    A[Start] --> B{Ready?}\n    B -->|Yes| C[Continue]\n    B -->|No| A",
  "Login flow":
    "flowchart TD\n    A[Open Kyro] --> B[Sign in]\n    B --> C{Valid credentials?}\n    C -->|Yes| D[Dashboard]\n    C -->|No| B",
  "Server architecture":
    "flowchart LR\n    Browser --> API[Convex API]\n    Bot --> API\n    API --> Database[(Database)]\n    Browser --> Storage[Object storage]\n    API --> Events[Durable events]",
  "Database relationships":
    "erDiagram\n    USER ||--o{ MESSAGE : sends\n    SERVER ||--o{ CHANNEL : contains\n    CHANNEL ||--o{ MESSAGE : contains",
  "Sequence diagram":
    "sequenceDiagram\n    participant User\n    participant Kyro\n    participant Bot\n    User->>Kyro: Send message\n    Kyro->>Bot: message.created\n    Bot->>Kyro: Reply\n    Kyro->>User: Show reply",
  "Project workflow":
    "stateDiagram-v2\n    [*] --> Planned\n    Planned --> Building\n    Building --> Testing\n    Testing --> Building: Fix\n    Testing --> Shipped\n    Shipped --> [*]",
};

export function validateMermaidSource(source: string) {
  if (!source.trim()) throw new Error("Write a diagram to preview it.");
  if (source.length > MERMAID_MAX_SOURCE || source.split("\n").length > 200)
    throw new Error("Diagrams are limited to 12,000 characters and 200 lines.");
  // User configuration could weaken the renderer's strict security settings.
  if (
    /%%\s*\{|^\s*---|\b(?:click|href)\s|javascript\s*:|<\s*(?:script|iframe|object|foreignObject)\b/im.test(
      source,
    )
  )
    throw new Error(
      "Diagram configuration, links and active HTML are disabled.",
    );
  if ((source.match(/-->|---|==>|-.->|->>|\|\|--|\}\|--/g) ?? []).length > 200)
    throw new Error(
      "This diagram has too many connections. Split it into smaller diagrams.",
    );
}

export function mermaidFence(source: string) {
  validateMermaidSource(source);
  if (source.includes("```"))
    throw new Error("Diagram source cannot contain a code fence.");
  return "```mermaid\n" + source.trim() + "\n```";
}

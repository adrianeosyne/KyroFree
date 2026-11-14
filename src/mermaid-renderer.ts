import mermaid from "mermaid";
import DOMPurify from "dompurify";
import { validateMermaidSource } from "./lib/mermaid";

// Runs in an opaque-origin sandbox. No network access or parent DOM access.
let rendering = false;
window.addEventListener("message", async (event: MessageEvent) => {
  if (
    event.source !== parent ||
    rendering ||
    event.data?.kind !== "kyro.diagram.render"
  )
    return;
  const { source, theme, nonce } = event.data as {
    source: string;
    theme: string;
    nonce: string;
  };
  if (typeof source !== "string" || typeof nonce !== "string") return;
  rendering = true;
  try {
    validateMermaidSource(source);
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: theme === "light" ? "default" : "dark",
      maxTextSize: 12_000,
      maxEdges: 200,
      suppressErrorRendering: true,
      htmlLabels: false,
      flowchart: { htmlLabels: false },
      sequence: { useMaxWidth: true },
    });
    const result = await mermaid.render("kyro-diagram", source);
    const clean = DOMPurify.sanitize(result.svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: [
        "script",
        "foreignObject",
        "iframe",
        "object",
        "embed",
        "a",
        "image",
        "use",
        "animate",
        "set",
      ],
      FORBID_ATTR: ["href", "xlink:href", "src", "tabindex"],
    });
    const doc = new DOMParser().parseFromString(clean, "image/svg+xml");
    for (const node of doc.querySelectorAll("*")) {
      for (const attr of Array.from(node.attributes)) {
        if (/^on/i.test(attr.name) || /url\s*\(\s*['"]?(?!#)/i.test(attr.value))
          node.removeAttribute(attr.name);
      }
    }
    for (const style of doc.querySelectorAll("style")) {
      if (/@import|url\s*\(\s*['"]?(?!#)/i.test(style.textContent ?? ""))
        style.remove();
    }
    parent.postMessage(
      {
        kind: "kyro.diagram.result",
        nonce,
        svg: new XMLSerializer().serializeToString(doc.documentElement),
      },
      "*",
    );
  } catch {
    // Parser errors can include source/HTML; expose only a safe plain-text hint.
    parent.postMessage(
      {
        kind: "kyro.diagram.result",
        nonce,
        error:
          "Unable to render this diagram. Check the syntax and diagram type, or simplify the source.",
      },
      "*",
    );
  }
});
parent.postMessage({ kind: "kyro.diagram.ready" }, "*");

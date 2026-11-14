import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { renderMessage } from "@/lib/markdown";
import { useUiStore } from "@/lib/store";
import DeveloperDocs from "@/pages/DeveloperDocs";
import { MermaidComposer } from "@/components/app/MermaidComposer";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/index.css";
function Diagrams() {
  const [source, setSource] = useState("flowchart TD\nA[Start] --> B[Finish]"),
    [language, setLanguage] = useState("mermaid"),
    [composer, setComposer] = useState(false);
  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl">Kyro diagram verification</h1>
      <textarea
        aria-label="Test source"
        className="w-full border p-2"
        value={source}
        onChange={(e) => setSource(e.target.value)}
      />
      <select
        aria-label="Code language"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
      >
        <option>mermaid</option>
        <option>javascript</option>
      </select>
      <button
        onClick={() => useUiStore.getState().setPreference("theme", "light")}
      >
        Light theme
      </button>
      <button
        onClick={() => useUiStore.getState().setPreference("theme", "dark")}
      >
        Dark theme
      </button>
      <button onClick={() => setComposer(true)}>Composer</button>
      <div data-testid="message">
        {renderMessage("```" + language + "\n" + source + "\n```")}
      </div>
      <MermaidComposer
        open={composer}
        onOpenChange={setComposer}
        onInsert={(text) => setSource(text.slice(11, -4))}
      />
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <TooltipProvider>
      <Routes>
        <Route path="/docs/:slug?" element={<DeveloperDocs />} />
        <Route path="*" element={<Diagrams />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>,
);

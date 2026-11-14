import { lazy, Suspense, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MERMAID_TEMPLATES, mermaidFence } from "@/lib/mermaid";
const MermaidDiagram = lazy(() => import("./MermaidDiagram"));
export function MermaidComposer({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: string) => void;
}) {
  const [source, setSource] = useState(MERMAID_TEMPLATES["Basic flowchart"]);
  const [preview, setPreview] = useState(source);
  const [error, setError] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a Mermaid diagram</DialogTitle>
          <DialogDescription>
            Choose a template, edit its source, and preview before adding it to
            your message.
          </DialogDescription>
        </DialogHeader>
        <label className="text-sm">
          Template
          <select
            aria-label="Diagram template"
            className="ml-3 rounded border border-border bg-background p-2"
            onChange={(e) => {
              const next =
                MERMAID_TEMPLATES[
                  e.target.value as keyof typeof MERMAID_TEMPLATES
                ];
              setSource(next);
              setPreview(next);
            }}
          >
            {Object.keys(MERMAID_TEMPLATES).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <Textarea
          aria-label="Mermaid source"
          className="min-h-40 font-mono text-xs"
          value={source}
          maxLength={1900}
          onChange={(e) => setSource(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Suspense fallback={<p>Loading preview…</p>}>
          <MermaidDiagram source={preview} />
        </Suspense>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              try {
                mermaidFence(source);
                setError("");
                setPreview(source);
              } catch (cause) {
                setError(String((cause as Error).message));
              }
            }}
          >
            Preview diagram
          </Button>
          <Button
            onClick={() => {
              try {
                onInsert(mermaidFence(source));
                onOpenChange(false);
              } catch (cause) {
                setError(String((cause as Error).message));
              }
            }}
          >
            Add to message
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

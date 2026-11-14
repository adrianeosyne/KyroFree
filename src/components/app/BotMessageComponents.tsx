import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { componentSchema } from "@/lib/botContract";
import { Button } from "@/components/ui/button";
import { useBotTask } from "./BotPlatformShared";
export function BotMessageComponents({
  components,
  channelId,
  messageId,
}: {
  components: unknown[];
  channelId: string;
  messageId: string;
}) {
  const click = useMutation(api.botInteractions.click),
    task = useBotTask();
  const parsed = componentSchema.array().max(5).safeParse(components);
  if (!parsed.success) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {parsed.data.map((c) =>
        c.type === "button" ? (
          <Button
            key={c.customId}
            size="sm"
            variant={
              c.style === "danger"
                ? "destructive"
                : c.style === "primary"
                  ? "default"
                  : "outline"
            }
            disabled={c.disabled || task.busy}
            onClick={() =>
              void task.run(() =>
                click({
                  channelId: channelId as Id<"channels">,
                  messageId: messageId as Id<"messages">,
                  customId: c.customId,
                }),
              )
            }
          >
            {c.label}
          </Button>
        ) : (
          <select
            key={c.customId}
            aria-label={c.placeholder ?? "Bot select menu"}
            className="max-w-full rounded border border-border bg-background p-2 text-sm"
            disabled={c.disabled || task.busy}
            value=""
            onChange={(e) =>
              void task.run(() =>
                click({
                  channelId: channelId as Id<"channels">,
                  messageId: messageId as Id<"messages">,
                  customId: c.customId,
                  value: e.target.value,
                }),
              )
            }
          >
            <option value="">{c.placeholder ?? "Choose an option"}</option>
            {c.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ),
      )}
    </div>
  );
}

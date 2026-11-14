import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBotTask } from "./BotPlatformShared";
import { BotModal } from "./BotModal";
type Command = FunctionReturnType<typeof api.botCommands.forChannel>[number];
export function BotContextCommands({
  channelId,
  messageId,
  authorId,
  members,
  onClose,
}: {
  channelId: Id<"channels">;
  messageId: string;
  authorId: string;
  members: { id: string; name: string }[];
  onClose: () => void;
}) {
  const commands = useQuery(api.botCommands.forChannel, { channelId });
  const [selected, setSelected] = useState<Command | null>(null);
  if (selected)
    return (
      <BotCommandDialog
        command={selected}
        channelId={channelId}
        targetId={selected.type === "user" ? authorId : messageId}
        members={members}
        onClose={onClose}
        onSent={() => undefined}
      />
    );
  const available = commands?.filter(
    (c) => c.type === "message" || c.type === "user",
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Application actions</DialogTitle>
          <DialogDescription>
            Run a registered command on this message or its author.
          </DialogDescription>
        </DialogHeader>
        {!commands ? (
          <p>Loading commands…</p>
        ) : !available?.length ? (
          <p className="text-sm text-muted-foreground">
            No application actions are installed in this channel.
          </p>
        ) : (
          available.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              className="justify-start"
              onClick={() => setSelected(c)}
            >
              {c.applicationName} · {c.name} (
              {c.type === "user" ? "author" : "message"})
            </Button>
          ))
        )}
      </DialogContent>
    </Dialog>
  );
}
function AutocompleteArgument({
  channelId,
  command,
  option,
  subcommand,
  value,
  onChange,
}: {
  channelId: Id<"channels">;
  command: Command;
  option: Command["options"][number];
  subcommand: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const request = useMutation(api.botInteractions.autocomplete);
  const [resultId, setResultId] = useState<Id<"botInteractions"> | null>(null);
  const result = useQuery(
    api.botInteractions.autocompleteResult,
    resultId ? { interactionId: resultId } : "skip",
  );
  const version = useRef(0);
  useEffect(() => {
    const current = ++version.current;
    let cancelled = false;
    if (!value.trim()) return;
    const timer = setTimeout(() => {
      void request({
        channelId,
        commandId: command.id,
        option: option.name,
        value: value.slice(0, 100),
        ...(subcommand ? { subcommand } : {}),
      }).then(
        (id) => {
          if (!cancelled && current === version.current) setResultId(id);
        },
        () => undefined,
      );
    }, 600);
    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [value, channelId, command.id, option.name, subcommand, request]);
  const listId = `choices-${command.id}-${option.name}`;
  return (
    <>
      <Input
        required={option.required}
        maxLength={1000}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {result?.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </datalist>
    </>
  );
}
export function BotCommandDialog({
  command,
  channelId,
  members,
  onClose,
  onSent,
  targetId,
}: {
  command: Command;
  channelId: Id<"channels">;
  members: { id: string; name: string }[];
  onClose: () => void;
  onSent: () => void;
  targetId?: string;
}) {
  const execute = useMutation(api.botCommands.execute);
  const [values, setValues] = useState<Record<string, string>>({});
  const [subcommand, setSubcommand] = useState("");
  const definition =
    command.subcommands.find(
      (s) => `${s.group ? s.group + " " : ""}${s.name}` === subcommand,
    )?.options ?? command.options;
  const task = useBotTask();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>/{command.name}</DialogTitle>
          <DialogDescription>
            {command.description} · {command.applicationName}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void task.run(async () => {
              const options: Record<string, string | number | boolean> = {};
              for (const option of definition) {
                const value = values[option.name];
                if (value === undefined || value === "") continue;
                options[option.name] =
                  option.type === "integer" || option.type === "number"
                    ? Number(value)
                    : option.type === "boolean"
                      ? value === "true"
                      : value;
              }
              await execute({
                channelId,
                commandId: command.id,
                options,
                ...(subcommand ? { subcommand } : {}),
                ...(targetId ? { targetId } : {}),
              });
              onSent();
              onClose();
            }, "Command sent to the bot");
          }}
        >
          {command.subcommands.length > 0 && (
            <label className="block text-sm">
              Subcommand
              <select
                required
                aria-label="Subcommand"
                className="mt-2 w-full rounded border border-border bg-background p-2"
                value={subcommand}
                onChange={(e) => {
                  setSubcommand(e.target.value);
                  setValues({});
                }}
              >
                <option value="">Select a subcommand</option>
                {command.subcommands.map((s) => (
                  <option
                    key={`${s.group}:${s.name}`}
                    value={`${s.group ? s.group + " " : ""}${s.name}`}
                  >
                    {s.group ? s.group + " " : ""}
                    {s.name} — {s.description}
                  </option>
                ))}
              </select>
            </label>
          )}
          {definition.map((option) => (
            <label key={option.name} className="block space-y-2 text-sm">
              <span className="font-medium">
                {option.name}
                {option.required ? " *" : ""}
              </span>
              <span className="block text-xs text-muted-foreground">
                {option.description}
              </span>
              {option.autocomplete ? (
                <AutocompleteArgument
                  channelId={channelId}
                  command={command}
                  option={option}
                  subcommand={subcommand}
                  value={values[option.name] ?? ""}
                  onChange={(value) =>
                    setValues({ ...values, [option.name]: value })
                  }
                />
              ) : option.type === "boolean" ||
                option.type === "user" ||
                option.choices?.length ? (
                <select
                  className="w-full rounded-md border border-border bg-background p-2"
                  required={option.required}
                  value={values[option.name] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [option.name]: e.target.value })
                  }
                >
                  <option value="">Select a value</option>
                  {option.type === "boolean"
                    ? ["true", "false"].map((v) => <option key={v}>{v}</option>)
                    : option.type === "user"
                      ? members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))
                      : option.choices!.map((choice) => (
                          <option key={choice}>{choice}</option>
                        ))}
                </select>
              ) : (
                <Input
                  required={option.required}
                  type={
                    option.type === "integer" || option.type === "number"
                      ? "number"
                      : "text"
                  }
                  step={
                    option.type === "integer"
                      ? 1
                      : option.type === "number"
                        ? "any"
                        : undefined
                  }
                  maxLength={1000}
                  value={values[option.name] ?? ""}
                  onChange={(e) =>
                    setValues({ ...values, [option.name]: e.target.value })
                  }
                />
              )}
            </label>
          ))}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={task.busy}>
              Run command
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function BotInteractionResponses({
  channelId,
}: {
  channelId: Id<"channels">;
}) {
  const responses = useQuery(api.botCommands.responses, { channelId });
  const [dismissed, setDismissed] = useState<string[]>([]);
  return (
    <div
      className="max-h-[30vh] overflow-y-auto"
      aria-label="Private bot responses"
    >
      {responses
        ?.filter((r) => r.modal)
        .map((r) => (
          <BotModal key={r.id} id={r.id} definition={r.modal} />
        ))}
      {responses
        ?.filter((r) => r.ephemeral && r.response && !dismissed.includes(r.id))
        .map((response) => (
          <div
            key={response.id}
            className="mx-3 my-2 flex items-start justify-between gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm"
            role="status"
          >
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-primary">
                Only visible to you
              </p>
              <p className="whitespace-pre-wrap break-words">
                {response.response}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed([...dismissed, response.id])}
            >
              Dismiss
            </Button>
          </div>
        ))}
    </div>
  );
}

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { modalSchema } from "@/lib/botContract";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useBotTask } from "./BotPlatformShared";
export function BotModal({
  id,
  definition,
}: {
  id: string;
  definition: unknown;
}) {
  const [open, setOpen] = useState(true),
    [values, setValues] = useState<Record<string, string>>({});
  const submit = useMutation(api.botInteractions.submitModal),
    task = useBotTask(),
    modal = modalSchema.safeParse(definition);
  if (!modal.success) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Open {modal.data.title}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modal.data.title}</DialogTitle>
            <DialogDescription>
              Submit this form to the bot. Only your account can use this modal.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await submit({
                  interactionId: id as Id<"botInteractions">,
                  values,
                });
                setOpen(false);
              });
            }}
          >
            {modal.data.fields.map((field) => (
              <label key={field.customId} className="block space-y-1 text-sm">
                <span>{field.label}</span>
                {field.multiline ? (
                  <Textarea
                    required={field.required}
                    maxLength={field.maxLength}
                    value={values[field.customId] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.customId]: e.target.value })
                    }
                  />
                ) : (
                  <Input
                    required={field.required}
                    maxLength={field.maxLength}
                    value={values[field.customId] ?? ""}
                    onChange={(e) =>
                      setValues({ ...values, [field.customId]: e.target.value })
                    }
                  />
                )}
              </label>
            ))}
            <Button type="submit" disabled={task.busy}>
              Submit
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

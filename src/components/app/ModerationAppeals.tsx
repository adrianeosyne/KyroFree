import { useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState, LoadingRows } from "./AdvancedShared";
import { useBotTask } from "./BotPlatformShared";

export function ModerationAppeals() {
  const cases = usePaginatedQuery(
    api.moderationAppeals.cases,
    {},
    { initialNumItems: 20 },
  );
  const [selected, setSelected] = useState<Id<"moderationCases"> | null>(null);
  return (
    <main className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <h1 className="text-2xl font-bold">Your moderation appeals</h1>
        <p className="text-sm text-muted-foreground">
          Ask community moderators to review a warning, timeout, kick or ban.
          You can submit an appeal after leaving or being removed from a
          community.
        </p>
        {cases.status === "LoadingFirstPage" ? (
          <LoadingRows />
        ) : !cases.results.length ? (
          <EmptyState>No moderation cases on this page.</EmptyState>
        ) : (
          cases.results.map((row) => (
            <article key={row._id} className="space-y-3 rounded-xl border p-4">
              <h2 className="font-semibold">
                {row.communityName} · {row.action}
              </h2>
              <p className="text-xs text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">
                {row.reason}
              </p>
              {row.appeal ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-semibold">
                    Appeal {row.appeal.status}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {row.appeal.statement}
                  </p>
                  {row.appeal.response && (
                    <p className="whitespace-pre-wrap break-words text-sm">
                      Moderator response: {row.appeal.response}
                    </p>
                  )}
                </div>
              ) : row.canAppeal ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(row._id)}
                >
                  Submit appeal
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Case resolved</p>
              )}
            </article>
          ))
        )}
        {cases.status === "CanLoadMore" && (
          <Button variant="outline" onClick={() => cases.loadMore(20)}>
            More cases
          </Button>
        )}
        {selected && (
          <SubmitAppeal caseId={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </main>
  );
}
function SubmitAppeal({
  caseId,
  onClose,
}: {
  caseId: Id<"moderationCases">;
  onClose: () => void;
}) {
  const submit = useMutation(api.moderationAppeals.submit),
    task = useBotTask();
  const [statement, setStatement] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && !task.busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit moderation appeal</DialogTitle>
          <DialogDescription>
            Explain what happened and why the action should be reviewed. Each
            case allows one appeal.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await submit({ caseId, statement });
              onClose();
            }, "Appeal submitted");
          }}
        >
          <Label className="block space-y-2">
            Appeal statement
            <Textarea
              aria-label="Appeal statement"
              required
              minLength={20}
              maxLength={4000}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
            />
          </Label>
          <Button
            type="submit"
            disabled={task.busy || statement.trim().length < 20}
          >
            Send appeal
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
type Review = FunctionReturnType<
  typeof api.moderationAppeals.queue
>["page"][number];
export function AppealReviewQueue({ serverId }: { serverId: Id<"servers"> }) {
  const queue = usePaginatedQuery(
    api.moderationAppeals.queue,
    { serverId },
    { initialNumItems: 20 },
  );
  const [selected, setSelected] = useState<Review | null>(null);
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Moderation appeal review</h2>
      <p className="text-sm text-muted-foreground">
        Accepted appeals resolve the original case and lift its current ban or
        timeout when permitted. Newer moderation actions remain in place.
        Accepted kicks allow the member to request access again.
      </p>
      {queue.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !queue.results.length ? (
        <EmptyState>No appeals on this page.</EmptyState>
      ) : (
        queue.results.map((row) => (
          <article key={row._id} className="space-y-3 rounded-xl border p-4">
            <h3 className="font-semibold">
              {row.memberName} · {row.action} · {row.status}
            </h3>
            <p className="whitespace-pre-wrap break-words text-sm">
              Original reason: {row.reason}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {row.statement}
            </p>
            {row.response && (
              <p className="whitespace-pre-wrap break-words text-sm">
                Response: {row.response}
              </p>
            )}
            {row.status === "pending" && (
              <Button size="sm" onClick={() => setSelected(row)}>
                Review appeal
              </Button>
            )}
          </article>
        ))
      )}
      {queue.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => queue.loadMore(20)}>
          More appeals
        </Button>
      )}
      {selected && (
        <DecideAppeal review={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
function DecideAppeal({
  review,
  onClose,
}: {
  review: Review;
  onClose: () => void;
}) {
  const decide = useMutation(api.moderationAppeals.decide),
    task = useBotTask();
  const [response, setResponse] = useState(""),
    [accepted, setAccepted] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && !task.busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review appeal from {review.memberName}</DialogTitle>
          <DialogDescription>
            Explain your decision. Acceptance is checked against your current
            permissions and moderation hierarchy.
          </DialogDescription>
        </DialogHeader>
        <p className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">
          {review.statement}
        </p>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await decide({
                appealId: review._id,
                accepted,
                response,
                expectedRevision: review.revision,
              });
              onClose();
            }, "Appeal reviewed");
          }}
        >
          <Label className="block space-y-2">
            Decision
            <select
              aria-label="Appeal decision"
              className="h-10 w-full rounded-md border bg-background px-3"
              value={accepted ? "accept" : "decline"}
              onChange={(e) => setAccepted(e.target.value === "accept")}
            >
              <option value="decline">Decline appeal</option>
              <option value="accept">Accept appeal</option>
            </select>
          </Label>
          <Label className="block space-y-2">
            Review response
            <Textarea
              aria-label="Review response"
              required
              minLength={10}
              maxLength={4000}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
          </Label>
          <Button
            type="submit"
            disabled={task.busy || response.trim().length < 10}
          >
            Save appeal decision
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

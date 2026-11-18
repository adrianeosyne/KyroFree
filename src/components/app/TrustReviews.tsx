import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function CreatorVerification() {
  const data = useQuery(api.trustReviews.mine);
  const submit = useMutation(api.trustReviews.requestCreator);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = data?.requests.some(
    (r) => r.kind === "creator" && r.status === "pending",
  );
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-panel p-5">
      <h3 className="font-semibold">Creator verification</h3>
      <p className="text-sm text-muted-foreground">
        Show your original creations and public proof that the work belongs to
        you. Staff check ownership, authentic identity and community conduct.
        Premium requests appear first; everyone meets the same criteria.
      </p>
      {data === undefined ? (
        <p role="status">Loading requests…</p>
      ) : data.verified ? (
        <p className="text-sm text-primary">
          Your creator profile is verified.
        </p>
      ) : (
        <>
          <Textarea
            aria-label="Creator ownership evidence"
            placeholder="Describe your work and link to a public creator page proving ownership"
            maxLength={1000}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={pending || busy}
          />
          <Button
            disabled={pending || busy || evidence.trim().length < 20}
            onClick={async () => {
              setBusy(true);
              try {
                await submit({ evidence });
                setEvidence("");
                toast.success("Creator request submitted.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Request failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {pending
              ? "Awaiting staff review"
              : busy
                ? "Submitting…"
                : "Request verification"}
          </Button>
        </>
      )}
      {data?.requests
        .filter((r) => r.kind === "creator")
        .slice(0, 5)
        .map((r) => (
          <div key={r._id} className="rounded-xl bg-surface p-3 text-xs">
            <p className="capitalize">
              {r.status}
              {r.priority ? " · Premium priority" : ""}
            </p>
            {r.note && <p className="mt-1 text-muted-foreground">{r.note}</p>}
          </div>
        ))}
    </section>
  );
}

export function TrustReviewQueue() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.trustReviews.queue,
    {},
    { initialNumItems: 20 },
  );
  const review = useMutation(api.trustReviews.review);
  const me = useQuery(api.users.me);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const perform = async (
    requestId: (typeof results)[number]["_id"],
    approve: boolean,
  ) => {
    setBusy(true);
    try {
      await review({ requestId, approve, note: notes[requestId] ?? "" });
      toast.success("Review saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Creator & bot reviews</h2>
      <p className="text-sm text-muted-foreground">
        Premium submissions appear first. Confirm original ownership, authentic
        identity and community conduct for creators. Check the bot description,
        permissions and behavior before directory publication. Admin approval is
        required, and another admin must review your own work.
      </p>
      {status === "LoadingFirstPage" && <p role="status">Loading reviews…</p>}
      {status !== "LoadingFirstPage" && !results.length && (
        <p className="text-sm text-muted-foreground">No pending requests.</p>
      )}
      {results.map((r) => (
        <section
          key={r._id}
          className="space-y-3 rounded-2xl border border-border bg-surface p-5"
        >
          <p className="font-semibold">
            {r.name} · @{r.username}{" "}
            <span className="text-xs text-fuchsia-300">
              {r.priority ? "Premium priority" : "Standard queue"}
            </span>
          </p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {r.kind === "bot"
              ? "Bot directory listing"
              : "Creator verification"}
          </p>
          {r.bot && (
            <div className="rounded-xl bg-panel p-3 text-sm">
              <p className="font-semibold">
                {r.bot.name} · {r.bot.category}
              </p>
              <p>{r.bot.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Permissions: {r.bot.permissions.join(", ") || "None"}
              </p>
            </div>
          )}
          <p className="whitespace-pre-wrap break-words text-sm">
            {r.evidence}
          </p>
          {me?.isPlatformAdmin && (
            <>
              <Textarea
                aria-label={`Review feedback for ${r.name}`}
                value={notes[r._id] ?? ""}
                onChange={(e) =>
                  setNotes((n) => ({ ...n, [r._id]: e.target.value }))
                }
                maxLength={500}
                placeholder="Describe checks performed or changes needed (10+ characters)"
              />
              <div className="flex gap-2">
                <Button
                  disabled={
                    busy ||
                    (notes[r._id]?.trim().length ?? 0) < 10 ||
                    me.id === r.userId
                  }
                  onClick={() => void perform(r._id, true)}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    (notes[r._id]?.trim().length ?? 0) < 10 ||
                    me.id === r.userId
                  }
                  onClick={() => void perform(r._id, false)}
                >
                  Reject with feedback
                </Button>
              </div>
            </>
          )}
        </section>
      ))}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(20)}>
          Load more reviews
        </Button>
      )}
      {status === "LoadingMore" && <p role="status">Loading more…</p>}
    </div>
  );
}

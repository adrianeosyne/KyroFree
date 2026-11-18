import { useMutation, usePaginatedQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUploadFile } from "@/lib/upload";
import { toast } from "sonner";

export function DecorationStudio() {
  const {
    results: mine,
    status: mineStatus,
    loadMore: loadMine,
  } = usePaginatedQuery(
    api.communityDecorations.mine,
    {},
    { initialNumItems: 20 },
  );
  const submit = useMutation(api.communityDecorations.submit);
  const withdraw = useMutation(api.communityDecorations.withdraw);
  const upload = useUploadFile({ requireRegistration: true });
  const [asset, setAsset] = useState<{ file: File; url: string } | null>(null);
  const file = asset?.file ?? null;
  const preview = asset?.url ?? null;
  const setFile = (next: File | null) =>
    setAsset(next ? { file: next, url: URL.createObjectURL(next) } : null);
  const [kind, setKind] = useState<"avatar" | "profile">("avatar");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [original, setOriginal] = useState(false);
  const [animated, setAnimated] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-panel to-cyan/10 p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          Community workshop
        </p>
        <h2 className="mt-2 text-2xl font-bold">
          Put your art in the spotlight.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Create original avatar overlays and profile decorations. Approved work
          joins the community collection for everyone to wear.
        </p>
      </section>
      <section className="grid gap-5 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-3">
          <label className="block text-sm">
            Decoration type
            <select
              aria-label="Decoration type"
              value={kind}
              onChange={(e) => setKind(e.target.value as "avatar" | "profile")}
              className="mt-1 w-full rounded-lg border border-input bg-background p-2"
            >
              <option value="avatar">Avatar decoration</option>
              <option value="profile">Profile decoration</option>
            </select>
          </label>
          <Input
            aria-label="Decoration name"
            placeholder="Give your creation a name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            aria-label="Decoration description"
            placeholder="Describe the artwork"
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="block text-sm">
            Artwork file
            <input
              className="mt-2 block w-full text-xs"
              type="file"
              accept="image/png,image/webp,image/gif,image/avif"
              disabled={busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setOriginal(false);
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            PNG, WebP, GIF or AVIF · transparent artwork works best · 2 MB free
            / 5 MB Premium
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={animated}
              onChange={(e) => setAnimated(e.target.checked)}
            />
            This artwork is animated
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={original}
              onChange={(e) => setOriginal(e.target.checked)}
            />
            I created this artwork and own the rights to share it.
          </label>
          <Button
            disabled={busy || !file || !original || name.trim().length < 3}
            onClick={async () => {
              if (!file) return;
              setBusy(true);
              try {
                const asset = await upload(file);
                await submit({
                  storageId: asset.storageId,
                  kind,
                  name,
                  description,
                  animated,
                  originalWork: original,
                });
                setFile(null);
                setName("");
                toast.success("Submitted for staff review.");
              } catch (e) {
                toast.error(
                  e instanceof Error ? e.message : "Submission failed.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
        <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-panel p-3">
          <p className="mb-3 text-xs text-muted-foreground">
            Preview before submitting
          </p>
          {preview ? (
            <img
              src={preview}
              alt="Your decoration preview"
              className="max-h-60 w-full object-contain"
            />
          ) : (
            <p className="text-xs text-muted-foreground">Choose your artwork</p>
          )}
        </div>
      </section>
      <h3 className="font-semibold">Your submissions</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {mine?.map((item) => (
          <section
            key={item._id}
            className="rounded-xl border border-border bg-panel p-4"
          >
            {item.url && (
              <img
                src={item.url}
                alt={item.name}
                loading="lazy"
                className="mb-3 h-24 w-full object-contain"
              />
            )}
            <p className="font-semibold">{item.name}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {item.kind} · {item.status}
            </p>
            {item.note && <p className="my-2 text-xs">Staff: {item.note}</p>}
            {item.status !== "withdrawn" && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await withdraw({ id: item._id });
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "Could not withdraw.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Withdraw
              </Button>
            )}
          </section>
        ))}
      </div>
      {(mineStatus === "CanLoadMore" || mineStatus === "LoadingMore") && (
        <Button
          variant="outline"
          disabled={mineStatus === "LoadingMore"}
          onClick={() => loadMine(20)}
        >
          Load more of your submissions
        </Button>
      )}
      {mine?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Your submitted artwork and review status will appear here.
        </p>
      )}
    </div>
  );
}
export function DecorationReview() {
  const review = useMutation(api.communityDecorations.review);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "withdrawn" | "all"
  >("pending");
  const {
    results: items,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.communityDecorations.queue,
    { status: filter === "all" ? undefined : filter },
    { initialNumItems: 30 },
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <div className="space-y-4">
      <h2 className="font-semibold">Community decoration review</h2>
      <p className="text-xs text-muted-foreground">
        Verify originality and suitability before publishing. Staff cannot
        review their own submissions.
      </p>
      <select
        aria-label="Submission status filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value as typeof filter)}
        className="rounded-lg border border-border bg-panel p-2"
      >
        {["pending", "approved", "rejected", "withdrawn", "all"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <div className="grid gap-4 sm:grid-cols-2">
        {items
          ?.filter((x) => filter === "all" || x.status === filter)
          .map((item) => (
            <section
              key={item._id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              {item.url && (
                <img
                  src={item.url}
                  alt={item.name}
                  loading="lazy"
                  className="h-36 w-full rounded-lg bg-panel object-contain"
                />
              )}
              <h3 className="mt-3 font-semibold">{item.name}</h3>
              <p className="text-xs text-muted-foreground">
                By {item.creator} · {item.kind} ·{" "}
                {item.animated ? "Animated" : "Static"} · {item.status}
              </p>
              <p className="my-2 text-sm">{item.description}</p>
              <Input
                aria-label={`Review note for ${item.name}`}
                placeholder="Feedback to creator"
                maxLength={300}
                value={notes[item._id] ?? item.note ?? ""}
                onChange={(e) =>
                  setNotes({ ...notes, [item._id]: e.target.value })
                }
              />
              {item.status !== "withdrawn" && (
                <div className="mt-3 flex gap-2">
                  {[true, false].map((approve) => (
                    <Button
                      key={String(approve)}
                      variant={approve ? "default" : "outline"}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await review({
                            id: item._id,
                            approve,
                            note: notes[item._id],
                          });
                          toast.success(
                            approve
                              ? "Published to community collection."
                              : "Decoration rejected.",
                          );
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Review failed.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {approve ? "Approve & publish" : "Reject / unpublish"}
                    </Button>
                  ))}
                </div>
              )}
            </section>
          ))}
      </div>
      {status === "LoadingFirstPage" && (
        <p role="status">Loading submissions…</p>
      )}
      {(status === "CanLoadMore" || status === "LoadingMore") && (
        <Button
          disabled={status === "LoadingMore"}
          variant="outline"
          onClick={() => loadMore(30)}
        >
          {status === "LoadingMore" ? "Loading…" : "Load more submissions"}
        </Button>
      )}
    </div>
  );
}

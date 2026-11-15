import { CreatorVerification } from "./TrustReviews";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPremium } from "@/lib/entitlements";
import { toast } from "sonner";

const perks = [
  [
    "Kyro HQ",
    "Premium lounge",
    "Get a pink Premium role and access to #premium-chat.",
  ],
  [
    "Across HQ",
    "Media sharing",
    "Share pictures and clips throughout HQ. Free members use #media.",
  ],
  [
    "Your voice",
    "HQ polls",
    "Create polls in HQ without creator verification.",
  ],
  [
    "Priority queue",
    "Creator verification",
    "Your original work is reviewed first, with the same ownership checks.",
  ],
  [
    "10 bot applications",
    "More room to build",
    "Create up to ten bot identities. Your directory submissions receive priority staff review.",
  ],
  [
    "One community",
    "Supercharge",
    "Give one community 200 emoji slots, 50 MB member uploads and 128 kbps voice audio while your Premium is active.",
  ],
  [
    "1440p · 60 fps",
    "Screen sharing",
    "Share gameplay and creative work in greater detail.",
  ],
  [
    "200 MB",
    "Larger uploads",
    "Send clips, artwork and files without splitting them up.",
  ],
  [
    "Your whole Kyro",
    "Studio customization",
    "Personalize colors, static or animated backgrounds, 15 font themes, 10 new gaming cursors and your own cursor artwork, panels and layout.",
  ],
  [
    "Premium",
    "Profile badge",
    "A luminous badge on your profile. Hide or restore it any time.",
  ],
  [
    "4,000 characters",
    "Longer messages",
    "Write and edit messages up to 4,000 characters.",
  ],
  [
    "5 MB",
    "Decoration uploads",
    "Submit more detailed original static or animated artwork.",
  ],
];
export function PremiumSettings() {
  const data = useQuery(api.premium.status);
  const visibility = useMutation(api.premium.badgeVisibility);
  const lounge = useMutation(api.premium.enterLounge);
  const navigate = useNavigate();
  const request = useMutation(api.premium.request);
  const [reference, setReference] = useState("");
  const [recipient, setRecipient] = useState("");
  const [gift, setGift] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return <p role="status">Loading Premium…</p>;
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-fuchsia-400/25 bg-gradient-to-br from-violet-600/25 via-panel to-cyan-500/15 p-7">
        <p className="text-xs font-bold uppercase tracking-[.25em] text-fuchsia-300">
          Kyro Premium
        </p>
        <h2 className="mt-3 text-3xl font-black">
          Play. Create. Make it yours.
        </h2>
        <p className="mt-3 text-muted-foreground">
          Everything you love about Kyro, with more room to express yourself.
        </p>
        <p className="mt-5 text-3xl font-bold">
          $1.99{" "}
          <span className="text-sm font-normal text-muted-foreground">
            per month
          </span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Manual payment · founder approval · no automatic billing
        </p>
        {hasPremium(data) && (
          <p className="mt-4 rounded-xl bg-fuchsia-500/15 p-3 text-sm text-fuchsia-200">
            Premium active through{" "}
            {new Date(data.premiumUntil!).toLocaleDateString()}
          </p>
        )}
      </div>
      {hasPremium(data) && (
        <section className="space-y-3 rounded-2xl border border-fuchsia-400/25 bg-panel p-5">
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={!data.hidePremiumBadge}
              disabled={busy}
              onChange={async (e) => {
                setBusy(true);
                try {
                  await visibility({ hidden: !e.target.checked });
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Could not update badge.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />{" "}
            Show Premium badge on my profile
          </label>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const target = await lounge({});
                navigate(
                  `/dashboard/s/${target.serverId}/c/${target.channelId}`,
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Lounge unavailable.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Enter the Premium lounge
          </Button>
        </section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {perks.map(([value, title, description]) => (
          <div
            key={title}
            className="rounded-2xl border border-border/70 bg-surface p-5"
          >
            <p className="text-lg font-bold text-primary">{value}</p>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border/70">
        <table className="w-full text-left text-sm">
          <caption className="p-4 text-left font-semibold">
            Choose your experience
          </caption>
          <thead className="bg-surface">
            <tr>
              {["Feature", "Free", "Premium"].map((x) => (
                <th key={x} className="p-3">
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Screen share", "720p / 30 fps", "1440p / 60 fps"],
              ["Upload size", "10 MB", "200 MB"],
              ["Message length", "2,000", "4,000"],
              ["Decoration file", "2 MB", "5 MB"],
              ["Full workspace studio", "—", "Included"],
              ["Community artwork", "Included", "Included"],
              ["Bot applications", "2", "10"],
              [
                "Server supercharge",
                "—",
                "One community: 200 emojis, 50 MB, 128 kbps",
              ],
              ["Premium badge", "—", "Show or hide any time"],
              ["HQ lounge", "—", "Pink role + #premium-chat"],
              ["Media in HQ", "#media", "Across HQ"],
              ["Polls in HQ", "Verified creators", "Included"],
              ["Creator & bot review", "Standard queue", "Priority queue"],
            ].map((row) => (
              <tr key={row[0]} className="border-t border-border/60">
                {row.map((x) => (
                  <td key={x} className="p-3">
                    {x}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="space-y-3 rounded-2xl border border-border bg-panel p-5">
        <h3 className="font-semibold">Activate or gift a month</h3>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {data.instructions}
        </p>
        <p className="text-xs text-muted-foreground">
          After paying $1.99, send the transaction reference. Only adrianeosyne
          can verify payment and activate one month. Renewals extend your active
          time by 30 days.
        </p>
        <Input
          aria-label="Payment reference"
          placeholder="Transaction or payment reference"
          maxLength={300}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={gift}
            onChange={(e) => {
              setGift(e.target.checked);
              setRecipient("");
            }}
          />
          Gift a month to another member
        </label>
        {gift && (
          <PremiumMemberPicker label="Gift recipient" onSelect={setRecipient} />
        )}
        <Button
          disabled={busy || reference.trim().length < 4 || (gift && !recipient)}
          onClick={async () => {
            setBusy(true);
            try {
              await request({
                reference,
                recipientId:
                  gift && recipient.trim()
                    ? (recipient.trim() as Id<"users">)
                    : undefined,
              });
              setReference("");
              toast.success("Payment request sent to the founder.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Request failed.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Submitting…" : "Request founder approval"}
        </Button>
      </section>
      <CreatorVerification />
      {data.requests.length > 0 && (
        <section>
          <h3 className="mb-3 font-semibold">Your requests</h3>
          {data.requests.map((r) => (
            <div
              key={r._id}
              className="mb-2 rounded-xl border border-border p-3 text-sm"
            >
              <p className="capitalize">
                {r.status} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
              {r.note && (
                <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export function PremiumAdmin() {
  const queue = useQuery(api.premium.queue);
  const review = useMutation(api.premium.review);
  const grant = useMutation(api.premium.grant);
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      toast.success("Premium updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Founder Premium controls</h2>
        <p className="my-2 text-xs text-muted-foreground">
          Confirm manual payment before granting. Each approval adds 30 days.
        </p>
        <PremiumMemberPicker label="Premium recipient" onSelect={setUserId} />
        <div className="mt-3 flex gap-2">
          <Button
            disabled={busy || !userId}
            onClick={() =>
              void perform(() =>
                grant({ userId: userId.trim() as Id<"users"> }),
              )
            }
          >
            Grant a month
          </Button>
          <Button
            variant="outline"
            disabled={busy || !userId}
            onClick={() =>
              void perform(() =>
                grant({ userId: userId.trim() as Id<"users">, revoke: true }),
              )
            }
          >
            Revoke Premium
          </Button>
        </div>
      </section>
      {queue === undefined ? (
        <p role="status">Loading requests…</p>
      ) : queue.length === 0 ? (
        <p>No pending payment requests.</p>
      ) : (
        queue.map((r) => (
          <section
            key={r._id}
            className="rounded-xl border border-border bg-surface p-4"
          >
            <p className="font-semibold">
              {r.requester} → {r.recipient}
            </p>
            <p className="my-2 break-all text-sm text-muted-foreground">
              Reference: {r.reference}
            </p>
            <div className="flex gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void perform(() =>
                    review({ requestId: r._id, approve: true }),
                  )
                }
              >
                Payment verified · approve
              </Button>
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  void perform(() =>
                    review({ requestId: r._id, approve: false }),
                  )
                }
              >
                Reject
              </Button>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function PremiumMemberPicker({
  label,
  onSelect,
}: {
  label: string;
  onSelect: (id: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState(false);
  const results = useQuery(
    api.users.searchUsers,
    term.trim().length >= 2 && !selected ? { term: term.trim() } : "skip",
  );
  return (
    <div>
      <Input
        aria-label={label}
        placeholder="Search a member's name or username"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setSelected(false);
          onSelect("");
        }}
      />
      {!selected && term.trim().length >= 2 && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border bg-surface">
          {results === undefined ? (
            <p role="status" className="p-3 text-xs">
              Searching members…
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">
              No members found.
            </p>
          ) : (
            results.slice(0, 8).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setTerm(`${user.name} (@${user.username ?? "member"})`);
                  setSelected(true);
                  onSelect(user.id);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-primary/10"
              >
                {user.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  @{user.username}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

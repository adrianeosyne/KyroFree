import {
  PREMIUM_TIERS,
  PREMIUM_DURATIONS,
  premiumTier,
  premiumDays,
  DAY_MS,
  MAX_PREMIUM_DAYS,
  validPremiumDuration,
  type PremiumHistory,
  type PremiumBadgeTier,
} from "@/lib/premiumProgress";
import { PremiumBadge, GifterBadge } from "./PremiumBadge";
import { CreatorVerification } from "./TrustReviews";
import { useNavigate } from "react-router";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { FunctionArgs } from "convex/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPremium } from "@/lib/entitlements";
import { toast } from "sonner";
import { useNow } from "@/hooks/use-now";
import { normalizePremiumCode, premiumDuration } from "@/lib/premiumGifts";

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
  const redeem = useMutation(api.premiumCodes.redeem);
  const shareGift = useMutation(api.premiumCodes.shareGift);
  const [code, setCode] = useState("");
  const [recipient, setRecipient] = useState("");
  const [gift, setGift] = useState(false);
  const [busy, setBusy] = useState(false);
  const [giftLink, setGiftLink] = useState<string | null>(null);
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
          Redeem a Premium code · no application · no automatic billing
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
      <section className="space-y-4 rounded-2xl border border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-500/10 to-panel p-5">
        <h3 className="text-lg font-semibold">Redeem Premium</h3>
        <p className="text-sm text-muted-foreground">
          Get a code from adrianeosyne after manual payment, or receive a gift
          link. Redeem it here for immediate access. Available for 1, 3 or 6
          months, or 1 year. Active time stacks with your current membership.
        </p>
        {data.instructions && (
          <p className="rounded-xl bg-surface p-3 text-sm text-muted-foreground">
            {data.instructions}
          </p>
        )}
        <Input
          aria-label="Premium redeem code"
          placeholder="KYRO-XXXX-XXXX-XXXX"
          value={code}
          maxLength={512}
          onChange={(e) => {
            setCode(e.target.value);
            setGiftLink(null);
          }}
          className="font-mono tracking-widest"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={gift}
            onChange={(e) => {
              setGift(e.target.checked);
              setRecipient("");
            }}
          />{" "}
          Gift this code to another member
        </label>
        {gift && (
          <PremiumMemberPicker label="Gift recipient" onSelect={setRecipient} />
        )}
        <Button
          disabled={busy || !normalizePremiumCode(code) || (gift && !recipient)}
          onClick={async () => {
            setBusy(true);
            try {
              const result = await redeem({
                code,
                recipientId: gift ? (recipient as Id<"users">) : undefined,
              });
              if (!result.ok) throw new Error(result.error);
              setCode("");
              setGiftLink(null);
              if (!gift && result.giftReceived) navigate("/dashboard");
              toast.success(
                gift
                  ? "Premium gifted! Your Gifter badge has been updated."
                  : "Premium activated!",
              );
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Could not redeem code.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Redeeming…" : gift ? "Redeem and gift" : "Redeem code"}
        </Button>
        <div className="space-y-3 border-t border-fuchsia-400/15 pt-4">
          <h4 className="font-semibold">Send Premium as a gift link</h4>
          <p className="text-sm text-muted-foreground">
            Enter an unused code above and create a link to share. The first
            person to claim receives it. Creating the link keeps the code
            unused, and your gift count increases when someone claims.
          </p>
          <Button
            variant="outline"
            disabled={busy || !normalizePremiumCode(code)}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await shareGift({ code });
                if (!result.ok) throw new Error(result.error);
                setGiftLink(result.link);
                toast.success(
                  `Gift link ready: ${premiumDuration(result.days)} of Premium.`,
                );
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not create a gift link.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Create gift link
          </Button>
          {giftLink && (
            <div className="space-y-2">
              <Input
                aria-label="Premium gift link"
                value={giftLink}
                readOnly
                onFocus={(event) => event.target.select()}
              />
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(giftLink);
                    toast.success("Gift link copied.");
                  } catch {
                    toast.error(
                      "Could not copy. Select the link and copy it manually.",
                    );
                  }
                }}
              >
                Copy gift link
              </Button>
            </div>
          )}
        </div>
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-panel p-5">
        <h3 className="text-xl font-bold">Your Premium badge levels up</h3>
        <p className="text-sm text-muted-foreground">
          Keep Premium active and your badge evolves with your days in a row.
          Prepaid time extends access; badge tiers reflect time already spent as
          a member. A lapse resets the streak and preserves your original
          Premium since date.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PREMIUM_TIERS.map((tier) => (
            <div
              key={tier.name}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <span
                className={`inline-flex rounded-md bg-gradient-to-br ${tier.colors} px-3 py-1 font-sans text-xs font-black text-slate-950`}
              >
                {tier.symbol} PREMIUM
              </span>
              <h4 className="mt-3 font-bold">{tier.name}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {tier.label} {tier.days > 0 ? "in a row" : ""}
              </p>
            </div>
          ))}
        </div>
        {hasPremium(data) && (
          <PremiumBadge user={{ ...data, badges: ["premium"] }} />
        )}
        <h3 className="pt-3 font-semibold">
          Give a month. Make someone's day.
        </h3>
        <p className="text-xs text-muted-foreground">
          Gifter after your first gift · Big Gifter at 10 · Super Gifter at 25 ·
          Legendary Gifter at 50. Only completed code gifts count.
        </p>
        <GifterBadge count={data.premiumGiftCount ?? 0} />
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
  const setBadgeTier = useMutation(api.premium.setBadgeTier);
  const updateSubscription = useMutation(api.premium.updateSubscription);
  const [grantDays, setGrantDays] = useState(30);
  const [userId, setUserId] = useState("");
  const [tier, setTier] = useState<PremiumBadgeTier | "automatic">("Premium");
  const member = useQuery(
    api.premium.memberStatus,
    userId ? { userId: userId as Id<"users"> } : "skip",
  );
  const [busy, setBusy] = useState(false);
  const perform = async (action: () => Promise<unknown>) => {
    if (busy) return;
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
      <PremiumCodeAdmin />
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Founder Premium controls</h2>
        <p className="my-2 text-xs text-muted-foreground">
          Grant or remove Premium for any member, including yourself. Assign any
          badge tier immediately, without waiting for a streak.
        </p>
        <PremiumMemberPicker
          label="Premium recipient"
          onSelect={setUserId}
          includeSelf
          disabled={busy}
        />
        {userId && (
          <p className="mt-3 text-sm" role="status">
            {member === undefined
              ? "Loading member's Premium…"
              : hasPremium(member)
                ? `Current badge tier: ${premiumTier(member).name}. Premium ends ${new Date(member.premiumUntil!).toLocaleDateString()}.`
                : "This member has no active Premium."}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <DurationInput
            label="Grant duration"
            days={grantDays}
            onChange={setGrantDays}
            disabled={busy}
          />
          <Button
            disabled={busy || !userId || !validPremiumDuration(grantDays)}
            onClick={() =>
              void perform(() =>
                grant({
                  userId: userId.trim() as Id<"users">,
                  ...(grantDays === 30 ? {} : { days: grantDays }),
                }),
              )
            }
          >
            {grantDays === 30 ? "Grant a month" : `Grant ${grantDays} days`}
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
            Remove Premium
          </Button>
        </div>
        {userId && member && (
          <PremiumSubscriptionEditor
            key={`${userId}:${member.premiumUntil}:${member.premiumSince}:${member.premiumStreakSince}`}
            userId={userId as Id<"users">}
            member={member}
            busy={busy}
            onSave={(args) => perform(() => updateSubscription(args))}
          />
        )}
        <div className="mt-5 border-t border-border pt-4">
          <label
            htmlFor="admin-premium-badge-tier"
            className="text-sm font-semibold"
          >
            Premium badge tier
          </label>
          <select
            id="admin-premium-badge-tier"
            value={tier}
            disabled={busy}
            onChange={(event) =>
              setTier(event.target.value as PremiumBadgeTier | "automatic")
            }
            className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {PREMIUM_TIERS.map((entry) => (
              <option key={entry.name} value={entry.name}>
                {entry.name}
              </option>
            ))}
            <option value="automatic">Automatic (based on streak)</option>
          </select>
          <p className="my-2 text-xs text-muted-foreground">
            Assigning a tier activates one month of Premium if the member has
            none. Active members keep their current expiry date. Removing
            Premium also clears the assigned tier.
          </p>
          <Button
            disabled={busy || !userId || member === undefined}
            onClick={() =>
              void perform(() =>
                setBadgeTier({
                  userId: userId as Id<"users">,
                  tier: tier === "automatic" ? null : tier,
                }),
              )
            }
          >
            {tier === "automatic"
              ? "Use automatic badge tier"
              : "Assign badge tier"}
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
                disabled={busy || !validPremiumDuration(grantDays)}
                onClick={() =>
                  void perform(() =>
                    review({
                      requestId: r._id,
                      approve: true,
                      days: grantDays,
                    }),
                  )
                }
              >
                Payment verified · approve {premiumDuration(grantDays)}
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

function DurationInput({
  label,
  days,
  onChange,
  disabled,
}: {
  label: string;
  days: number;
  onChange: (days: number) => void;
  disabled: boolean;
}) {
  const [custom, setCustom] = useState(
    !PREMIUM_DURATIONS.some((duration) => duration.days === days),
  );
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm">
        {label}
        <select
          aria-label={label}
          value={custom ? "custom" : days}
          disabled={disabled}
          onChange={(event) => {
            setCustom(event.target.value === "custom");
            if (event.target.value !== "custom")
              onChange(Number(event.target.value));
          }}
          className="mt-2 block w-full rounded-lg border border-input bg-background p-2"
        >
          {PREMIUM_DURATIONS.map((duration) => (
            <option key={duration.days} value={duration.days}>
              {duration.label} · {duration.days} days
            </option>
          ))}
          <option value="custom">Custom days</option>
        </select>
      </label>
      {custom && (
        <label className="block text-xs text-muted-foreground">
          Number of days
          <Input
            type="number"
            aria-label={`${label} in days`}
            value={days}
            min={1}
            max={MAX_PREMIUM_DAYS}
            step={1}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className="mt-1"
          />
        </label>
      )}
    </div>
  );
}

function localDateTime(timestamp: number) {
  const date = new Date(timestamp);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function PremiumSubscriptionEditor({
  userId,
  member,
  busy,
  onSave,
}: {
  userId: Id<"users">;
  member: PremiumHistory;
  busy: boolean;
  onSave: (
    args: FunctionArgs<typeof api.premium.updateSubscription>,
  ) => Promise<void>;
}) {
  const now = useNow(30_000);
  const [baseline] = useState(() => {
    const initialNow = Date.now();
    const active = hasPremium(member, initialNow);
    const initialStart = active
      ? (member.premiumStreakSince ?? initialNow)
      : initialNow;
    const totalDays = active
      ? (member.premiumUntil! - initialStart) / DAY_MS
      : 30;
    return {
      initialSince: localDateTime(member.premiumSince ?? initialNow),
      initialStreak: premiumDays(member, initialNow),
      initialDuration: Math.max(1, Math.ceil(totalDays)),
      initialStart,
      totalDays,
      until: active ? member.premiumUntil! : null,
    };
  });
  const {
    initialSince,
    initialStreak,
    initialDuration,
    initialStart,
    totalDays,
  } = baseline;
  const [since, setSince] = useState(initialSince);
  const [streakDays, setStreakDays] = useState(initialStreak);
  const [durationDays, setDurationDays] = useState(initialDuration);
  const sinceChanged = since !== initialSince;
  const streakChanged = streakDays !== initialStreak;
  const durationChanged = durationDays !== initialDuration;
  const timingChanged = streakChanged || durationChanged;
  const end = timingChanged
    ? (streakChanged ? now - streakDays * DAY_MS : initialStart) +
      (durationChanged ? durationDays : totalDays) * DAY_MS
    : baseline.until;
  const sinceTime = new Date(since).getTime();
  const valid =
    validPremiumDuration(durationDays) &&
    Number.isInteger(streakDays) &&
    streakDays >= 0 &&
    streakDays <= MAX_PREMIUM_DAYS &&
    Number.isFinite(sinceTime) &&
    sinceTime <= now;
  return (
    <section
      className="mt-5 space-y-3 border-t border-border pt-4"
      aria-label="Premium subscription dates"
    >
      <h3 className="text-sm font-semibold">
        Subscription dates and days in a row
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          Premium since
          <Input
            type="datetime-local"
            aria-label="Premium since"
            value={since}
            max={localDateTime(now)}
            disabled={busy}
            onChange={(event) => setSince(event.target.value)}
            className="mt-2 min-w-0"
          />
        </label>
        <DurationInput
          label="Subscription duration"
          days={durationDays}
          onChange={setDurationDays}
          disabled={busy}
        />
        <label className="block text-sm">
          Days in a row
          <Input
            type="number"
            aria-label="Premium days in a row"
            value={streakDays}
            min={0}
            max={MAX_PREMIUM_DAYS}
            step={1}
            disabled={busy}
            onChange={(event) => setStreakDays(Number(event.target.value))}
            className="mt-2"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        The duration is the total length of this uninterrupted subscription. A
        30-day plan with 29 days in a row has one day left. Changing only
        Premium since keeps the existing expiry date.
      </p>
      <p className="rounded-xl bg-primary/5 p-3 text-sm" role="status">
        {end === null
          ? "No active subscription. Set a duration or days in a row to start one."
          : end <= now
            ? "This plan has already ended. Saving removes Premium and its perks."
            : `Premium expires ${new Date(end).toLocaleString()} · ${Math.ceil((end - now) / DAY_MS)} ${Math.ceil((end - now) / DAY_MS) === 1 ? "day" : "days"} remaining.`}
      </p>
      {end !== null && end > now && end - now <= DAY_MS && (
        <p className="text-xs text-amber-500">
          One day or less remains. The renewal warning is sent immediately when
          this is saved.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Members receive a renewal warning 24 hours before expiry. Their Premium
        badge and perks end automatically if they do not renew.
      </p>
      <Button
        disabled={busy || !valid || (!sinceChanged && !timingChanged)}
        onClick={() =>
          void onSave({
            userId,
            ...(sinceChanged ? { premiumSince: sinceTime } : {}),
            ...(durationChanged ? { durationDays } : {}),
            ...(streakChanged ? { streakDays } : {}),
          })
        }
      >
        Save subscription
      </Button>
    </section>
  );
}

function PremiumMemberPicker({
  label,
  onSelect,
  includeSelf = false,
  disabled = false,
}: {
  label: string;
  onSelect: (id: string) => void;
  includeSelf?: boolean;
  disabled?: boolean;
}) {
  const me = useQuery(api.users.me);
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
        disabled={disabled}
        onChange={(e) => {
          setTerm(e.target.value);
          setSelected(false);
          onSelect("");
        }}
      />
      {includeSelf && me && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={disabled}
          onClick={() => {
            setTerm(`${me.name} (@${me.username ?? "member"})`);
            setSelected(true);
            onSelect(me.id);
          }}
        >
          Select my account
        </Button>
      )}
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
                disabled={disabled}
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

function PremiumCodeAdmin() {
  const now = useNow();
  const generate = useMutation(api.premiumCodes.generate),
    generateBatch = useMutation(api.premiumCodes.generateBatch),
    revoke = useMutation(api.premiumCodes.revoke);
  const [days, setDays] = useState(30),
    [count, setCount] = useState(1),
    [expiresInDays, setExpiresInDays] = useState(0),
    [senderMode, setSenderMode] = useState<"creator" | "member" | "none">(
      "creator",
    ),
    [senderId, setSenderId] = useState(""),
    [generated, setGenerated] = useState<string[]>([]),
    [generatedExpiry, setGeneratedExpiry] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState<
      "all" | "available" | "redeemed" | "revoked" | "expired"
    >("all"),
    [suffix, setSuffix] = useState("");
  const {
    results: list,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.premiumCodes.history,
    { status: filter, suffix },
    { initialNumItems: 25 },
  );
  return (
    <section className="space-y-4 rounded-2xl border border-fuchsia-400/25 bg-panel p-5">
      <h2 className="text-xl font-bold">Premium codes</h2>
      <p className="text-sm text-muted-foreground">
        Only adrianeosyne can create or revoke codes. Each code can be redeemed
        once. Copy codes now; full codes are shown only when generated.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <DurationInput
          label="Premium code duration"
          days={days}
          onChange={setDays}
          disabled={busy}
        />
        <label className="block text-sm">
          Number of codes
          <select
            aria-label="Number of Premium codes"
            value={count}
            disabled={busy}
            onChange={(e) => setCount(Number(e.target.value))}
            className="mt-2 block w-full rounded-lg border border-input bg-background p-2"
          >
            {[1, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "code" : "codes"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Redeem within
          <select
            aria-label="Premium code redemption window"
            value={expiresInDays}
            disabled={busy}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            className="mt-2 block w-full rounded-lg border border-input bg-background p-2"
          >
            <option value={0}>No expiry</option>
            {[7, 30, 90].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        The redemption window limits when a code can be used. Membership
        duration starts when it is redeemed.
      </p>
      <div className="space-y-3">
        <label className="block text-sm">
          Gift attribution
          <select
            aria-label="Premium code gift attribution"
            value={senderMode}
            disabled={busy}
            onChange={(e) => {
              setSenderMode(e.target.value as typeof senderMode);
              setSenderId("");
            }}
            className="mt-2 block w-full rounded-lg border border-input bg-background p-2"
          >
            <option value="creator">adrianeosyne (default)</option>
            <option value="member">Another member</option>
            <option value="none">No sender · no gift badge</option>
          </select>
        </label>
        {senderMode === "member" && (
          <PremiumMemberPicker
            label="Premium code gift sender"
            onSelect={setSenderId}
            disabled={busy}
          />
        )}
        <p className="text-xs text-muted-foreground">
          {senderMode === "none"
            ? "These codes show no sender and never count toward anyone's gift badge, even when shared."
            : senderMode === "member"
              ? "The selected member's name appears on the gift. Their gift badge advances when someone else redeems it."
              : "Gift links use adrianeosyne unless a member creates a gift link from the code in Premium settings."}
        </p>
      </div>
      <Button
        disabled={
          busy ||
          !validPremiumDuration(days) ||
          generated.length > 0 ||
          (senderMode === "member" && !senderId)
        }
        onClick={async () => {
          setBusy(true);
          try {
            const args = {
              days,
              ...(expiresInDays ? { expiresInDays } : {}),
              ...(senderMode === "none"
                ? { giftSenderId: null }
                : senderMode === "member"
                  ? { giftSenderId: senderId as Id<"users"> }
                  : {}),
            };
            if (count === 1) {
              const result = await generate(args);
              setGenerated([result.code]);
              setGeneratedExpiry(result.expiresAt);
            } else {
              const result = await generateBatch({ ...args, count });
              setGenerated(result.codes);
              setGeneratedExpiry(result.expiresAt);
            }
            toast.success(
              count === 1
                ? "Premium code created."
                : `${count} Premium codes created.`,
            );
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Could not generate codes.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Generating…"
          : count === 1
            ? "Generate Premium code"
            : `Generate ${count} Premium codes`}
      </Button>
      {generated.length > 0 && (
        <div className="space-y-3 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-4">
          {generatedExpiry && (
            <p className="text-xs">
              Redeem before {new Date(generatedExpiry).toLocaleString()}.
            </p>
          )}
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {generated.map((code) => (
              <output
                key={code}
                aria-label={
                  generated.length === 1
                    ? "Generated Premium code"
                    : "Generated Premium codes"
                }
                className="block break-all font-mono text-lg font-bold"
              >
                {code}
              </output>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(generated.join("\n"));
                  toast.success("Codes copied.");
                } catch {
                  toast.error("Select the codes and copy them manually.");
                }
              }}
            >
              {generated.length === 1 ? "Copy code" : "Copy all codes"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setGenerated([]);
                setGeneratedExpiry(null);
              }}
            >
              Clear displayed codes
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Copy your codes before clearing this display. They cannot be shown
            again.
          </p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Code status
          <select
            aria-label="Filter Premium code status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="mt-2 block w-full rounded-lg border border-input bg-background p-2"
          >
            {(
              ["all", "available", "redeemed", "revoked", "expired"] as const
            ).map((value) => (
              <option key={value} value={value}>
                {value[0].toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Search code ending
          <Input
            aria-label="Search Premium code ending"
            placeholder="ABCD"
            value={suffix}
            maxLength={4}
            onChange={(e) =>
              setSuffix(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))
            }
            className="mt-2 font-mono"
          />
        </label>
      </div>
      <div className="space-y-2">
        {list.map((row) => {
          const state =
            row.redeemedAt !== undefined
              ? "Redeemed"
              : row.revokedAt !== undefined
                ? "Revoked"
                : row.expiresAt !== undefined && row.expiresAt <= now
                  ? "Expired"
                  : "Available";
          return (
            <div
              key={row._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-xs"
            >
              <span className="font-mono">KYRO-••••-••••-{row.suffix}</span>
              <span>
                {row.days} days · {state}
              </span>
              <span>
                {row.giftSenderId === null
                  ? "No sender · no gift badge"
                  : `Gifted by ${row.giftSenderName ?? row.giftSenderUsername ?? "adrianeosyne"}${row.giftSenderUsername ? ` (@${row.giftSenderUsername})` : ""}`}
              </span>
              <span className="text-muted-foreground">
                Created {new Date(row.createdAt).toLocaleDateString()}
                {row.expiresAt !== undefined
                  ? ` · Redeem by ${new Date(row.expiresAt).toLocaleString()}`
                  : " · No code expiry"}
              </span>
              {state === "Available" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await revoke({ id: row._id });
                      toast.success("Code revoked.");
                    } catch (e) {
                      toast.error(
                        e instanceof Error
                          ? e.message
                          : "Could not revoke code.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revoke code
                </Button>
              )}
            </div>
          );
        })}
        {status === "LoadingFirstPage" ? (
          <p role="status" className="text-sm">
            Loading codes…
          </p>
        ) : (
          list.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No codes match these filters.
            </p>
          )
        )}
        {(status === "CanLoadMore" || status === "LoadingMore") && (
          <Button
            variant="outline"
            disabled={status === "LoadingMore"}
            onClick={() => loadMore(25)}
          >
            {status === "LoadingMore" ? "Loading…" : "Load more codes"}
          </Button>
        )}
      </div>
    </section>
  );
}

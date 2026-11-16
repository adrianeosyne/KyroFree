import { Link } from "react-router";
import { useNow } from "@/hooks/use-now";
import { DAY_MS } from "@/lib/premiumProgress";

export function PremiumExpiryBanner({
  premiumUntil,
}: {
  premiumUntil?: number | null;
}) {
  const now = useNow(60_000);
  if (!premiumUntil || premiumUntil <= now || premiumUntil - now > DAY_MS)
    return null;
  return (
    <aside
      aria-label="Premium renewal warning"
      className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs"
    >
      <p>
        Premium ends {new Date(premiumUntil).toLocaleString()}. Renew to keep
        your badge and perks.
      </p>
      <Link
        to="/dashboard?settings=premium"
        className="inline-flex min-h-8 items-center font-semibold text-primary underline underline-offset-4"
      >
        Renew Premium
      </Link>
    </aside>
  );
}

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  premiumTier,
  premiumDays,
  gifterTier,
  type PremiumHistory,
} from "@/lib/premiumProgress";
import { cn } from "@/lib/utils";
export function PremiumBadge({
  user,
  compact = false,
}: {
  user: PremiumHistory;
  compact?: boolean;
}) {
  if (!user.badges?.includes("premium")) return null;
  const tier = premiumTier(user),
    days = premiumDays(user);
  const since = user.premiumSince
    ? `Premium since ${new Date(user.premiumSince).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}`
    : "Premium member";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${tier.name} Premium: ${since}, ${days} days in a row`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border border-white/25 bg-gradient-to-br px-2 py-1 align-middle font-sans text-[10px] font-black leading-none tracking-wide text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary",
            tier.colors,
            compact && "ml-1.5 px-1.5 py-0.5 text-[9px]",
          )}
        >
          <span aria-hidden="true">{tier.symbol}</span> PREMIUM
        </span>
      </TooltipTrigger>
      <TooltipContent className="z-[100] max-w-72 border border-white/15 bg-[#161321] p-3 text-white">
        <strong className="block">
          {tier.name} · {tier.label}
        </strong>
        <span className="mt-1 block text-xs">{since}</span>
        <span className="mt-1 block text-xs text-fuchsia-200">
          {days} {days === 1 ? "day" : "days"} in a row
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
export function GifterBadge({ count }: { count: number }) {
  if (count < 1) return null;
  const label = gifterTier(count);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${label}: ${count} Premium gifts`}
          className="inline-flex items-center gap-1 rounded-md border border-amber-300/40 bg-gradient-to-br from-amber-500/25 to-pink-500/20 px-2 py-1 font-sans text-[10px] font-bold text-amber-200"
        >
          🎁 {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="z-[100]">
        {count} Premium {count === 1 ? "gift" : "gifts"} given
      </TooltipContent>
    </Tooltip>
  );
}

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  premiumTier,
  premiumDays,
  gifterBadgeTier,
  type PremiumHistory,
} from "@/lib/premiumProgress";
import { cn } from "@/lib/utils";
import { useId } from "react";
import { BadgeTip } from "./BadgeTip";
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
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${tier.name}: ${since}, ${days} days in a row`}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md border border-white/25 bg-gradient-to-br px-2 py-1 align-middle font-sans text-[10px] font-black leading-none tracking-wide text-slate-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary",
            tier.colors,
            compact && "ml-1.5 px-1.5 py-0.5 text-[9px]",
          )}
        >
          <span aria-hidden="true">{tier.symbol}</span>{" "}
          {tier.name.toUpperCase()}
        </span>
      </TooltipTrigger>
      <TooltipContent className="z-[100] max-w-72 border border-white/15 bg-[#161321] p-3 text-white">
        <strong className="block">{tier.name}</strong>
        <span className="mt-1 block text-xs">{since}</span>
        <span className="mt-1 block text-xs text-fuchsia-200">
          {days} {days === 1 ? "day" : "days"} in a row
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
export function GifterBadge({ count }: { count: number }) {
  const gradientId = `kyroGift${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (count < 1) return null;
  const tier = gifterBadgeTier(count);
  return (
    <BadgeTip
      label={tier.name}
      blurb={`${count} Premium ${count === 1 ? "gift" : "gifts"} given`}
      disableHoverableContent
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-indigo-300/10 focus-visible:ring-2 focus-visible:ring-primary">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          className={cn(
            "size-5",
            count >= 50 && "drop-shadow-[0_0_5px_rgba(251,191,36,0.65)]",
          )}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={tier.colors[0]} />
              <stop offset="100%" stopColor={tier.colors[1]} />
            </linearGradient>
          </defs>
          <rect
            x="4"
            y="11"
            width="16"
            height="10"
            rx="2"
            fill={`url(#${gradientId})`}
          />
          <rect
            x="2.5"
            y="7.5"
            width="19"
            height="5"
            rx="1.5"
            fill={`url(#${gradientId})`}
          />
          <path
            d="M12 7.5C9 7.5 5.5 6.8 5.5 4.6c0-2.8 5.5-1.5 6.5 2.9Zm0 0c3 0 6.5-.7 6.5-2.9 0-2.8-5.5-1.5-6.5 2.9Z"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M10.8 7.5h2.4V21h-2.4Z" fill="#fff5eb" />
          {count >= 25 && (
            <path
              d="m21 1 .8 2.2L24 4l-2.2.8L21 7l-.8-2.2L18 4l2.2-.8Z"
              fill={tier.colors[1]}
            />
          )}
        </svg>
      </span>
    </BadgeTip>
  );
}

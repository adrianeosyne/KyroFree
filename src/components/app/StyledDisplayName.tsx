import type { CSSProperties, ReactNode } from "react";
import {
  displayNameStyle,
  type DisplayNameStyledUser,
} from "@/lib/displayName";
import { cn } from "@/lib/utils";
import {
  getPrimaryGlobalBadge,
  InlineBadge,
  PremiumBadge,
} from "@/components/app/GlobalBadges";
import type { PremiumBadgeUser } from "@/lib/premium-badges";

export function StyledDisplayName({
  user,
  name,
  roleColor,
  className,
  style,
  children,
}: {
  user: DisplayNameStyledUser &
    PremiumBadgeUser & {
      botApplicationId?: string | null;
      primaryBadge?: string | null;
    };
  name?: string;
  roleColor?: string | null;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const badges = user.badges ?? [];
  const primary = getPrimaryGlobalBadge(badges, user.primaryBadge);
  const classes = className?.split(/\s+/) ?? [];
  const truncates = classes.includes("truncate");
  return (
    <span
      className={cn(
        "display-name min-w-0 max-w-full",
        classes.filter((value) => value !== "truncate").join(" "),
        truncates && "items-center align-middle",
        truncates && (classes.includes("block") ? "flex" : "inline-flex"),
      )}
    >
      {/* Gradient text fill belongs to the name, never its badge siblings. */}
      <span
        className={cn("min-w-0", truncates && "truncate")}
        style={{ ...displayNameStyle(user, roleColor), ...style }}
      >
        {children ?? name ?? user.name}
      </span>
      {primary && (
        <span
          className="ml-1.5 inline-flex shrink-0 align-middle"
          style={{ WebkitTextFillColor: "currentColor" }}
        >
          <InlineBadge
            badges={badges}
            primaryBadge={user.primaryBadge}
            user={user}
            size="size-3.5"
          />
        </span>
      )}
      {primary !== "premium" && badges.includes("premium") && (
        <span className="ml-1.5 inline-flex shrink-0 align-middle">
          <PremiumBadge user={user} compact />
        </span>
      )}
      {user.botApplicationId && (
        <span
          className="ml-1.5 shrink-0 rounded bg-primary/15 px-1 py-0.5 align-middle font-sans text-[9px] font-semibold text-primary"
          aria-label="Bot account"
        >
          BOT
        </span>
      )}
    </span>
  );
}

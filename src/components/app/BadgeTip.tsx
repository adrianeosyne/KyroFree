import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ReactNode } from "react";

/** Shared profile badge tooltip, including its portal and dark appearance. */
export function BadgeTip({
  label,
  blurb,
  children,
  disableHoverableContent = false,
}: {
  label: string;
  blurb?: string;
  children: ReactNode;
  disableHoverableContent?: boolean;
}) {
  return (
    <Tooltip disableHoverableContent={disableHoverableContent}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${label}${blurb ? `: ${blurb}` : ""}`}
          className="inline-flex shrink-0 items-center rounded-full align-middle outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[100] w-max max-w-60 rounded-lg border-0 bg-[#11182a] px-3.5 py-2 text-center text-indigo-50 shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-indigo-300/20 [&>svg]:hidden"
      >
        <span className="block text-sm font-bold">{label}</span>
        {blurb && (
          <span className="mt-0.5 block text-xs font-medium leading-snug text-indigo-100/70">
            {blurb}
          </span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

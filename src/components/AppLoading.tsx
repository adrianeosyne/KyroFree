import { cn } from "@/lib/utils";

export function AppLoading({
  fullScreen = true,
  label = "Getting your space ready",
  description = "Good conversations are just a moment away.",
}: {
  fullScreen?: boolean;
  label?: string;
  description?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "kyro-loading flex flex-col items-center justify-center overflow-hidden bg-background px-6 text-center",
        fullScreen ? "min-h-dvh" : "h-full min-h-64",
      )}
    >
      <div className="kyro-loading-halo" aria-hidden="true" />
      <div
        className={cn(
          "kyro-loading-content relative z-10 flex flex-col items-center",
          !fullScreen && "scale-90",
        )}
      >
        <div className="kyro-loading-mark" aria-hidden="true">
          <span className="kyro-loading-orbit" />
          <img src="/logo-192.png" alt="" width={64} height={64} />
        </div>
        <p className="mt-8 text-3xl font-bold tracking-tight">
          kyro<span className="text-primary">.</span>
        </p>
        <p className="mt-5 text-sm font-medium text-foreground">{label}</p>
        <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="kyro-loading-dots mt-6" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="mt-12 text-[9px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/60">
          Your people. Your place.
        </p>
      </div>
    </div>
  );
}

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { useUiStore } from "@/lib/store";

/** Keep the dashboard mounted across conversations; animate its content in AppShell. */
export function SiteMotion({ children }: { children: ReactNode }) {
  const reducedMotion = useUiStore((state) => state.reducedMotion);
  const { pathname } = useLocation();
  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      {pathname.startsWith("/dashboard") ? (
        children
      ) : (
        <div key={pathname} className="kyro-page-enter">
          {children}
        </div>
      )}
    </MotionConfig>
  );
}

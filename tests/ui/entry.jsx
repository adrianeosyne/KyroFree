import { SiteMotion } from "@/components/SiteMotion";
// Local-only fixture: real product components, deterministic data, no accounts.
import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import Dashboard from "@/pages/Dashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/store";
import { GifterBadge } from "@/components/app/PremiumBadge";
import { StyledDisplayName } from "@/components/app/StyledDisplayName";
import { BadgeTray } from "@/components/app/GlobalBadges";
import "@/index.css";

window.setFixtureTheme = (theme) =>
  useUiStore.getState().setPreference("theme", theme);
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <SiteMotion>
      <TooltipProvider>
        <Routes>
          <Route
            path="/dashboard/badge-preview"
            element={
              <main className="space-y-4 p-6">
                {[0, 1, 9, 10, 24, 25, 49, 50, 100].map((count) => (
                  <div key={count} data-testid={`gift-${count}`}>
                    <GifterBadge count={count} />
                  </div>
                ))}
                <div data-testid="gifts-only-profile">
                  <BadgeTray badges={[]} user={{ premiumGiftCount: 25 }} />
                </div>
                <StyledDisplayName
                  user={{
                    name: "Adrian Eosyne",
                    badges: ["premium"],
                    premiumUntil: Date.now() + 86400000,
                    premiumBadgeTier: "Celestial",
                    displayNameColorMode: "gradient",
                    displayNameColor: "#111827",
                    displayNameColor2: "#94a3b8",
                  }}
                />
              </main>
            }
          />
          <Route path="/dashboard/*" element={<Dashboard />} />
        </Routes>
      </TooltipProvider>
    </SiteMotion>
  </BrowserRouter>,
);

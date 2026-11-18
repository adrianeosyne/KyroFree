// Local-only fixture: real product components, deterministic data, no accounts.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import Dashboard from "@/pages/Dashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/store";
import "@/index.css";
import { ImageCropDialog } from "@/components/app/ImageCropDialog";
import { Toaster } from "@/components/ui/sonner";

function CropFixture() {
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("avatar");
  const sizes = {
    avatar: [512, 512],
    icon: [512, 512],
    profile: [1500, 500],
    server: [1600, 500],
  };
  const [width, height] = sizes[kind];
  return (
    <>
      <select
        aria-label="Image type"
        value={kind}
        onChange={(event) => setKind(event.target.value)}
      >
        {Object.keys(sizes).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <input
        aria-label="Choose crop image"
        type="file"
        accept="image/*"
        onChange={(event) => {
          setFile(event.target.files[0]);
          event.target.value = "";
        }}
      />
      {file && (
        <ImageCropDialog
          file={file}
          title="Crop fixture"
          aspect={width / height}
          outputWidth={width}
          outputHeight={height}
          rounded={kind === "avatar"}
          onCancel={() => setFile(null)}
          onComplete={(result) => {
            if (window.fixtureCrop?.url)
              URL.revokeObjectURL(window.fixtureCrop.url);
            window.fixtureCrop = {
              url: URL.createObjectURL(result),
              name: result.name,
              type: result.type,
              size: result.size,
            };
            setFile(null);
          }}
        />
      )}
    </>
  );
}
import { SiteMotion } from "@/components/SiteMotion";
import GiftRoute from "@/pages/Gift";
import DownloadPage from "@/pages/Download";
import { MobileDownloadBanner } from "@/components/app/MobileDownloadBanner";
import { GifterBadge } from "@/components/app/PremiumBadge";
import { StyledDisplayName } from "@/components/app/StyledDisplayName";
import { BadgeTray } from "@/components/app/GlobalBadges";

window.setFixtureTheme = (theme) =>
  useUiStore.getState().setPreference("theme", theme);
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <MobileDownloadBanner floating />
    <SiteMotion>
      <TooltipProvider>
        <Toaster />
        <Routes>
        <Route
          path="/dashboard/crop-fixture"
          element={
            <React.StrictMode>
              <CropFixture />
            </React.StrictMode>
          }
        />

          <Route path="/auth" element={<p>Sign in fixture</p>} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/gift/:code" element={<GiftRoute />} />
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
                <BadgeTray badges={["moderator"]} />
                {["Premium", "Ember"].map((tier) => (
                  <div key={tier} data-testid={`premium-tier-${tier}`}>
                    <StyledDisplayName
                      user={{
                        name: tier,
                        badges: ["premium"],
                        premiumUntil: Date.now() + 86400000,
                        premiumBadgeTier: tier,
                      }}
                    />
                  </div>
                ))}
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

// Local-only fixture: real product components, deterministic data, no accounts.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router";
import Dashboard from "@/pages/Dashboard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUiStore } from "@/lib/store";
import "@/index.css";
import { ImageCropDialog } from "@/components/app/ImageCropDialog";

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

window.setFixtureTheme = (theme) =>
  useUiStore.getState().setPreference("theme", theme);
createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <TooltipProvider>
      <Routes>
        <Route
          path="/dashboard/crop-fixture"
          element={
            <React.StrictMode>
              <CropFixture />
            </React.StrictMode>
          }
        />
        <Route path="/dashboard/*" element={<Dashboard />} />
      </Routes>
    </TooltipProvider>
  </BrowserRouter>,
);

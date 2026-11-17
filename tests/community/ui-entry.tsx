import React from "react";
import { createRoot } from "react-dom/client";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { ServerVerificationAdmin } from "@/components/app/ServerVerificationAdmin";
import { BadgeTray } from "@/components/app/GlobalBadges";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFixture } from "./ui-fixture.js";
import "@/index.css";
function Fixture() {
  const data = useFixture();
  return (
    <TooltipProvider>
      <PresenceHeartbeat />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-4 text-xl font-semibold">Admin Portal · Servers</h1>
        <ServerVerificationAdmin canVerify={data.canVerify} />
        <h2 className="mt-8 mb-2 font-semibold">Owner profile</h2>
        <BadgeTray
          badges={data.server.verified ? ["verifiedserverowner"] : []}
        />
      </main>
    </TooltipProvider>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);

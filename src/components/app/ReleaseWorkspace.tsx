import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, LoadingRows, ConfirmDelete } from "./AdvancedShared";
import { TokenDialog, useBotTask } from "./BotPlatformShared";
import { generateBotCredential } from "@/lib/botContract";
import { renderMessage } from "@/lib/markdown";

export function ReleaseWorkspace() {
  const apps = useQuery(api.appReleases.workspaces, {});
  const respond = useMutation(api.appReleases.respond);
  const [selected, setSelected] = useState<Id<"botApplications"> | null>(null);
  const task = useBotTask();
  if (!apps) return <LoadingRows />;
  const app = apps.find((a) => a.id === selected && !a.pending);
  return (
    <main className="h-full overflow-y-auto p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <h1 className="text-2xl font-bold tracking-tight">
          Application releases and teams
        </h1>
        <p className="text-sm text-muted-foreground">
          Work together on versions and changelogs. Credentials and ownership
          controls stay with the owner.
        </p>
        <Link className="text-primary underline" to="/dashboard/developers">
          Developer portal
        </Link>
        {apps
          .filter((a) => a.pending)
          .map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-3 border-b py-3"
            >
              <p className="flex-1 text-sm">
                {a.name} invited you as a {a.role}.
              </p>
              {[true, false].map((accept) => (
                <Button
                  key={String(accept)}
                  disabled={task.busy}
                  size="sm"
                  variant={accept ? "default" : "outline"}
                  onClick={() =>
                    void task.run(() =>
                      respond({ applicationId: a.id, accept }),
                    )
                  }
                >
                  {accept ? "Accept invitation" : "Decline invitation"}
                </Button>
              ))}
            </div>
          ))}
        <label className="block space-y-2">
          <span className="text-sm">Application workspace</span>
          <select
            aria-label="Application workspace"
            className="h-10 w-full rounded-md border bg-background px-3"
            value={app?.id ?? ""}
            onChange={(e) =>
              setSelected(
                e.target.value
                  ? (e.target.value as Id<"botApplications">)
                  : null,
              )
            }
          >
            <option value="">Choose an application</option>
            {apps
              .filter((a) => !a.pending)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.role}
                </option>
              ))}
          </select>
        </label>
        {app ? (
          <ReleasePanel key={app.id} applicationId={app.id} />
        ) : (
          <EmptyState>
            Select an application or accept an invitation to get started.
          </EmptyState>
        )}
      </div>
    </main>
  );
}
export function ReleasePanel({
  applicationId,
}: {
  applicationId: Id<"botApplications">;
}) {
  const team = useQuery(api.appReleases.collaborators, { applicationId });
  const [channel, setChannel] = useState<"production" | "staging">(
    "production",
  );
  const releases = usePaginatedQuery(
    api.appReleases.list,
    { applicationId, channel },
    { initialNumItems: 10 },
  );
  const publish = useMutation(api.appReleases.publish),
    activate = useMutation(api.appReleases.activate),
    invite = useMutation(api.appReleases.invite),
    remove = useMutation(api.appReleases.removeCollaborator),
    stage = useMutation(api.appReleases.createStaging);
  const [value, setValue] = useState({
    version: "",
    changelog: "",
    sourceUrl: "",
  });
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"viewer" | "maintainer">("viewer");
  const [stageName, setStageName] = useState("");
  const [secret, setSecret] = useState("");
  const task = useBotTask();
  if (!team) return <LoadingRows />;
  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Release channels" className="flex gap-2">
        {(["production", "staging"] as const).map((c) => (
          <Button
            key={c}
            role="tab"
            aria-selected={channel === c}
            variant={channel === c ? "default" : "outline"}
            onClick={() => setChannel(c)}
          >
            {c === "production" ? "Production releases" : "Staging releases"}
          </Button>
        ))}
      </div>
      {(team.isOwner || (team.canStage && channel === "staging")) && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void task.run(async () => {
              await publish({
                applicationId,
                channel,
                ...value,
                sourceUrl: value.sourceUrl || undefined,
              });
              setValue({ version: "", changelog: "", sourceUrl: "" });
            }, "Release published");
          }}
        >
          <Input
            aria-label="Release version"
            maxLength={80}
            placeholder="Version, e.g. 1.2.0"
            value={value.version}
            onChange={(e) => setValue({ ...value, version: e.target.value })}
          />
          <Textarea
            aria-label="Release changelog"
            maxLength={10000}
            placeholder="What changed? Markdown is supported."
            value={value.changelog}
            onChange={(e) => setValue({ ...value, changelog: e.target.value })}
          />
          <Input
            aria-label="Release source URL"
            maxLength={2000}
            placeholder="HTTPS source or download URL (optional)"
            value={value.sourceUrl}
            onChange={(e) => setValue({ ...value, sourceUrl: e.target.value })}
          />
          <Button
            disabled={
              task.busy || !value.version.trim() || !value.changelog.trim()
            }
            type="submit"
          >
            Publish {channel} release
          </Button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">
        Releases record immutable versions and changelogs. Activating one
        announces it to installers; deploy your bot code on your own
        infrastructure.
      </p>
      {releases.status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : !releases.results.length ? (
        <EmptyState>No releases in this channel yet.</EmptyState>
      ) : (
        releases.results.map((row) => (
          <article key={row._id} className="space-y-3 border-b py-4">
            <p className="font-semibold">
              {row.version}
              {team.activeReleaseId === row._id ? " · Active" : ""}
            </p>
            <div className="whitespace-pre-wrap break-words text-sm">
              {renderMessage(row.changelog)}
            </div>
            {row.sourceUrl && (
              <a
                className="text-primary underline"
                href={row.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Release source
              </a>
            )}
            {team.isOwner &&
              channel === "production" &&
              team.activeReleaseId !== row._id && (
                <ConfirmDelete
                  title={`Activate version ${row.version}?`}
                  description="This changes the public version and notifies installers. Installation permissions stay the same."
                  onConfirm={() =>
                    activate({
                      releaseId: row._id,
                      expectedActive: team.activeReleaseId,
                    })
                  }
                >
                  Activate version
                </ConfirmDelete>
              )}
          </article>
        ))
      )}
      {releases.status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => releases.loadMore(10)}>
          More releases
        </Button>
      )}
      <section className="space-y-3 border-t pt-4">
        <h2 className="font-semibold">Collaborators</h2>
        <p className="text-xs text-muted-foreground">
          Viewers read releases. Maintainers publish staging releases. Owners
          control production releases, invitations, credentials and transfers.
        </p>
        {team.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span>
              {member.name} · {member.role} ·{" "}
              {member.accepted ? "Accepted" : "Invitation pending"}
            </span>
            {team.isOwner && (
              <ConfirmDelete
                title="Remove collaborator?"
                description="Their workspace access ends immediately."
                onConfirm={() => remove({ applicationId, userId: member.id })}
              >
                Remove
              </ConfirmDelete>
            )}
          </div>
        ))}
        {team.isOwner && (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void task.run(async () => {
                await invite({ applicationId, username, role });
                setUsername("");
              }, "Invitation sent");
            }}
          >
            <Input
              className="min-w-40 flex-1"
              aria-label="Collaborator username"
              placeholder="Member username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <select
              aria-label="Collaborator role"
              className="rounded-md border bg-background px-2"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="viewer">Viewer</option>
              <option value="maintainer">Maintainer</option>
            </select>
            <Button type="submit" disabled={task.busy || !username.trim()}>
              Invite collaborator
            </Button>
          </form>
        )}
      </section>
      {team.isOwner && (
        <section className="space-y-3 border-t pt-4">
          <h2 className="font-semibold">Isolated staging environment</h2>
          {team.stagingApplicationId ? (
            <Link
              className="text-primary underline"
              to={`/dashboard/developers/${team.stagingApplicationId}?section=Sandbox`}
            >
              Open staging application
            </Link>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void task.run(async () => {
                  const credential = await generateBotCredential();
                  await stage({
                    applicationId,
                    name: `${stageName} staging`,
                    username: stageName,
                    tokenHash: credential.tokenHash,
                  });
                  setSecret(credential.token);
                }, "Staging app and test community created");
              }}
            >
              <p className="text-xs text-muted-foreground">
                Uses a separate application slot and credential. The staging bot
                can only install in its own private test community.
              </p>
              <Input
                aria-label="Staging bot username"
                maxLength={24}
                placeholder="Unique staging bot username"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
              />
              <Button disabled={task.busy || !stageName.trim()} type="submit">
                Create staging environment
              </Button>
            </form>
          )}
        </section>
      )}
      <TokenDialog token={secret} onClose={() => setSecret("")} />
    </div>
  );
}

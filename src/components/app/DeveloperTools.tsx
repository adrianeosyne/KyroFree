import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BotPanel, TokenDialog, useBotTask } from "./BotPlatformShared";
import { ACCEPTED_UPLOAD } from "@/lib/upload";
import { useUploadQueue } from "@/lib/useUploadQueue";
import { useNow } from "@/hooks/use-now";
import { isManagedFileApi } from "@/lib/file-api";
import { formatBytes } from "@/lib/format";
import { generateBotCredential, BOT_EVENTS } from "@/lib/botContract";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { toast } from "sonner";
type App = FunctionReturnType<typeof api.botApplications.get>;

export function DeveloperSummary() {
  const data = useQuery(api.botAnalytics.dashboard),
    transfers = useQuery(api.developerManagement.transfers),
    accept = useMutation(api.developerManagement.acceptTransfer),
    task = useBotTask();
  if (!data)
    return (
      <p className="mb-4 text-sm text-[#A0A6B5]">Loading developer activity…</p>
    );
  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Object.entries({
          Applications: data.applications,
          Bots: data.bots,
          Installations: data.installations,
          "Active installations": data.activeInstallations,
          "API requests": data.apiRequests,
          "Gateway connections": data.gatewayConnections,
          "Commands executed": data.commandsExecuted,
          "Deliveries (30 days)": data.eventDeliveries,
          "Delivery failures (30 days)": data.deliveryFailures,
          "API errors (30 days)": data.apiErrors,
        }).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-[#1B1E27] p-4"
          >
            <p className="text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-[#A0A6B5]">{label}</p>
          </div>
        ))}
      </div>
      {data.security.map((s) => (
        <p
          key={s.id}
          className="rounded-lg border border-amber-400/25 p-3 text-sm text-amber-200"
        >
          <Link to={`/dashboard/developers/${s.id}`}>
            {s.name}: {s.message}
          </Link>
        </p>
      ))}
      {transfers?.map((t) => (
        <div
          key={t.id}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-indigo-400/25 p-3 text-sm"
        >
          <span>
            Ownership offered: {t.name}. Accepting revokes its current token.
          </span>
          <Button
            size="sm"
            disabled={task.busy}
            onClick={() =>
              void task.run(() => accept({ applicationId: t.id, accept: true }))
            }
          >
            Accept transfer
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void task.run(() =>
                accept({ applicationId: t.id, accept: false }),
              )
            }
          >
            Decline
          </Button>
        </div>
      ))}
      <details className="text-sm">
        <summary className="cursor-pointer text-[#A0A6B5]">
          Recent application activity
        </summary>
        <div className="mt-2 space-y-2">
          {data.activity.map((a) => (
            <Link
              className="block rounded border border-white/5 p-2"
              key={a.id}
              to={`/dashboard/developers/${a.applicationId}?section=Audit+Logs`}
            >
              {a.applicationName} · {a.action} ·{" "}
              {new Date(a.createdAt).toLocaleString()}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
export function ApplicationSelector({
  applicationId,
}: {
  applicationId: string;
}) {
  const apps = useQuery(api.botApplications.list),
    navigate = useNavigate(),
    [params] = useSearchParams();
  return (
    <select
      aria-label="Select application"
      className="mb-4 w-full max-w-sm rounded-lg border border-white/10 bg-[#1B1E27] p-3 text-sm"
      value={applicationId}
      onChange={(e) =>
        navigate(`/dashboard/developers/${e.target.value}?${params}`)
      }
    >
      {apps?.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}
export function ApplicationMetadata({ app }: { app: App }) {
  const [value, setValue] = useState({
    website: app.website,
    supportUrl: app.supportUrl,
    privacyUrl: app.privacyUrl,
    termsUrl: app.termsUrl,
    contactEmail: app.contactEmail,
    redirectUris: app.redirectUris,
  });
  const save = useMutation(api.developerManagement.saveMetadata),
    task = useBotTask();
  return (
    <BotPanel
      title="Developer and policy information"
      description="Public links help communities identify your application. Contact email remains private to its owner."
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(
            () => save({ applicationId: app.id, metadata: value }),
            "Application information saved",
          );
        }}
      >
        {(
          [
            ["website", "Website"],
            ["supportUrl", "Support URL"],
            ["privacyUrl", "Privacy policy URL"],
            ["termsUrl", "Terms of service URL"],
            ["contactEmail", "Developer contact email"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1 text-sm">
            <span>{label}</span>
            <Input
              type={key === "contactEmail" ? "email" : "url"}
              placeholder={
                key === "contactEmail" ? "developer@example.com" : "https://"
              }
              value={value[key]}
              onChange={(e) => setValue({ ...value, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="block space-y-1 text-sm">
          <span>
            Registered installation redirect URIs (one HTTPS URL per line)
          </span>
          <Textarea
            value={value.redirectUris.join("\n")}
            onChange={(e) =>
              setValue({
                ...value,
                redirectUris: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </label>
        <Button disabled={task.busy} type="submit">
          Save developer information
        </Button>
      </form>
    </BotPanel>
  );
}
export function DeveloperAssets({
  applicationId,
}: {
  applicationId?: Id<"botApplications">;
}) {
  const navigate = useNavigate();
  if (!isManagedFileApi) {
    return (
      <BotPanel
        title="Files shared in your conversations"
        description="Preview and download attachments from the messages where they were shared."
      >
        <Button onClick={() => navigate("/dashboard")}>
          Open conversations
        </Button>
      </BotPanel>
    );
  }
  return <ManagedDeveloperAssets applicationId={applicationId} />;
}

function ManagedDeveloperAssets({
  applicationId,
}: {
  applicationId?: Id<"botApplications">;
}) {
  const now = useNow();
  const [search, setSearch] = useState("");
  const { results, status, loadMore } = usePaginatedQuery(
    api.files.list,
    {
      ...(applicationId ? { applicationId } : {}),
      search,
      refresh: Math.floor(now / 600000),
    },
    { initialNumItems: 24 },
  );
  const usage = useQuery(api.files.usage),
    remove = useMutation(api.files.remove),
    task = useBotTask();
  const uploads = useUploadQueue(
    applicationId ?? "my-files",
    applicationId,
    true,
  );
  return (
    <BotPanel
      title={applicationId ? "Application file assets" : "Your files"}
      description="Private files use expiring download links. Files used by messages or profile resources must be removed from those resources first."
    >
      {usage && (
        <p className="text-sm text-[#A0A6B5]">
          {formatBytes(usage.bytes)} / {formatBytes(usage.quotaBytes)} used ·{" "}
          {usage.files} files · 10 MiB per file
        </p>
      )}
      <label className="block text-sm">
        Upload assets
        <Input
          className="mt-2"
          type="file"
          accept={ACCEPTED_UPLOAD}
          multiple
          disabled={task.busy}
          onChange={(e) => {
            uploads.addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      {uploads.jobs.map((job) => (
        <div
          key={job.id}
          className="rounded border border-white/10 p-2 text-sm"
        >
          <p>
            {job.file.name} ·{" "}
            {job.status === "complete"
              ? "Uploaded"
              : job.status === "failed"
                ? "Failed"
                : `${job.progress}%`}
          </p>
          {job.status === "uploading" && (
            <progress
              aria-label={`Uploading ${job.file.name}`}
              value={job.progress}
              max={100}
              className="w-full"
            />
          )}
          {job.error && <p role="alert">{job.error}</p>}
          {job.status === "failed" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => uploads.retry(job.id)}
            >
              Retry
            </Button>
          )}
          {job.status !== "complete" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => uploads.remove(job.id)}
            >
              Cancel
            </Button>
          )}
        </div>
      ))}
      {uploads.jobs.length > 0 && !uploads.pending && (
        <Button variant="ghost" size="sm" onClick={uploads.clear}>
          Clear upload status
        </Button>
      )}
      <Input
        aria-label="Search files"
        placeholder="Search filenames"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {results.map((file) => (
          <div
            key={file.id}
            className="min-w-0 rounded-lg border border-white/10 p-3"
          >
            {file.url && file.mimeType.startsWith("image/") && (
              <img
                src={file.url}
                alt={file.name}
                className="mb-3 h-28 w-full rounded object-contain"
                loading="lazy"
              />
            )}
            <p className="truncate text-sm font-medium" title={file.name}>
              {file.name}
            </p>
            <p className="mt-1 break-all text-xs text-[#A0A6B5]">
              {formatBytes(file.size)} · {file.mimeType} · {file.status}
            </p>
            <p className="mt-1 text-xs text-[#A0A6B5]">
              {new Date(file.createdAt).toLocaleString()}
            </p>
            <code
              className="mt-2 block truncate text-[10px]"
              title={file.storageId}
            >
              {file.storageId}
            </code>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(file.storageId)
                    .then(() => toast.success("File ID copied"))
                }
              >
                Copy ID
              </Button>
              {file.url && (
                <Button size="sm" variant="ghost" asChild>
                  <a href={file.url} target="_blank" rel="noopener noreferrer">
                    Download
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={file.claimed || task.busy}
                onClick={() =>
                  void task.run(
                    () => remove({ storageId: file.storageId }),
                    "File removed",
                  )
                }
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
      {results.length === 0 && status !== "LoadingFirstPage" && (
        <p className="text-sm text-[#A0A6B5]">No files found.</p>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(24)}>
          Load more files
        </Button>
      )}
    </BotPanel>
  );
}
export function DeveloperAnalytics({
  applicationId,
}: {
  applicationId: Id<"botApplications">;
}) {
  const [days, setDays] = useState(7),
    data = useQuery(api.botAnalytics.get, { applicationId, days });
  return (
    <BotPanel
      title="API and gateway analytics"
      description="Usage is recorded in the database. Daily analytics start when this version is deployed."
    >
      <select
        aria-label="Analytics time range"
        className="rounded border border-white/10 bg-[#111318] p-2"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        {[1, 7, 30, 90].map((d) => (
          <option key={d} value={d}>
            {d} days
          </option>
        ))}
      </select>
      {data && (
        <>
          <p className="text-sm">
            {data.activeInstallations} active installations /{" "}
            {data.installations} total · Latest 100 events:{" "}
            {data.recentDelivered} delivered, {data.recentFailed} failed
          </p>
          {data.daily.length ? (
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart
                  data={data.daily.map((d) => ({
                    ...d,
                    date: new Date(d.day).toLocaleDateString(),
                  }))}
                >
                  <XAxis dataKey="date" stroke="#A0A6B5" fontSize={10} />
                  <YAxis stroke="#A0A6B5" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "#1B1E27",
                      borderColor: "#343844",
                    }}
                  />
                  <Line dataKey="requests" stroke="#818cf8" />
                  <Line dataKey="errors" stroke="#fb7185" />
                  <Line dataKey="delivered" stroke="#22d3ee" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-[#A0A6B5]">
              No daily usage recorded yet.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                "requests",
                "errors",
                "commands",
                "connections",
                "delivered",
                "failed",
                "uploadedBytes",
              ] as const
            ).map((k) => (
              <p className="rounded border border-white/5 p-2" key={k}>
                {k}: {data.daily.reduce((s, d) => s + d[k], 0)}
              </p>
            ))}
          </div>
          <h3 className="font-medium">Gateway sessions</h3>
          {data.sessions.length ? (
            data.sessions.map((s) => (
              <p key={s.id} className="break-all text-xs">
                {s.label} · {s.connected ? "Connected" : "Disconnected"} ·{" "}
                {new Date(s.lastHeartbeatAt).toLocaleString()}
              </p>
            ))
          ) : (
            <p className="text-sm text-[#A0A6B5]">No SDK sessions yet.</p>
          )}
          <h3 className="font-medium">Recent API requests</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="p-2">Endpoint</th>
                  <th>Status</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="max-w-sm break-all p-2 font-mono">
                      {r.method} /api/v1/{r.path}
                    </td>
                    <td>{r.status}</td>
                    <td>{r.durationMs} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </BotPanel>
  );
}
export function DeveloperSettings({ app }: { app: App }) {
  const [name, setName] = useState(`${app.name} copy`),
    [username, setUsername] = useState(""),
    [recipient, setRecipient] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [secret, setSecret] = useState(""),
    [createdId, setCreatedId] = useState("");
  const duplicate = useMutation(api.developerManagement.duplicate),
    transfer = useMutation(api.developerManagement.requestTransfer),
    task = useBotTask(),
    navigate = useNavigate();
  return (
    <>
      <BotPanel
        title="Duplicate application"
        description="Copies configuration and global commands. The copy gets a new bot identity and token, with no installations or webhook endpoint."
      >
        <Input
          aria-label="Duplicated application name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          aria-label="Duplicated bot username"
          placeholder="New bot username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Button
          disabled={task.busy || !username}
          onClick={() =>
            void task.run(async () => {
              const credential = await generateBotCredential();
              const id = await duplicate({
                applicationId: app.id,
                name,
                username,
                tokenHash: credential.tokenHash,
              });
              setCreatedId(id);
              setSecret(credential.token);
            })
          }
        >
          Duplicate application
        </Button>
      </BotPanel>
      <BotPanel
        title="Transfer ownership"
        description="The recipient must accept. Acceptance revokes the existing token and clears the webhook and redirect configuration."
      >
        <Input
          aria-label="Recipient username"
          placeholder="Recipient username"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <Input
          aria-label="Transfer confirmation"
          placeholder={`Type ${app.name} to confirm`}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Button
          disabled={task.busy || confirmation !== app.name || !recipient}
          onClick={() =>
            void task.run(
              () =>
                transfer({
                  applicationId: app.id,
                  username: recipient,
                  confirmation,
                }),
              "Transfer offered",
            )
          }
        >
          Offer ownership transfer
        </Button>
        {app.transferTo && (
          <p className="text-sm text-[#A0A6B5]">A transfer offer is pending.</p>
        )}
      </BotPanel>
      <TokenDialog
        token={secret}
        onClose={() => {
          setSecret("");
          if (createdId) navigate(`/dashboard/developers/${createdId}`);
        }}
      />
    </>
  );
}
export function DeveloperSandbox({ app }: { app: App }) {
  const create = useMutation(api.developerSandbox.create),
    install = useMutation(api.botApplications.install),
    request = useAction(api.developerSandbox.request),
    test = useMutation(api.developerSandbox.testEvent),
    task = useBotTask();
  const [method, setMethod] = useState("GET"),
    [path, setPath] = useState("me"),
    [body, setBody] = useState("{}"),
    [result, setResult] = useState(""),
    [event, setEvent] = useState("message.created");
  return (
    <BotPanel
      title="Developer sandbox"
      description="Create a private test server and exercise your bot's actual API. Developers run bot code on their own infrastructure."
    >
      <Button
        disabled={task.busy}
        onClick={() =>
          void task.run(async () => {
            const serverId = await create({ applicationId: app.id });
            await install({
              applicationId: app.id,
              serverId,
              permissions: app.permissions,
            });
          }, "Private test server ready")
        }
      >
        {app.sandboxServerId
          ? "Install or update bot in test server"
          : "Create private test server"}
      </Button>
      {app.sandboxServerId && (
        <Link
          className="block text-sm text-indigo-300"
          to={`/dashboard/s/${app.sandboxServerId}`}
        >
          Open test server
        </Link>
      )}
      <p className="text-xs text-[#A0A6B5]">
        Writes are restricted to your private test server. Use a separate
        application and token for production.
      </p>
      <div className="flex gap-2">
        <select
          aria-label="API method"
          className="rounded border border-white/10 bg-[#111318] p-2"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <Input
          aria-label="API path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="channels/CHANNEL_ID/messages"
        />
      </div>
      <Textarea
        aria-label="API request body"
        value={body}
        className="font-mono text-xs"
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        disabled={!app.sandboxServerId || task.busy}
        onClick={() =>
          void task.run(async () => {
            try {
              const data = await request({
                applicationId: app.id,
                method,
                path: path.replace(/^\/+/, ""),
                body: JSON.parse(body),
              });
              setResult(JSON.stringify(data, null, 2));
            } catch (cause) {
              setResult(
                cause instanceof Error ? cause.message : "Request failed",
              );
              throw cause;
            }
          })
        }
      >
        Run API request
      </Button>
      {result && (
        <pre className="max-h-72 overflow-auto rounded bg-[#111318] p-3 text-xs">
          {result}
        </pre>
      )}
      <select
        aria-label="Test event"
        className="max-w-full rounded border border-white/10 bg-[#111318] p-2"
        value={event}
        onChange={(e) => setEvent(e.target.value)}
      >
        {BOT_EVENTS.filter(
          (e) => e.includes(".") && !e.startsWith("interaction"),
        ).map((e) => (
          <option key={e}>{e}</option>
        ))}
      </select>
      <Button
        disabled={!app.sandboxServerId || task.busy}
        variant="outline"
        onClick={() =>
          void task.run(
            () => test({ applicationId: app.id, type: event }),
            "Test envelope queued if subscribed",
          )
        }
      >
        Queue test event
      </Button>
    </BotPanel>
  );
}

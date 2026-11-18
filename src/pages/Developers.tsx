import { useState } from "react";
import { useNow } from "@/hooks/use-now";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { motion } from "framer-motion";
import {
  Bot,
  Code2,
  Plus,
  ArrowLeft,
  KeyRound,
  ExternalLink,
  Trash2,
  Copy,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  BOT_CATEGORIES,
  BOT_EVENTS,
  generateBotCredential,
  type BotCommand,
} from "@/lib/botContract";
import { useUploadFile } from "@/lib/upload";
import { toast } from "sonner";
import {
  ApplicationSelector,
  DeveloperSummary,
  ApplicationMetadata,
  DeveloperAssets,
  DeveloperAnalytics,
  DeveloperSettings,
  DeveloperSandbox,
} from "@/components/app/DeveloperTools";
import {
  BotApiDocumentation,
  BotLoading,
  BotPanel,
  PermissionPicker,
  TokenDialog,
  useBotTask,
} from "@/components/app/BotPlatformShared";

import { ReleasePanel } from "@/components/app/ReleaseWorkspace";
type App = FunctionReturnType<typeof api.botApplications.get>;
const tabs = [
  "Overview",
  "General Information",
  "Bot Configuration",
  "OAuth2 & Authorization",
  "Bot Token",
  "Installation",
  "Permissions",
  "Slash Commands",
  "Webhooks & Events",
  "API Documentation",
  "Analytics",
  "Audit Logs",
  "File Assets",
  "Events",
  "Webhooks",
  "Integrations",
  "Developer Settings",
  "Sandbox",
  "Releases and Team",
];
export default function Developers() {
  const { applicationId } = useParams();
  return (
    <div className="h-full overflow-y-auto bg-[#111318] text-white">
      <div className="mx-auto max-w-6xl p-4 pb-24 sm:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard/developers" className="flex items-center gap-3">
            <span className="rounded-xl bg-indigo-500/15 p-3 text-indigo-300">
              <Code2 className="size-6" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#A0A6B5]">
                Kyro Developers
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                Build something that belongs.
              </h1>
            </div>
          </Link>
          <Link className="text-sm text-indigo-300" to="/dashboard/bots">
            Explore bots <ExternalLink className="ml-1 inline size-3" />
          </Link>
          <a
            className="text-sm text-indigo-300"
            href="https://kyro-chat.cyou/docs"
          >
            Developer documentation
          </a>
        </div>
        {applicationId ? (
          <Application applicationId={applicationId as Id<"botApplications">} />
        ) : (
          <Applications />
        )}
      </div>
    </div>
  );
}
function Applications() {
  const apps = useQuery(api.botApplications.list);
  const create = useMutation(api.botApplications.create);
  const asset = useMutation(api.botApplications.asset);
  const upload = useUploadFile({ requireRegistration: true });
  const task = useBotTask();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [secret, setSecret] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your applications</h2>
          <p className="mt-1 text-sm text-[#A0A6B5]">
            Create an identity, choose its permissions, and connect your code.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-[#5865F2] hover:bg-indigo-500"
        >
          <Plus className="mr-2 size-4" />
          New application
        </Button>
      </div>
      <DeveloperSummary />
      {apps === undefined ? (
        <BotLoading />
      ) : apps.length === 0 ? (
        <BotPanel
          title="Your next idea starts here"
          description="Bring helpful tools, games, or community experiences to Kyro."
        >
          <Button variant="outline" onClick={() => setOpen(true)}>
            Create your first application
          </Button>
        </BotPanel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Link
                to={`/dashboard/developers/${app.id}`}
                className="block rounded-xl border border-white/10 bg-[#1B1E27] p-5 transition-colors hover:border-indigo-400/50"
              >
                <div className="mb-5 flex items-center justify-between">
                  {app.iconUrl ? (
                    <img
                      src={app.iconUrl}
                      alt=""
                      className="size-12 rounded-xl object-cover"
                    />
                  ) : (
                    <Bot className="size-10 text-indigo-300" />
                  )}
                  <span
                    className={`text-xs ${app.enabled && !app.suspended ? "text-emerald-300" : "text-[#A0A6B5]"}`}
                  >
                    {app.suspended
                      ? "Suspended"
                      : app.enabled
                        ? "Enabled"
                        : "Disabled"}
                  </span>
                </div>
                <h3 className="font-semibold">{app.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-[#A0A6B5]">
                  {app.description || "No description yet"}
                </p>
                <p className="mt-4 text-xs text-[#A0A6B5]">
                  {app.serverCount} servers · @{app.username}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create an application</DialogTitle>
            <DialogDescription>
              Your application owns one bot identity. You can configure its
              permissions after creation.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void task.run(async () => {
                const credential = await generateBotCredential();
                const id = await create({
                  name,
                  username,
                  description,
                  tokenHash: credential.tokenHash,
                });
                setCreatedId(id);
                setSecret(credential.token);
                setOpen(false);
                if (avatar) {
                  const file = await upload(avatar);
                  await asset({
                    applicationId: id,
                    kind: "avatar",
                    storageId: file.storageId,
                  });
                }
              });
            }}
          >
            <Field label="Application name">
              <Input
                required
                minLength={2}
                maxLength={64}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Bot username">
              <Input
                required
                pattern="[a-z0-9_]{3,32}"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            </Field>
            <Field label="Description">
              <Textarea
                maxLength={400}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <Field label="Bot avatar (optional)">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
              />
            </Field>
            <Button type="submit" disabled={task.busy}>
              Create application
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
function Application({
  applicationId,
}: {
  applicationId: Id<"botApplications">;
}) {
  const app = useQuery(api.botApplications.get, { applicationId });
  return app === undefined ? (
    <BotLoading />
  ) : (
    <ApplicationEditor key={applicationId} app={app} />
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
function ApplicationEditor({ app }: { app: App }) {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const tab = tabs.includes(params.get("section") ?? "")
    ? params.get("section")!
    : "Overview";
  const setTab = (section: string) => setParams({ section });
  const [name, setName] = useState(app.name);
  const [description, setDescription] = useState(app.description);
  const [username, setUsername] = useState(app.username);
  const [botDescription, setBotDescription] = useState(app.botDescription);
  const [enabled, setEnabled] = useState(app.enabled);
  const [discoverable, setDiscoverable] = useState(app.discoverable);
  const [category, setCategory] = useState(app.category);
  const [permissions, setPermissions] = useState(app.permissions);
  const [secret, setSecret] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const update = useMutation(api.botApplications.update);
  const rotate = useMutation(api.botApplications.token);
  const remove = useMutation(api.botApplications.remove);
  const asset = useMutation(api.botApplications.asset);
  const upload = useUploadFile({ requireRegistration: true });
  const task = useBotTask();
  const navigate = useNavigate();
  const [redirectUri, setRedirectUri] = useState("");
  const [installState, setInstallState] = useState<string>(() =>
    crypto.randomUUID(),
  );
  const invite = `${window.location.origin}/dashboard/bots/authorize/${app.id}?${new URLSearchParams({ permissions: permissions.join(","), state: installState, ...(redirectUri ? { redirect_uri: redirectUri } : {}) })}`;
  const save = () =>
    task.run(
      () =>
        update({
          applicationId: app.id,
          name,
          description,
          username,
          botDescription,
          enabled,
          discoverable,
          category,
          permissions,
        }),
      "Application saved",
    );
  const uploadAsset = (kind: "icon" | "banner" | "avatar", file?: File) =>
    file &&
    task.run(async () => {
      const uploaded = await upload(file);
      await asset({
        applicationId: app.id,
        kind,
        storageId: uploaded.storageId,
      });
    }, "Image updated");
  return (
    <>
      <ApplicationSelector applicationId={app.id} />
      <Link
        to="/dashboard/developers"
        className="mb-5 inline-flex items-center gap-2 text-sm text-[#A0A6B5]"
      >
        <ArrowLeft className="size-4" />
        All applications
      </Link>
      {app.suspended && (
        <div className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-sm">
          This application is suspended. {app.suspensionReason}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[210px_1fr]">
        <nav
          aria-label="Application settings"
          className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
        >
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              aria-current={tab === item ? "page" : undefined}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${tab === item ? "bg-[#5865F2]/20 text-indigo-200" : "text-[#A0A6B5] hover:bg-white/5"}`}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {tab === "General Information" && <ApplicationMetadata app={app} />}
          {tab === "File Assets" && <DeveloperAssets applicationId={app.id} />}
          {tab === "Analytics" && <DeveloperAnalytics applicationId={app.id} />}
          {tab === "Developer Settings" && <DeveloperSettings app={app} />}
          {tab === "Sandbox" && <DeveloperSandbox app={app} />}
          {tab === "Releases and Team" && <ReleasePanel key={app.id} applicationId={app.id} />}
          {tab === "Integrations" && (
            <BotPanel
              title="Connect your infrastructure"
              description="Use the official SDK or signed event webhooks to connect externally hosted integrations."
            >
              <Link to="/docs/sdk" className="text-indigo-300">
                SDK setup and examples
              </Link>
              <Link to="/docs/gateway" className="block text-indigo-300">
                Gateway connection guide
              </Link>
              <Button variant="outline" onClick={() => setTab("Webhooks")}>
                Configure webhook integration
              </Button>
              <Button variant="outline" onClick={() => setTab("Sandbox")}>
                Test the API
              </Button>
            </BotPanel>
          )}
          {(tab === "Overview" || tab === "Analytics") && (
            <>
              <BotPanel
                title={app.name}
                description={app.description || "Your application at a glance."}
              >
                <div className="flex items-center gap-4">
                  {app.avatarUrl ? (
                    <img
                      src={app.avatarUrl}
                      alt="Bot avatar"
                      className="size-16 rounded-xl object-cover"
                    />
                  ) : (
                    <Bot className="size-14 text-indigo-300" />
                  )}
                  <div>
                    <p>
                      @{app.username}{" "}
                      <span className="ml-2 text-xs text-indigo-300">
                        {app.verified ? "Verified bot" : "Bot"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#A0A6B5]">
                      {app.enabled &&
                      !app.suspended &&
                      app.lastActiveAt &&
                      (now === 0 ? app.online : app.lastActiveAt > now - 90_000)
                        ? "Online"
                        : "Offline"}{" "}
                      · Created {new Date(app.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs text-[#A0A6B5]">
                      Bot ID: {app.botId}
                    </p>
                  </div>
                </div>
              </BotPanel>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Servers", app.serverCount],
                  ["Members reached", app.usersReached],
                  ["Commands executed", app.commandsExecuted],
                  ["API requests", app.apiRequests],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-white/10 bg-[#1B1E27] p-4"
                  >
                    <p className="text-2xl font-semibold">{value}</p>
                    <p className="mt-1 text-xs text-[#A0A6B5]">{label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#A0A6B5]">
                Members reached counts distinct members currently observed in
                installed servers, up to 5,000 members per server. Command and
                API counts are recorded operations.
              </p>
            </>
          )}
          {tab === "General Information" && (
            <BotPanel
              title="General information"
              description="Application branding is separate from the bot profile members see."
            >
              <Field label="Application name">
                <Input
                  value={name}
                  maxLength={64}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field label="Application description">
                <Textarea
                  value={description}
                  maxLength={1000}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                {(["icon", "banner"] as const).map((kind) => (
                  <Field key={kind} label={`Application ${kind}`}>
                    <Input
                      type="file"
                      accept="image/*"
                      disabled={task.busy}
                      onChange={(e) =>
                        void uploadAsset(kind, e.target.files?.[0])
                      }
                    />
                  </Field>
                ))}
              </div>
              {app.bannerUrl && (
                <img
                  src={app.bannerUrl}
                  alt="Application banner"
                  className="h-32 w-full rounded-lg object-cover"
                />
              )}
              <Button disabled={task.busy} onClick={() => void save()}>
                Save changes
              </Button>
              <div className="border-t border-white/10 pt-4">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Delete application
                </Button>
              </div>
            </BotPanel>
          )}
          {tab === "Bot Configuration" && (
            <BotPanel
              title="Bot profile"
              description="This identity appears in server member lists and messages."
            >
              <Field label="Bot username">
                <Input
                  value={username}
                  maxLength={32}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                />
              </Field>
              <Field label="Bot description">
                <Textarea
                  value={botDescription}
                  maxLength={400}
                  onChange={(e) => setBotDescription(e.target.value)}
                />
              </Field>
              <Field label="Bot avatar">
                <Input
                  type="file"
                  accept="image/*"
                  disabled={task.busy}
                  onChange={(e) =>
                    void uploadAsset("avatar", e.target.files?.[0])
                  }
                />
              </Field>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="bot-enabled">Enable bot API access</Label>
                <Switch
                  id="bot-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="bot-public">
                  List in the public bot directory
                </Label>
                <Switch
                  id="bot-public"
                  checked={discoverable}
                  onCheckedChange={setDiscoverable}
                />
              </div>
              <Field label="Directory category">
                <select
                  className="w-full rounded-md border border-white/10 bg-[#111318] p-2"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {BOT_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Button disabled={task.busy} onClick={() => void save()}>
                Save bot settings
              </Button>
            </BotPanel>
          )}
          {tab === "Permissions" && (
            <BotPanel
              title="Default permissions"
              description="Requested during installation. Server administrators choose the actual grant and can revoke it. Changing defaults does not expand existing installations."
            >
              <PermissionPicker value={permissions} onChange={setPermissions} />
              <Button disabled={task.busy} onClick={() => void save()}>
                Save default permissions
              </Button>
            </BotPanel>
          )}
          {(tab === "OAuth2 & Authorization" || tab === "Installation") && (
            <BotPanel
              title="Server installation"
              description="A signed-in server administrator must review and approve the requested permissions."
            >
              <p className="text-sm text-[#A0A6B5]">
                Kyro uses account-based consent for bot installations. This
                grants a bot access to a server; it does not issue OAuth access
                to a user's account.
              </p>
              <Field label="Invitation URL">
                <Input value={invite} readOnly />
              </Field>
              <Field label="Registered redirect destination">
                <select
                  className="w-full rounded border border-white/10 bg-[#111318] p-2"
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                >
                  <option value="">Kyro success screen</option>
                  {app.redirectUris.map((uri) => (
                    <option key={uri} value={uri}>
                      {uri}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Installation state">
                <Input
                  value={installState}
                  onChange={(e) => setInstallState(e.target.value)}
                  minLength={16}
                  maxLength={200}
                />
              </Field>
              <p className="text-xs text-[#A0A6B5]">
                For an installation initiated by your site, generate a fresh
                state per browser session and verify it on return.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(invite)
                      .then(() => toast.success("Invite copied"))
                  }
                >
                  <Copy className="mr-2 size-4" />
                  Copy invite
                </Button>
                <Button variant="outline" asChild>
                  <Link to={invite}>Install bot</Link>
                </Button>
              </div>
              <div className="space-y-2">
                {app.installations.length ? (
                  app.installations.map((i) => (
                    <div
                      key={i.id}
                      className="flex justify-between rounded-lg border border-white/10 p-3 text-sm"
                    >
                      <span>{i.name}</span>
                      <span className="text-[#A0A6B5]">
                        {i.permissions.length} permissions
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#A0A6B5]">
                    This bot has not been installed in any servers.
                  </p>
                )}
              </div>
            </BotPanel>
          )}
          {tab === "Bot Token" && (
            <BotPanel
              title="Bot authentication token"
              description="Treat this token like a password. Existing tokens cannot be retrieved."
            >
              <p className="text-sm text-[#A0A6B5]">
                {app.tokenConfigured
                  ? "A token is configured."
                  : "No active token."}{" "}
                Last changed {new Date(app.tokenUpdatedAt).toLocaleString()}.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setRotateOpen(true)}>
                  <KeyRound className="mr-2 size-4" />
                  Generate new token
                </Button>
                <Button
                  variant="destructive"
                  disabled={task.busy || !app.tokenConfigured}
                  onClick={() => setRevokeOpen(true)}
                >
                  Revoke token
                </Button>
              </div>
            </BotPanel>
          )}
          {tab === "Slash Commands" && <Commands app={app} />}
          {["Webhooks & Events", "Webhooks", "Events"].includes(tab) && (
            <Events app={app} />
          )}
          {tab === "API Documentation" && (
            <>
              <Link className="mb-4 block text-indigo-300" to="/docs/api">
                Open complete developer documentation
              </Link>
              <BotApiDocumentation />
            </>
          )}
          {(tab === "Audit Logs" || tab === "Analytics") && (
            <BotPanel
              title="Recent activity"
              description="The latest 50 recorded application actions."
            >
              {app.logs.length ? (
                app.logs.map((log) => (
                  <div
                    key={log._id}
                    className="flex flex-wrap justify-between gap-2 border-b border-white/5 py-2 text-sm"
                  >
                    <div>
                      <p>{log.action}</p>
                      <p className="break-all text-xs text-[#A0A6B5]">
                        {log.details}
                      </p>
                    </div>
                    <time className="text-xs text-[#A0A6B5]">
                      {new Date(log.createdAt).toLocaleString()}
                    </time>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[#A0A6B5]">No activity recorded.</p>
              )}
            </BotPanel>
          )}
        </div>
      </div>
      <TokenDialog token={secret} onClose={() => setSecret("")} />
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke bot token?</DialogTitle>
            <DialogDescription>
              API access stops immediately. Generate a new token to reconnect
              the bot.
            </DialogDescription>
          </DialogHeader>
          <Button
            variant="destructive"
            disabled={task.busy}
            onClick={() =>
              void task.run(async () => {
                await rotate({ applicationId: app.id, tokenHash: null });
                setRevokeOpen(false);
              }, "Token revoked")
            }
          >
            Confirm revocation
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={rotateOpen} onOpenChange={setRotateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace bot token?</DialogTitle>
            <DialogDescription>
              The current token stops working immediately. Update your
              externally hosted bot with the new token.
            </DialogDescription>
          </DialogHeader>
          <Button
            disabled={task.busy}
            onClick={() =>
              void task.run(async () => {
                const credential = await generateBotCredential();
                await rotate({
                  applicationId: app.id,
                  tokenHash: credential.tokenHash,
                });
                setSecret(credential.token);
                setRotateOpen(false);
              })
            }
          >
            Replace token
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {app.name}?</DialogTitle>
            <DialogDescription>
              This revokes its token and removes it from every server. Type the
              application name to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Application name confirmation"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <Button
            variant="destructive"
            disabled={task.busy || confirmation !== app.name}
            onClick={() =>
              void task.run(async () => {
                await remove({ applicationId: app.id, confirmation });
                navigate("/dashboard/developers");
              }, "Application deleted")
            }
          >
            Delete application
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Commands({ app }: { app: App }) {
  const save = useMutation(api.botCommands.save);
  const remove = useMutation(api.botCommands.remove);
  const task = useBotTask();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [options, setOptions] = useState<BotCommand["options"]>([]);
  const [commandType, setCommandType] = useState<"slash" | "user" | "message">(
    "slash",
  );
  const [subcommands, setSubcommands] = useState("[]");
  return (
    <BotPanel
      title="Slash commands"
      description="Commands are namespaced as /bot_username:command. A server-specific command overrides the global command of the same name."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void task.run(async () => {
            await save({
              applicationId: app.id,
              command: {
                name,
                description,
                ...(scope ? { serverId: scope } : {}),
                permissions,
                options,
                type: commandType,
                subcommands: JSON.parse(subcommands),
              },
            });
            setName("");
            setDescription("");
            setOptions([]);
          }, "Command saved");
        }}
      >
        <Field label="Command type">
          <select
            className="w-full rounded border border-white/10 bg-[#111318] p-2"
            value={commandType}
            onChange={(e) =>
              setCommandType(e.target.value as typeof commandType)
            }
          >
            <option value="slash">Slash command</option>
            <option value="user">User context action</option>
            <option value="message">Message context action</option>
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Command name">
            <Input
              required
              pattern="[a-z][a-z0-9_-]{0,31}"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Description">
            <Input
              required
              maxLength={100}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Scope">
          <select
            className="w-full rounded-md border border-white/10 bg-[#111318] p-2"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="">Global — all installations</option>
            {app.installations.map((i) => (
              <option key={i.id} value={i.serverId}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        {options.map((option, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-2"
          >
            <Input
              aria-label={`Option ${index + 1} name`}
              placeholder="Option name"
              value={option.name}
              onChange={(e) =>
                setOptions(
                  options.map((o, i) =>
                    i === index ? { ...o, name: e.target.value } : o,
                  ),
                )
              }
            />
            <Input
              aria-label={`Option ${index + 1} description`}
              placeholder="Description"
              value={option.description}
              onChange={(e) =>
                setOptions(
                  options.map((o, i) =>
                    i === index ? { ...o, description: e.target.value } : o,
                  ),
                )
              }
            />
            <select
              aria-label={`Option ${index + 1} type`}
              className="rounded-md bg-[#111318] p-2 text-sm"
              value={option.type}
              onChange={(e) =>
                setOptions(
                  options.map((o, i) =>
                    i === index
                      ? {
                          ...o,
                          type: e.target
                            .value as BotCommand["options"][number]["type"],
                        }
                      : o,
                  ),
                )
              }
            >
              {[
                "string",
                "integer",
                "number",
                "boolean",
                "user",
                "channel",
                "role",
              ].map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={option.required}
                onChange={(e) =>
                  setOptions(
                    options.map((o, i) =>
                      i === index ? { ...o, required: e.target.checked } : o,
                    ),
                  )
                }
              />
              Required
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setOptions(options.filter((_, i) => i !== index))
                }
              >
                Remove
              </Button>
            </label>
            <Input
              className="sm:col-span-2"
              aria-label={`Option ${index + 1} choices`}
              placeholder="String choices, separated by commas (optional)"
              value={option.choices?.join(",") ?? ""}
              onChange={(e) =>
                setOptions(
                  options.map((o, i) =>
                    i === index
                      ? {
                          ...o,
                          choices: e.target.value
                            ? e.target.value.split(",").map((c) => c.trim())
                            : undefined,
                        }
                      : o,
                  ),
                )
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={options.length >= 10}
          onClick={() =>
            setOptions([
              ...options,
              { name: "", description: "", type: "string", required: false },
            ])
          }
        >
          <Plus className="mr-2 size-4" />
          Add argument
        </Button>
        <details>
          <summary className="cursor-pointer text-sm">
            Subcommands and groups
          </summary>
          <p className="my-2 text-xs text-[#A0A6B5]">
            Use a JSON array of name, description, optional group, and options.
            Keep root arguments empty when using subcommands.
          </p>
          <Textarea
            aria-label="Subcommands JSON"
            className="font-mono text-xs"
            value={subcommands}
            onChange={(e) => setSubcommands(e.target.value)}
          />
        </details>
        <details>
          <summary className="cursor-pointer text-sm">
            Required member permissions
          </summary>
          <div className="mt-3">
            <PermissionPicker value={permissions} onChange={setPermissions} />
          </div>
        </details>
        <Button type="submit" disabled={task.busy} className="ml-3">
          Save command
        </Button>
      </form>
      <div className="border-t border-white/10 pt-4">
        {app.commands.length ? (
          app.commands.map((command) => (
            <div
              key={command._id}
              className="flex items-center justify-between gap-3 border-b border-white/5 py-3"
            >
              <div>
                <p className="font-mono text-sm text-indigo-300">
                  /{app.username}:{command.name}
                </p>
                <p className="text-xs text-[#A0A6B5]">
                  {command.description} ·{" "}
                  {command.serverId ? "Server" : "Global"}
                </p>
              </div>
              <div className="flex">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setName(command.name);
                    setDescription(command.description);
                    setOptions(command.options);
                    setPermissions(command.permissions);
                    setScope(command.serverId ?? "");
                    setCommandType(command.type ?? "slash");
                    setSubcommands(
                      JSON.stringify(command.subcommands ?? [], null, 2),
                    );
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(
                      () =>
                        remove({
                          applicationId: app.id,
                          commandId: command._id,
                        }),
                      "Command removed",
                    )
                  }
                >
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#A0A6B5]">
            Register your first command here or through the SDK.
          </p>
        )}
      </div>
    </BotPanel>
  );
}
function Events({ app }: { app: App }) {
  const update = useMutation(api.botApplications.events);
  const retry = useMutation(api.botDelivery.retry);
  const task = useBotTask();
  const [events, setEvents] = useState(app.events);
  const [mode, setMode] = useState(app.deliveryMode);
  const [url, setUrl] = useState(app.webhookUrl);
  const [attempts, setAttempts] = useState(app.webhookMaxAttempts);
  const [retrySeconds, setRetrySeconds] = useState(app.webhookRetrySeconds);
  return (
    <BotPanel
      title="Webhooks & events"
      description="Events have stable IDs and retries. Make handlers idempotent and acknowledge only after successful processing."
    >
      <Field label="Delivery method">
        <select
          className="w-full rounded-md border border-white/10 bg-[#111318] p-2"
          value={mode}
          onChange={(e) => setMode(e.target.value as "poll" | "webhook")}
        >
          <option value="poll">SDK event polling</option>
          <option value="webhook">Signed HTTPS webhook</option>
        </select>
      </Field>
      {mode === "webhook" && (
        <>
          <Field label="Webhook URL">
            <Input
              type="url"
              placeholder="https://your-bot.example/events"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Maximum delivery attempts">
              <Input
                type="number"
                min={1}
                max={6}
                value={attempts}
                onChange={(e) => setAttempts(Number(e.target.value))}
              />
            </Field>
            <Field label="Retry base (seconds)">
              <Input
                type="number"
                min={10}
                max={3600}
                value={retrySeconds}
                onChange={(e) => setRetrySeconds(Number(e.target.value))}
              />
            </Field>
          </div>
          <p className="text-xs text-[#A0A6B5]">
            Verify Ed25519 signatures with the public key at
            /api/bots/v1/webhook-key. Delivery requires the platform signing key
            to be configured. Private-network addresses and redirects are
            rejected.
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        {BOT_EVENTS.map((event) => (
          <label
            key={event}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              disabled={event === "interactionCreate"}
              checked={event === "interactionCreate" || events.includes(event)}
              onChange={(e) =>
                setEvents(
                  e.target.checked
                    ? [...events, event]
                    : events.filter((v) => v !== event),
                )
              }
            />
            {event}
          </label>
        ))}
      </div>
      <Button
        disabled={task.busy}
        onClick={() =>
          void task.run(
            () =>
              update({
                applicationId: app.id,
                events,
                deliveryMode: mode,
                webhookUrl: url,
                webhookMaxAttempts: attempts,
                webhookRetrySeconds: retrySeconds,
              }),
            "Event delivery saved",
          )
        }
      >
        Save event settings
      </Button>
      <div className="border-t border-white/10 pt-4">
        <h3 className="mb-3 text-sm font-semibold">Recent delivery logs</h3>
        {app.deliveries.length ? (
          app.deliveries.map((event) => (
            <div
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-3 text-sm"
            >
              <div>
                <p>
                  {event.type}{" "}
                  <span className="ml-2 text-xs text-[#A0A6B5]">
                    {event.status} · {event.attempts} attempts
                  </span>
                </p>
                <p className="text-xs text-red-300">{event.lastError}</p>
              </div>
              {event.status === "dead" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={task.busy}
                  onClick={() =>
                    void task.run(
                      () => retry({ applicationId: app.id, eventId: event.id }),
                      "Delivery queued",
                    )
                  }
                >
                  Retry
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-[#A0A6B5]">
            Subscribed events will appear here after your bot is installed.
          </p>
        )}
      </div>
    </BotPanel>
  );
}

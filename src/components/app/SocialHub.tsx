import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { useSearchParams } from "react-router";
import { motion } from "framer-motion";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "./UserAvatar";
import { StyledDisplayName } from "./StyledDisplayName";
import { EmptyState, LoadingRows, ConfirmDelete } from "./AdvancedShared";
import { renderMessage } from "@/lib/markdown";
import { displayInstant } from "@/lib/zonedTime";
import { useNow } from "@/hooks/use-now";
import { toast } from "sonner";

import { FollowUserButton } from "./ProfileActivities";
import { Portfolio, SocialCollections, SaveSocialPost } from "./SocialGallery";

type Privacy = "public" | "followers" | "friends" | "private";
export function SocialHub() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("section") ?? "posts";
  const author = params.get("author");
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-y-auto p-4 sm:p-8"
    >
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Around Kyro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share an update, follow creators and find people with interests you
            choose.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Social sections"
          className="flex flex-wrap gap-2"
        >
          {[
            ["posts", "Posts"],
            ["stories", "Stories"],
            ["following", "Following"],
            ["interests", "Interests"],
            ["portfolio", "Portfolio"],
            ["collections", "Collections"],
          ].map(([id, label]) => (
            <Button
              role="tab"
              aria-selected={tab === id}
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              onClick={() => {
                setParams((old) => {
                  const next = new URLSearchParams(old);
                  next.set("section", id);
                  next.delete("collection");
                  return next;
                });
              }}
            >
              {label}
            </Button>
          ))}
        </div>
        {author && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.delete("author");
                return next;
              })
            }
          >
            Show everyone's posts
          </Button>
        )}
        <div role="tabpanel">
          {tab === "portfolio" ? (
            <Portfolio authorId={author} />
          ) : tab === "collections" ? (
            <SocialCollections authorId={author} />
          ) : tab === "following" ? (
            <Following />
          ) : tab === "interests" ? (
            <Interests />
          ) : (
            <PostFeed
              key={`${tab}:${author}`}
              kind={tab === "stories" ? "story" : "post"}
              authorId={author}
            />
          )}
        </div>
      </div>
    </motion.main>
  );
}
function PostFeed({
  kind,
  authorId,
}: {
  kind: "post" | "story";
  authorId: string | null;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.socialFeed.feed,
    { kind, authorId: authorId ? (authorId as Id<"users">) : undefined },
    { initialNumItems: 25 },
  );
  const privacy = useMutation(api.socialFeed.setPrivacy);
  const remove = useMutation(api.socialFeed.remove);
  const [busy, setBusy] = useState(false);
  const now = useNow(1000);
  return (
    <div className="space-y-5">
      {!authorId && <ComposePost kind={kind} />}
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>
          {kind === "story"
            ? "No visible stories in this page. Stories disappear after their chosen lifetime."
            : "No posts in this page yet. Share something with your community."}
        </EmptyState>
      ) : (
        <div className="divide-y">
          {results
            .filter((row) => !row.expiresAt || row.expiresAt > now)
            .map((post) => (
              <article key={post._id} className="space-y-3 py-5">
                <div className="flex items-center gap-3">
                  {post.author && <UserAvatar user={post.author} size="sm" />}
                  <div className="min-w-0 flex-1">
                    <StyledDisplayName
                      user={post.author ?? { name: "Kyro member" }}
                      className="truncate text-sm font-semibold"
                    />
                    <p className="text-xs text-muted-foreground">
                      {displayInstant(post.createdAt)} · {post.privacy}
                      {post.expiresAt &&
                        ` · expires ${displayInstant(post.expiresAt)}`}
                    </p>
                  </div>
                  {!post.mine && <FollowUserButton userId={post.authorId} />}
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {renderMessage(post.content)}
                </div>
                <SaveSocialPost postId={post._id} />
                {post.mine && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Privacy of ${post.content.slice(0, 30)}`}
                      disabled={busy}
                      value={post.privacy}
                      className="h-8 rounded-md border bg-background px-2 text-xs"
                      onChange={async (e) => {
                        setBusy(true);
                        try {
                          await privacy({
                            id: post._id,
                            privacy: e.target.value as Privacy,
                          });
                        } catch (error) {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not update privacy.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <option value="public">Public</option>
                      <option value="followers">Followers</option>
                      <option value="friends">Friends</option>
                      <option value="private">Only me</option>
                    </select>
                    <ConfirmDelete
                      title="Delete this post?"
                      description="This removes the post from all Kyro feeds."
                      onConfirm={() => remove({ id: post._id })}
                    />
                  </div>
                )}
              </article>
            ))}
        </div>
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(25)}>
          Continue through the feed
        </Button>
      )}
    </div>
  );
}
function ComposePost({ kind }: { kind: "post" | "story" }) {
  const publish = useMutation(api.socialFeed.publish);
  const [content, setContent] = useState("");
  const [privacy, setPrivacy] = useState<Privacy>("friends");
  const [expiry, setExpiry] = useState("86400");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <Textarea
        aria-label={kind === "story" ? "New story" : "New public post"}
        value={content}
        maxLength={4000}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          kind === "story"
            ? "A moment to share…"
            : "What are you working on or looking forward to?"
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Post privacy"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={privacy}
          onChange={(e) => setPrivacy(e.target.value as Privacy)}
        >
          <option value="public">Public</option>
          <option value="followers">Followers</option>
          <option value="friends">Friends</option>
          <option value="private">Only me</option>
        </select>
        {kind === "story" && (
          <select
            aria-label="Story lifetime"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            <option value="3600">1 hour</option>
            <option value="86400">24 hours</option>
            <option value="259200">3 days</option>
            <option value="604800">7 days</option>
          </select>
        )}
        <Button
          className="ml-auto"
          disabled={busy || !content.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await publish({
                content,
                privacy,
                kind,
                lifetimeSeconds: kind === "story" ? Number(expiry) : undefined,
              });
              setContent("");
              toast.success(
                kind === "story" ? "Story shared." : "Post shared.",
              );
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Could not publish.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Share {kind}
        </Button>
      </div>
    </div>
  );
}
function Following() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.socialFeed.followList,
    {},
    { initialNumItems: 25 },
  );
  const [, setParams] = useSearchParams();
  return (
    <div>
      {status === "LoadingFirstPage" ? (
        <LoadingRows />
      ) : results.length === 0 ? (
        <EmptyState>
          Follow a profile to keep it here. Following is separate from
          friendship.
        </EmptyState>
      ) : (
        results.map((user) => (
          <div key={user.id} className="flex items-center gap-3 border-b py-4">
            <UserAvatar user={user} size="sm" />
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.set("previewUser", user.id);
                  return next;
                })
              }
            >
              <StyledDisplayName
                user={user}
                className="truncate font-semibold"
              />
              <span className="text-xs text-muted-foreground">
                @{user.username}
              </span>
            </button>
            <FollowUserButton userId={user.id} />
          </div>
        ))
      )}
      {status === "CanLoadMore" && (
        <Button variant="outline" onClick={() => loadMore(25)}>
          More profiles
        </Button>
      )}
    </div>
  );
}
function Interests() {
  const profile = useQuery(api.socialFeed.interests, {});
  const recommendations = useQuery(api.socialFeed.discover, {});
  const save = useMutation(api.socialFeed.saveInterests);
  const [draft, setDraft] = useState<{
    value: string;
    discoverable: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  if (profile === undefined) return <LoadingRows />;
  const value = draft ?? {
    value: profile?.interests.join(", ") ?? "",
    discoverable: profile?.discoverable ?? false,
  };
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Suggestions use matching interests you explicitly select. Your
        conversations and browsing history are not used.
      </p>
      <Label className="block space-y-2">
        <span>Your interests (up to 12, separated by commas)</span>
        <Input
          aria-label="Selected interests"
          value={value.value}
          onChange={(e) => setDraft({ ...value, value: e.target.value })}
          placeholder="minecraft, music, design…"
        />
      </Label>
      <Label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.discoverable}
          onChange={(e) =>
            setDraft({ ...value, discoverable: e.target.checked })
          }
        />
        Let others find me through these interests
      </Label>
      <Button
        disabled={busy || !draft}
        onClick={async () => {
          setBusy(true);
          try {
            await save({
              interests: value.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              discoverable: value.discoverable,
            });
            setDraft(null);
            toast.success("Interests saved.");
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not save interests.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Save interests
      </Button>
      <h2 className="font-semibold">People with shared interests</h2>
      {recommendations === undefined ? (
        <LoadingRows />
      ) : recommendations.length === 0 ? (
        <EmptyState>
          No matches yet. Save some interests and check back as more people opt
          in.
        </EmptyState>
      ) : (
        recommendations.map(
          (row) =>
            row.user && (
              <div
                key={row.user.id}
                className="flex items-center gap-3 border-b py-3"
              >
                <UserAvatar user={row.user} size="sm" />
                <div className="min-w-0 flex-1">
                  <StyledDisplayName
                    user={row.user}
                    className="truncate font-semibold"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shared: {row.sharedInterests.join(", ")}
                  </p>
                </div>
                <FollowUserButton userId={row.user.id} />
              </div>
            ),
        )
      )}
    </div>
  );
}

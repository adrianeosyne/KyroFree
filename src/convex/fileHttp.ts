import { httpAction } from "./functions";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { validFileSignature } from "./fileAccess";
export const downloadFile = httpAction(async (ctx, request) => {
  const q = new URL(request.url).searchParams;
  const id = q.get("id") ?? "",
    viewer = q.get("viewer") ?? "",
    message = q.get("message") ?? "";
  const deny = () =>
    new Response("Attachment unavailable or link expired.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  if (
    !validFileSignature(
      id,
      viewer,
      message,
      Number(q.get("expires")),
      q.get("signature") ?? "",
    )
  )
    return deny();
  try {
    const target = await ctx.runQuery(internal.files.downloadTarget, {
      storageId: id as Id<"_storage">,
      viewerId: viewer as Id<"users">,
      ...(message ? { messageId: message as Id<"messages"> } : {}),
    });
    if (!target.url) return deny();
    const response = await fetch(target.url, {
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return deny();
    const inline = /^(image\/(png|jpeg|gif|webp)|audio\/|video\/)/.test(
      target.mimeType,
    );
    return new Response(response.body, {
      headers: {
        "Content-Type": target.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(target.name)}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return deny();
  }
});

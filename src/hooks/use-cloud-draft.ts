import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUiStore } from "@/lib/store";

type Scope = { containerType: "channel" | "conversation"; containerId: string };
type Local = {
  content: string;
  base: string;
  revision: number;
  dirty: boolean;
};
function read(key: string): Local | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return value &&
      typeof value.content === "string" &&
      typeof value.base === "string" &&
      Number.isSafeInteger(value.revision) &&
      typeof value.dirty === "boolean"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function useCloudDraft(scope: Scope, userId?: string) {
  const { containerType, containerId } = scope;
  const key = `kyro.cloudDraft:${userId ?? "pending"}:${scope.containerType}:${scope.containerId}`;
  const content = useUiStore((state) => state.drafts[key] ?? "");
  const setDraft = useUiStore((state) => state.setDraft);
  const remote = useQuery(
    api.advancedMessages.privateState,
    userId ? scope : "skip",
  );
  const save = useMutation(api.advancedMessages.savePrivate);
  const state = useRef<{ key: string; value: Local }>({
    key,
    value: read(key) ?? { content: "", base: "", revision: 0, dirty: false },
  });
  const inFlight = useRef(false);
  const [syncTick, setSyncTick] = useState(0);
  const [status, setStatus] = useState<
    "loading" | "saved" | "offline" | "saving" | "conflict" | "error"
  >("loading");
  const [online, setOnline] = useState(navigator.onLine);
  const persist = useCallback(
    (value: Local) => {
      state.current = { key, value };
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* Cloud saving still works if storage is unavailable. */
      }
    },
    [key],
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    const local = read(key) ?? {
      content: "",
      base: "",
      revision: 0,
      dirty: false,
    };
    state.current = { key, value: local };
    setDraft(key, local.content);
    const timer = window.setTimeout(
      () => setStatus(navigator.onLine ? "loading" : "offline"),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [key, setDraft]);
  useEffect(() => {
    if (!remote || state.current.key !== key || inFlight.current) return;
    const local = state.current.value;
    const draft = remote.draft;
    const serverContent = draft?.content ?? "";
    const serverRevision = draft?.revision ?? 0;
    // Reactive results may arrive before the mutation promise settles. Do not
    // replace a just-saved draft with an older query snapshot.
    if (serverRevision < local.revision) return;
    if (
      status === "error" &&
      local.dirty &&
      local.base === serverContent &&
      local.revision === serverRevision
    )
      return;
    if (
      local.dirty &&
      local.base !== serverContent &&
      local.content !== serverContent
    ) {
      setStatus("conflict");
      return;
    }
    if (!local.dirty || local.content === serverContent) {
      persist({
        content: serverContent,
        base: serverContent,
        revision: serverRevision,
        dirty: false,
      });
      setDraft(key, serverContent);
      setStatus("saved");
    } else {
      persist({ ...local, base: serverContent, revision: serverRevision });
      setStatus(online ? "saving" : "offline");
    }
  }, [remote, key, persist, setDraft, online, syncTick, status]);
  useEffect(() => {
    if (
      !remote ||
      !userId ||
      !online ||
      status === "conflict" ||
      status === "error" ||
      !state.current.value.dirty
    )
      return;
    const timer = window.setTimeout(async () => {
      if (inFlight.current || state.current.key !== key) return;
      const snapshot = { ...state.current.value };
      inFlight.current = true;
      setStatus("saving");
      try {
        const nextRevision = await save({
          containerType,
          containerId,
          kind: "draft",
          content: snapshot.content,
          expectedRevision: snapshot.revision,
        });
        if (state.current.key !== key) return;
        const current = state.current.value;
        persist({
          ...current,
          revision: nextRevision,
          base: snapshot.content,
          dirty: current.content !== snapshot.content,
        });
        setStatus(current.content === snapshot.content ? "saved" : "saving");
      } catch {
        if (state.current.key === key)
          setStatus(navigator.onLine ? "error" : "offline");
      } finally {
        inFlight.current = false;
        setSyncTick((value) => value + 1);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    content,
    key,
    remote,
    online,
    status,
    userId,
    persist,
    save,
    containerId,
    containerType,
    syncTick,
  ]);
  const setContent = (value: string) => {
    const local = state.current.value;
    persist({ ...local, content: value, dirty: true });
    setDraft(key, value);
    if (status !== "conflict") setStatus(online ? "saving" : "offline");
  };
  const resolve = (keepLocal: boolean) => {
    if (!remote) return;
    const serverContent = remote.draft?.content ?? "";
    const value = keepLocal ? state.current.value.content : serverContent;
    persist({
      content: value,
      base: serverContent,
      revision: remote.draft?.revision ?? 0,
      dirty: keepLocal && value !== serverContent,
    });
    setDraft(key, value);
    setStatus(keepLocal ? "saving" : "saved");
  };
  return { content, setContent, status, resolve };
}

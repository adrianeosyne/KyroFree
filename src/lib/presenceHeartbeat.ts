/** Renew promptly after resuming; regular ticks retain the server's write throttle. */
export function startPresenceHeartbeat(heartbeat: () => Promise<unknown>) {
  let stopped = false;
  let inFlight = false;
  let lastSent = -Infinity;
  const tick = (force = false) => {
    if (stopped || inFlight || Date.now() - lastSent < (force ? 5_000 : 30_000))
      return;
    inFlight = true;
    lastSent = Date.now();
    void heartbeat()
      .catch(() => {
        lastSent = -Infinity;
      })
      .finally(() => {
        inFlight = false;
      });
  };
  const resume = () => tick(true);
  const visible = () => {
    if (document.visibilityState === "visible") resume();
  };
  tick();
  const timer = window.setInterval(() => tick(), 30_000);
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("focus", resume);
  window.addEventListener("online", resume);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", visible);
    window.removeEventListener("focus", resume);
    window.removeEventListener("online", resume);
  };
}

export function detectPresenceDevice(): "desktop" | "mobile" | "tablet" {
  const ua = navigator.userAgent;
  if (
    /iPad|Tablet|PlayBook|Silk/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua))
  )
    return "tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone|webOS|BlackBerry/i.test(ua))
    return "mobile";
  return "desktop";
}

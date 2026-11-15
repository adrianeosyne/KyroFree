import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const subscribe = (listener: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => true;

/** Update uploaded artwork immediately when the device motion preference changes. */
export function useSystemReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

import { useUiStore } from "./store";

/** Shared by calls, voice messages and the settings microphone test. */
export function audioCapturePreferences(): MediaTrackConstraints {
  const { noiseSuppression, autoGainControl } = useUiStore.getState();
  return { echoCancellation: true, noiseSuppression, autoGainControl };
}

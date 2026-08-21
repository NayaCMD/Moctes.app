import { useSyncExternalStore } from "react";

const subscribers = new Set<() => void>();
let listening = false;

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("online", notify);
    window.addEventListener("offline", notify);
    listening = true;
  }
  return () => {
    subscribers.delete(callback);
    if (listening && subscribers.size === 0) {
      window.removeEventListener("online", notify);
      window.removeEventListener("offline", notify);
      listening = false;
    }
  };
}

function notify(): void {
  subscribers.forEach((callback) => callback());
}

function getSnapshot(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

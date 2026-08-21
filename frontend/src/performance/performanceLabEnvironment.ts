import type { StateStorage } from "zustand/middleware";

const PERFORMANCE_LAB_QUERY = "performance-lab";
const memoryEntries = new Map<string, string>();

const memoryStorage: StateStorage = {
  getItem: (name) => memoryEntries.get(name) ?? null,
  setItem: (name, value) => {
    memoryEntries.set(name, value);
  },
  removeItem: (name) => {
    memoryEntries.delete(name);
  },
};

export function isPerformanceLabRoute(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get(PERFORMANCE_LAB_QUERY) === "1"
  );
}

export function getDocumentStoreStorage(): StateStorage {
  if (isPerformanceLabRoute() || typeof localStorage === "undefined") {
    return memoryStorage;
  }
  return localStorage;
}

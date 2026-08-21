import type { MoctesDocument } from "../types/document.types";

export const HISTORY_LIMIT = 50;

export type HistoryPathSegment = string | number | { id: string };

export type HistoryPatch =
  | { op: "set"; path: HistoryPathSegment[]; value: unknown }
  | { op: "delete"; path: HistoryPathSegment[] }
  | {
      op: "insert-entity";
      path: HistoryPathSegment[];
      index: number;
      value: { id: string };
    }
  | { op: "remove-entity"; path: HistoryPathSegment[]; id: string }
  | { op: "reorder-entities"; path: HistoryPathSegment[]; ids: string[] };

export interface HistoryEntry {
  id: string;
  label: string;
  patches: HistoryPatch[];
  inversePatches: HistoryPatch[];
  createdAt: string;
}

export function createHistoryEntry(
  before: MoctesDocument[],
  after: MoctesDocument[],
  label: string,
): HistoryEntry | null {
  const patches = createPatches(before, after);
  if (patches.length === 0) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    label,
    patches,
    inversePatches: createPatches(after, before),
    createdAt: new Date().toISOString(),
  };
}

export function pushHistoryEntry(
  stack: HistoryEntry[],
  entry: HistoryEntry,
): HistoryEntry[] {
  return [...stack, entry].slice(-HISTORY_LIMIT);
}

export function applyHistoryPatches(
  documents: MoctesDocument[],
  patches: HistoryPatch[],
): MoctesDocument[] {
  return patches.reduce<MoctesDocument[]>((current, patch) => {
    switch (patch.op) {
      case "set":
        return updateAtPath(current, patch.path, () => cloneValue(patch.value)) as MoctesDocument[];
      case "delete":
        return deleteAtPath(current, patch.path) as MoctesDocument[];
      case "insert-entity":
        return updateAtPath(current, patch.path, (value) => {
          if (!Array.isArray(value)) {
            return value;
          }
          const next = [...value];
          next.splice(Math.min(Math.max(patch.index, 0), next.length), 0, cloneValue(patch.value));
          return next;
        }) as MoctesDocument[];
      case "remove-entity":
        return updateAtPath(current, patch.path, (value) =>
          Array.isArray(value)
            ? value.filter((item) => !isEntity(item) || item.id !== patch.id)
            : value,
        ) as MoctesDocument[];
      case "reorder-entities":
        return updateAtPath(current, patch.path, (value) => {
          if (!Array.isArray(value)) {
            return value;
          }
          const byId = new Map(
            value.filter(isEntity).map((item) => [item.id, item]),
          );
          const ordered = patch.ids.flatMap((id) => {
            const item = byId.get(id);
            return item ? [item] : [];
          });
          const unlisted = value.filter(
            (item) => !isEntity(item) || !patch.ids.includes(item.id),
          );
          return [...ordered, ...unlisted];
        }) as MoctesDocument[];
    }
  }, documents);
}

export function createPatches(before: unknown, after: unknown): HistoryPatch[] {
  const patches: HistoryPatch[] = [];
  diffValue(before, after, [], patches);
  return patches;
}

function diffValue(
  before: unknown,
  after: unknown,
  path: HistoryPathSegment[],
  patches: HistoryPatch[],
): void {
  if (Object.is(before, after)) {
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (isEntityArrayPair(before, after)) {
      diffEntityArray(before, after, path, patches);
      return;
    }
    if (!valuesEqual(before, after)) {
      patches.push({ op: "set", path, value: cloneValue(after) });
    }
    return;
  }

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const hasBefore = Object.hasOwn(before, key);
      const hasAfter = Object.hasOwn(after, key);
      const nextPath = [...path, key];
      if (!hasAfter) {
        patches.push({ op: "delete", path: nextPath });
      } else if (!hasBefore) {
        patches.push({ op: "set", path: nextPath, value: cloneValue(after[key]) });
      } else {
        diffValue(before[key], after[key], nextPath, patches);
      }
    }
    return;
  }

  patches.push({ op: "set", path, value: cloneValue(after) });
}

function diffEntityArray(
  before: Array<{ id: string }>,
  after: Array<{ id: string }>,
  path: HistoryPathSegment[],
  patches: HistoryPatch[],
): void {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));

  for (const item of before) {
    if (!afterById.has(item.id)) {
      patches.push({ op: "remove-entity", path, id: item.id });
    }
  }

  after.forEach((item, index) => {
    if (!beforeById.has(item.id)) {
      patches.push({
        op: "insert-entity",
        path,
        index,
        value: cloneValue(item),
      });
    }
  });

  for (const item of after) {
    const previous = beforeById.get(item.id);
    if (previous) {
      diffValue(previous, item, [...path, { id: item.id }], patches);
    }
  }

  const beforeIds = before.map((item) => item.id);
  const afterIds = after.map((item) => item.id);
  if (!valuesEqual(beforeIds, afterIds)) {
    patches.push({ op: "reorder-entities", path, ids: afterIds });
  }
}

function updateAtPath(
  value: unknown,
  path: HistoryPathSegment[],
  update: (current: unknown) => unknown,
): unknown {
  if (path.length === 0) {
    return update(value);
  }

  const [segment, ...rest] = path;
  if (Array.isArray(value)) {
    const index = typeof segment === "number"
      ? segment
      : typeof segment === "object"
        ? value.findIndex((item) => isEntity(item) && item.id === segment.id)
        : Number.NaN;
    if (!Number.isInteger(index) || index < 0 || index >= value.length) {
      return value;
    }
    const next = [...value];
    next[index] = updateAtPath(value[index], rest, update);
    return next;
  }

  if (isRecord(value) && typeof segment === "string") {
    return {
      ...value,
      [segment]: updateAtPath(value[segment], rest, update),
    };
  }

  return value;
}

function deleteAtPath(value: unknown, path: HistoryPathSegment[]): unknown {
  if (path.length === 0) {
    return undefined;
  }

  const parentPath = path.slice(0, -1);
  const property = path.at(-1);
  return updateAtPath(value, parentPath, (parent) => {
    if (Array.isArray(parent) && typeof property === "number") {
      return parent.filter((_, index) => index !== property);
    }
    if (isRecord(parent) && typeof property === "string") {
      const next = { ...parent };
      delete next[property];
      return next;
    }
    return parent;
  });
}

function isEntityArrayPair(
  before: unknown[],
  after: unknown[],
): before is Array<{ id: string }> {
  const combined = [...before, ...after];
  return combined.length > 0 && combined.every(isEntity);
}

function isEntity(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function cloneValue<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

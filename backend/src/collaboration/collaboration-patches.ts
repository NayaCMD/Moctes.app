import { BadRequestException } from '@nestjs/common';
import type {
  CollaborationPatch,
  CollaborationPathSegment,
} from './collaboration.types';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_PATCHES = 100;
const MAX_PATH_DEPTH = 12;
const MAX_PATCH_BYTES = 256 * 1024;

export function validateCollaborationPatches(
  value: unknown,
): CollaborationPatch[] {
  if (
    !isUnknownArray(value) ||
    value.length === 0 ||
    value.length > MAX_PATCHES
  ) {
    throw new BadRequestException(
      `Collaboration operations require 1-${MAX_PATCHES} patches.`,
    );
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_PATCH_BYTES) {
    throw new BadRequestException('Collaboration operation is too large.');
  }
  for (const patch of value) {
    validatePatch(patch);
  }
  return value as CollaborationPatch[];
}

export function applyCollaborationPatches(
  document: unknown,
  patches: CollaborationPatch[],
): unknown {
  return patches.reduce((current, patch) => {
    switch (patch.op) {
      case 'set':
        return updateAtPath(current, patch.path, () => clone(patch.value));
      case 'delete':
        return deleteAtPath(current, patch.path);
      case 'insert-entity':
        return updateAtPath(current, patch.path, (value) => {
          if (!isUnknownArray(value)) return value;
          if (
            value.some((item) => isEntity(item) && item.id === patch.value.id)
          ) {
            return value;
          }
          const next = [...value];
          next.splice(
            Math.min(Math.max(patch.index, 0), next.length),
            0,
            clone(patch.value),
          );
          return next;
        });
      case 'remove-entity':
        return updateAtPath(current, patch.path, (value) =>
          isUnknownArray(value)
            ? value.filter((item) => !isEntity(item) || item.id !== patch.id)
            : value,
        );
      case 'reorder-entities':
        return updateAtPath(current, patch.path, (value) => {
          if (!isUnknownArray(value)) return value;
          const entities = value.filter(isEntity);
          const byId = new Map(entities.map((item) => [item.id, item]));
          const ordered = patch.ids.flatMap((id) => {
            const item = byId.get(id);
            return item ? [item] : [];
          });
          return [
            ...ordered,
            ...value.filter(
              (item) => !isEntity(item) || !patch.ids.includes(item.id),
            ),
          ];
        });
    }
  }, document);
}

export function collaborationPatchesConflict(
  incoming: CollaborationPatch[],
  applied: CollaborationPatch[],
): boolean {
  return incoming.some((first) =>
    applied.some((second) => patchesConflict(first, second)),
  );
}

function patchesConflict(
  first: CollaborationPatch,
  second: CollaborationPatch,
): boolean {
  if (
    first.op === 'insert-entity' &&
    second.op === 'insert-entity' &&
    pathsEqual(first.path, second.path)
  ) {
    return first.value.id === second.value.id;
  }
  const firstPath = affectedPath(first);
  const secondPath = affectedPath(second);
  return (
    pathIsPrefix(firstPath, secondPath) || pathIsPrefix(secondPath, firstPath)
  );
}

function affectedPath(patch: CollaborationPatch): CollaborationPathSegment[] {
  if (patch.op === 'remove-entity') return [...patch.path, { id: patch.id }];
  if (patch.op === 'insert-entity') {
    return [...patch.path, { id: patch.value.id }];
  }
  return patch.path;
}

function pathIsPrefix(
  prefix: CollaborationPathSegment[],
  value: CollaborationPathSegment[],
): boolean {
  return (
    prefix.length <= value.length &&
    prefix.every((segment, index) => pathSegmentsEqual(segment, value[index]))
  );
}

function pathsEqual(
  first: CollaborationPathSegment[],
  second: CollaborationPathSegment[],
): boolean {
  return (
    first.length === second.length &&
    first.every((segment, index) => pathSegmentsEqual(segment, second[index]))
  );
}

function pathSegmentsEqual(
  first: CollaborationPathSegment,
  second: CollaborationPathSegment,
): boolean {
  if (typeof first !== 'object' || typeof second !== 'object') {
    return first === second;
  }
  return first.id === second.id;
}

function validatePatch(value: unknown): void {
  if (!isRecord(value) || typeof value.op !== 'string') {
    throw new BadRequestException('Invalid collaboration patch.');
  }
  if (!isUnknownArray(value.path) || value.path.length > MAX_PATH_DEPTH) {
    throw new BadRequestException('Invalid collaboration patch path.');
  }
  value.path.forEach(validatePathSegment);
  switch (value.op) {
    case 'set':
      if (!Object.hasOwn(value, 'value'))
        throw new BadRequestException('Set patch requires a value.');
      return;
    case 'delete':
      return;
    case 'insert-entity':
      if (!Number.isInteger(value.index) || !isEntity(value.value)) {
        throw new BadRequestException('Invalid entity insertion patch.');
      }
      return;
    case 'remove-entity':
      if (typeof value.id !== 'string' || !value.id) {
        throw new BadRequestException('Invalid entity removal patch.');
      }
      return;
    case 'reorder-entities':
      if (
        !isUnknownArray(value.ids) ||
        !value.ids.every((id) => typeof id === 'string')
      ) {
        throw new BadRequestException('Invalid entity reorder patch.');
      }
      return;
    default:
      throw new BadRequestException(
        'Unsupported collaboration patch operation.',
      );
  }
}

function validatePathSegment(segment: unknown): void {
  if (typeof segment === 'number' && Number.isInteger(segment) && segment >= 0)
    return;
  if (typeof segment === 'string' && segment && !FORBIDDEN_KEYS.has(segment))
    return;
  if (
    isRecord(segment) &&
    Object.keys(segment).length === 1 &&
    typeof segment.id === 'string' &&
    segment.id
  )
    return;
  throw new BadRequestException('Invalid collaboration path segment.');
}

function updateAtPath(
  value: unknown,
  path: CollaborationPathSegment[],
  update: (current: unknown) => unknown,
): unknown {
  if (path.length === 0) return update(value);
  const [segment, ...rest] = path;
  if (isUnknownArray(value)) {
    const index =
      typeof segment === 'number'
        ? segment
        : typeof segment === 'object'
          ? value.findIndex((item) => isEntity(item) && item.id === segment.id)
          : -1;
    if (index < 0 || index >= value.length) return value;
    const next = [...value];
    next[index] = updateAtPath(value[index], rest, update);
    return next;
  }
  if (isRecord(value) && typeof segment === 'string') {
    return { ...value, [segment]: updateAtPath(value[segment], rest, update) };
  }
  return value;
}

function deleteAtPath(
  value: unknown,
  path: CollaborationPathSegment[],
): unknown {
  if (path.length === 0) return value;
  const property = path.at(-1);
  return updateAtPath(value, path.slice(0, -1), (parent) => {
    if (isUnknownArray(parent) && typeof property === 'number') {
      return parent.filter((_, index) => index !== property);
    }
    if (isRecord(parent) && typeof property === 'string') {
      const next = { ...parent };
      delete next[property];
      return next;
    }
    return parent;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isUnknownArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isEntity(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0;
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}

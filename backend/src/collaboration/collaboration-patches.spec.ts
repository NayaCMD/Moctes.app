import { BadRequestException } from '@nestjs/common';
import {
  applyCollaborationPatches,
  collaborationPatchesConflict,
  validateCollaborationPatches,
} from './collaboration-patches';
import type { CollaborationPatch } from './collaboration.types';

describe('collaboration patches', () => {
  const document = {
    id: 'document-1',
    title: 'Before',
    pages: [
      {
        id: 'page-1',
        elements: [
          { id: 'element-1', x: 10, y: 20 },
          { id: 'element-2', x: 30, y: 40 },
        ],
      },
    ],
  };

  it('merges operations on independent entity paths', () => {
    const first: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-1' }, 'x'],
      value: 25,
    };
    const second: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-2' }, 'y'],
      value: 55,
    };

    const result = applyCollaborationPatches(document, [first, second]);

    expect(result).toMatchObject({
      pages: [
        {
          elements: [
            { id: 'element-1', x: 25, y: 20 },
            { id: 'element-2', x: 30, y: 55 },
          ],
        },
      ],
    });
  });

  it('makes entity insertion and removal idempotent', () => {
    const insertion: CollaborationPatch = {
      op: 'insert-entity',
      path: ['pages', { id: 'page-1' }, 'elements'],
      index: 1,
      value: { id: 'element-3', x: 50 },
    };
    const withDuplicate = applyCollaborationPatches(document, [
      insertion,
      insertion,
    ]);
    const removedTwice = applyCollaborationPatches(withDuplicate, [
      {
        op: 'remove-entity',
        path: ['pages', { id: 'page-1' }, 'elements'],
        id: 'element-1',
      },
      {
        op: 'remove-entity',
        path: ['pages', { id: 'page-1' }, 'elements'],
        id: 'element-1',
      },
    ]);

    expect(removedTwice).toMatchObject({
      pages: [
        {
          elements: [{ id: 'element-3' }, { id: 'element-2' }],
        },
      ],
    });
  });

  it('allows independent edits while detecting overlapping stale edits', () => {
    const firstElementX: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-1' }, 'x'],
      value: 25,
    };
    const firstElementY: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-1' }, 'y'],
      value: 45,
    };
    const secondElementX: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-2' }, 'x'],
      value: 55,
    };

    expect(collaborationPatchesConflict([firstElementX], [firstElementY])).toBe(
      false,
    );
    expect(
      collaborationPatchesConflict([firstElementX], [secondElementX]),
    ).toBe(false);
    expect(collaborationPatchesConflict([firstElementX], [firstElementX])).toBe(
      true,
    );
    expect(
      collaborationPatchesConflict(
        [firstElementX],
        [
          {
            op: 'remove-entity',
            path: ['pages', { id: 'page-1' }, 'elements'],
            id: 'element-1',
          },
        ],
      ),
    ).toBe(true);
  });

  it('commutes inserts and edits that target different entity ids', () => {
    const insertion: CollaborationPatch = {
      op: 'insert-entity',
      path: ['pages', { id: 'page-1' }, 'elements'],
      index: 1,
      value: { id: 'element-3', x: 50 },
    };
    const editExisting: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-1' }, 'x'],
      value: 25,
    };
    const editInserted: CollaborationPatch = {
      op: 'set',
      path: ['pages', { id: 'page-1' }, 'elements', { id: 'element-3' }, 'x'],
      value: 75,
    };

    expect(collaborationPatchesConflict([insertion], [editExisting])).toBe(
      false,
    );
    expect(collaborationPatchesConflict([insertion], [editInserted])).toBe(
      true,
    );
  });

  it('rejects prototype paths and oversized batches', () => {
    expect(() =>
      validateCollaborationPatches([
        { op: 'set', path: ['__proto__', 'polluted'], value: true },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateCollaborationPatches(
        Array.from({ length: 101 }, () => ({
          op: 'set',
          path: ['title'],
          value: 'x',
        })),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects unsupported operations and invalid entity selectors', () => {
    expect(() =>
      validateCollaborationPatches([
        { op: 'execute', path: [], value: 'anything' },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validateCollaborationPatches([
        { op: 'set', path: ['pages', { id: '' }], value: [] },
      ]),
    ).toThrow(BadRequestException);
  });
});

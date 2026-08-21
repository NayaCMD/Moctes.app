import { BadRequestException } from '@nestjs/common';

const DOCUMENT_TYPES = new Set(['notebook', 'notepad', 'clipboard']);
const ELEMENT_TYPES = new Set([
  'text',
  'emoji',
  'shape',
  'sticker',
  'image',
  'tape',
  'checklist',
  'post-it',
  'comment',
  'drawing',
]);

export function assertValidDocumentPayload(
  expectedId: string,
  value: unknown,
): asserts value is Record<string, unknown> {
  const document = record(value, 'Document must be an object.');
  requiredString(document.id, 'Document id');
  if (document.id !== expectedId) {
    throw new BadRequestException(
      'Payload document id must match the route id.',
    );
  }
  requiredString(document.title, 'Document title');
  if (!DOCUMENT_TYPES.has(requiredString(document.type, 'Document type'))) {
    throw new BadRequestException('Document type is not supported.');
  }
  if (
    document.schemaVersion !== undefined &&
    (!Number.isInteger(document.schemaVersion) ||
      Number(document.schemaVersion) < 1)
  ) {
    throw new BadRequestException(
      'Document schema version must be a positive integer.',
    );
  }
  if (!Array.isArray(document.pages) || document.pages.length === 0) {
    throw new BadRequestException('Document must contain at least one page.');
  }
  if (document.pages.length > 1_000) {
    throw new BadRequestException('Document page limit exceeded.');
  }

  const pageIds = new Set<string>();
  const elementIds = new Set<string>();
  let elementCount = 0;
  for (const pageValue of document.pages) {
    const page = record(pageValue, 'Every page must be an object.');
    const pageId = requiredString(page.id, 'Page id');
    if (pageIds.has(pageId))
      throw new BadRequestException('Page ids must be unique.');
    pageIds.add(pageId);
    if (page.documentId !== expectedId) {
      throw new BadRequestException(
        'Page documentId must match the document id.',
      );
    }
    finiteNumber(page.order, 'Page order');
    requiredString(page.paperType, 'Page paper type');
    requiredString(page.paperColor, 'Page paper color');
    if (!Array.isArray(page.elements)) {
      throw new BadRequestException('Page elements must be an array.');
    }
    if (page.elements.length > 5_000) {
      throw new BadRequestException('Page element limit exceeded.');
    }
    elementCount += page.elements.length;
    for (const elementValue of page.elements) {
      const element = record(elementValue, 'Every element must be an object.');
      const elementId = requiredString(element.id, 'Element id');
      if (elementIds.has(elementId)) {
        throw new BadRequestException(
          'Element ids must be unique in a document.',
        );
      }
      elementIds.add(elementId);
      if (!ELEMENT_TYPES.has(requiredString(element.type, 'Element type'))) {
        throw new BadRequestException('Element type is not supported.');
      }
      for (const field of ['x', 'y', 'width', 'height', 'rotation', 'zIndex']) {
        finiteNumber(element[field], `Element ${field}`);
      }
      if (Number(element.width) <= 0 || Number(element.height) <= 0) {
        throw new BadRequestException('Element dimensions must be positive.');
      }
      record(element.content, 'Element content must be an object.');
      record(element.style, 'Element style must be an object.');
    }
  }
  if (elementCount > 50_000) {
    throw new BadRequestException('Document element limit exceeded.');
  }
  if (!pageIds.has(requiredString(document.activePageId, 'Active page id'))) {
    throw new BadRequestException(
      'Active page id must reference a document page.',
    );
  }
  if (!Array.isArray(document.dividers)) {
    throw new BadRequestException('Document dividers must be an array.');
  }
}

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException(message);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${label} must be a non-empty string.`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${label} must be a finite number.`);
  }
  return value;
}

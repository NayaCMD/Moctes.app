import { Injectable } from '@nestjs/common';
import {
  DOMParser,
  XMLSerializer,
  type Attr as XmlAttr,
  type Element as XmlElement,
} from '@xmldom/xmldom';

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'clippath',
  'mask',
  'pattern',
  'symbol',
  'use',
  'text',
  'tspan',
  'title',
  'desc',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'xmlns',
  'xmlns:xlink',
  'viewbox',
  'width',
  'height',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'opacity',
  'clip-path',
  'clip-rule',
  'mask',
  'id',
  'href',
  'xlink:href',
  'offset',
  'stop-color',
  'stop-opacity',
  'gradientunits',
  'gradienttransform',
  'spreadmethod',
  'patternunits',
  'patterncontentunits',
  'patterntransform',
  'preserveaspectratio',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'dx',
  'dy',
]);

const MAX_SVG_NODES = 5_000;
const MAX_ATTRIBUTE_LENGTH = 100_000;

export class UnsafeSvgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeSvgError';
  }
}

@Injectable()
export class SvgSanitizerService {
  sanitize(source: Buffer): Buffer {
    const text = source.toString('utf8').replace(/^\uFEFF/, '');
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
      throw new UnsafeSvgError(
        'SVG declarations and entities are not allowed.',
      );
    }

    const parseErrors: string[] = [];
    const document = new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') {
          parseErrors.push(message);
        }
      },
    }).parseFromString(text, 'image/svg+xml');
    if (parseErrors.length > 0 || !document.documentElement) {
      throw new UnsafeSvgError('The SVG document is malformed.');
    }
    if (document.documentElement.tagName.toLowerCase() !== 'svg') {
      throw new UnsafeSvgError('The document root must be an SVG element.');
    }

    let visitedNodes = 0;
    const sanitizeElement = (element: XmlElement): void => {
      visitedNodes += 1;
      if (visitedNodes > MAX_SVG_NODES) {
        throw new UnsafeSvgError('The SVG contains too many elements.');
      }

      const attributes = Array.from(
        { length: element.attributes.length },
        (_, index) => element.attributes.item(index),
      ).filter((attribute): attribute is XmlAttr => attribute !== null);
      for (const attribute of attributes) {
        const name = attribute.name.toLowerCase();
        if (
          name.startsWith('on') ||
          !ALLOWED_ATTRIBUTES.has(name) ||
          attribute.value.length > MAX_ATTRIBUTE_LENGTH ||
          !isSafeAttributeValue(name, attribute.value)
        ) {
          element.removeAttribute(attribute.name);
        }
      }

      const children = Array.from(
        { length: element.childNodes.length },
        (_, index) => element.childNodes.item(index),
      ).filter((node) => node !== null);
      for (const child of children) {
        if (child.nodeType === 1) {
          const childElement = child as XmlElement;
          if (!ALLOWED_ELEMENTS.has(childElement.tagName.toLowerCase())) {
            element.removeChild(child);
            continue;
          }
          sanitizeElement(childElement);
          continue;
        }
        if (child.nodeType !== 3 && child.nodeType !== 4) {
          element.removeChild(child);
        }
      }
    };

    sanitizeElement(document.documentElement);
    document.documentElement.setAttribute(
      'xmlns',
      'http://www.w3.org/2000/svg',
    );
    return Buffer.from(
      new XMLSerializer().serializeToString(document.documentElement),
      'utf8',
    );
  }
}

function isSafeAttributeValue(name: string, value: string): boolean {
  const normalized = value.trim();
  if (/javascript\s*:|data\s*:|https?\s*:|file\s*:/i.test(normalized)) {
    return false;
  }
  if (name === 'href' || name === 'xlink:href') {
    return /^#[A-Za-z_][\w:.-]*$/.test(normalized);
  }
  const urlReferences = normalized.match(/url\s*\([^)]*\)/gi) ?? [];
  return urlReferences.every((reference) =>
    /^url\s*\(\s*#[A-Za-z_][\w:.-]*\s*\)$/i.test(reference),
  );
}

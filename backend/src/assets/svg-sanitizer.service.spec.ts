import { SvgSanitizerService, UnsafeSvgError } from './svg-sanitizer.service';

describe('SvgSanitizerService', () => {
  const sanitizer = new SvgSanitizerService();

  it('removes executable elements, handlers and external references', () => {
    const result = sanitizer
      .sanitize(
        Buffer.from(`
          <svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)" viewBox="0 0 10 10">
            <script>alert(1)</script>
            <foreignObject><div>unsafe</div></foreignObject>
            <use href="https://attacker.example/image.svg#x" />
            <path id="safe" d="M0 0L10 10" fill="#fff" />
          </svg>
        `),
      )
      .toString('utf8');

    expect(result).toContain('<path id="safe"');
    expect(result).not.toMatch(/script|foreignObject|onload|attacker/i);
  });

  it('rejects document type and entity declarations', () => {
    expect(() =>
      sanitizer.sanitize(
        Buffer.from(
          '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>',
        ),
      ),
    ).toThrow(UnsafeSvgError);
  });
});

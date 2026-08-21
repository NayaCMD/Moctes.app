import { validateEnvironment } from './environment';

describe('production environment validation', () => {
  it('keeps local development configuration optional', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toEqual({
      NODE_ENV: 'test',
    });
  });

  it('rejects missing and insecure production configuration', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      /Missing required production configuration/,
    );
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        FRONTEND_URL: 'http://moctes.example',
      }),
    ).toThrow(/must use HTTPS/);
    expect(() =>
      validateEnvironment({
        ...productionEnvironment(),
        OBJECT_STORAGE_SECRET_KEY: 'moctes-development',
      }),
    ).toThrow(/Development object-storage credentials/);
  });

  it('accepts explicit production dependencies and credentials', () => {
    const environment = productionEnvironment();
    expect(validateEnvironment(environment)).toBe(environment);
  });
});

function productionEnvironment(): Record<string, unknown> {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:password@db:5432/moctes',
    FRONTEND_URL: 'https://app.moctes.example',
    OBJECT_STORAGE_ENDPOINT: 'https://storage.internal.example',
    OBJECT_STORAGE_PUBLIC_ENDPOINT: 'https://assets.moctes.example',
    OBJECT_STORAGE_ACCESS_KEY: 'production-access-key',
    OBJECT_STORAGE_SECRET_KEY: 'production-secret-key',
    OBJECT_STORAGE_BUCKET: 'moctes-production',
  };
}

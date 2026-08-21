export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  if (environment.NODE_ENV !== 'production') return environment;

  const required = [
    'DATABASE_URL',
    'FRONTEND_URL',
    'OBJECT_STORAGE_ENDPOINT',
    'OBJECT_STORAGE_PUBLIC_ENDPOINT',
    'OBJECT_STORAGE_ACCESS_KEY',
    'OBJECT_STORAGE_SECRET_KEY',
    'OBJECT_STORAGE_BUCKET',
  ];
  const missing = required.filter(
    (key) => typeof environment[key] !== 'string' || !environment[key],
  );
  if (missing.length > 0) {
    throw new Error(
      `Missing required production configuration: ${missing.join(', ')}.`,
    );
  }

  const frontendUrl = new URL(String(environment.FRONTEND_URL));
  if (frontendUrl.protocol !== 'https:') {
    throw new Error('FRONTEND_URL must use HTTPS in production.');
  }
  if (
    environment.OBJECT_STORAGE_ACCESS_KEY === 'moctes' ||
    environment.OBJECT_STORAGE_SECRET_KEY === 'moctes-development'
  ) {
    throw new Error(
      'Development object-storage credentials cannot be used in production.',
    );
  }
  if (environment.ASSET_ANTIVIRUS_ENABLED === 'false') {
    throw new Error('Asset antivirus cannot be disabled in production.');
  }
  return environment;
}

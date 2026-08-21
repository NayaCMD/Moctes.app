export async function retryImport<T>(
  load: () => Promise<T>,
  retryDelayMs = 200,
): Promise<T> {
  try {
    return await load();
  } catch {
    await new Promise<void>((resolve) =>
      window.setTimeout(resolve, retryDelayMs),
    );
    return load();
  }
}

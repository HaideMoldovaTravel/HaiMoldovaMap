import "server-only";
export const serviceHeaders = {
  "User-Agent": "HaiMoldova/0.1 (tourism-map-development)",
  Accept: "application/json",
};
// Cache and serialize searches to keep use of the public Photon demo service modest.
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
const cache = new Map<string, { value: unknown; expires: number }>();
export function cachedSearch<T>(
  key: string,
  request: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now())
    return Promise.resolve(cached.value as T);
  const task = queue
    .catch(() => undefined)
    .then(async () => {
      const existing = cache.get(key);
      if (existing && existing.expires > Date.now()) return existing.value as T;
      const delay = Math.max(0, 1100 - (Date.now() - lastRequest));
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      lastRequest = Date.now();
      const value = await request();
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { value, expires: Date.now() + 86_400_000 });
      return value;
    });
  queue = task;
  return task;
}

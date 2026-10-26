// Tipos mínimos do runtime de Workers (sem instalar @cloudflare/workers-types).
interface CacheStorage {
  readonly default: Cache;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

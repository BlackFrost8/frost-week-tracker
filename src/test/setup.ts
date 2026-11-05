import { beforeEach } from 'vitest';

/* The storage code only ever touches localStorage and sessionStorage through
   getItem / setItem / removeItem, so a Map is a faithful stand-in and spares
   the suite a DOM emulator. Emptied before every test. */
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, String(value));
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  clear() {
    this.data.clear();
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  get length() {
    return this.data.size;
  }
}

const g = globalThis as unknown as { localStorage: MemoryStorage; sessionStorage: MemoryStorage };
g.localStorage = new MemoryStorage();
g.sessionStorage = new MemoryStorage();

beforeEach(() => {
  g.localStorage.clear();
  g.sessionStorage.clear();
});

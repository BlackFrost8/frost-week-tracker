/**
 * Just enough of `firebase/firestore/lite` for the sync code: documents in a
 * Map keyed by path, `merge` that merges maps the way Firestore does, and an
 * `offline` switch that makes every call throw the way a dropped connection
 * does.
 */

type Ref = { path: string };
type Data = Record<string, unknown>;

export const cloud = {
  docs: new Map<string, Data>(),
  offline: false,
  reset() {
    this.docs.clear();
    this.offline = false;
  },
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function check() {
  if (cloud.offline) throw Object.assign(new Error('offline'), { code: 'unavailable' });
}

function join(first: unknown, rest: string[]): string {
  const base = typeof first === 'object' && first !== null && 'path' in first ? (first as Ref).path : '';
  return [base, ...rest].filter(Boolean).join('/');
}

export const doc = (first: unknown, ...rest: string[]): Ref => ({ path: join(first, rest) });
export const collection = (first: unknown, ...rest: string[]): Ref => ({ path: join(first, rest) });

function isMap(value: unknown): value is Data {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(target: Data, patch: Data): Data {
  const out: Data = { ...target };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = isMap(value) && isMap(out[key]) ? deepMerge(out[key] as Data, value) : value;
  }
  return out;
}

export async function getDoc(ref: Ref) {
  check();
  const data = cloud.docs.get(ref.path);
  return { exists: () => data !== undefined, data: () => (data ? clone(data) : undefined) };
}

export async function setDoc(ref: Ref, data: Data, options?: { merge?: boolean }) {
  check();
  const current = cloud.docs.get(ref.path);
  cloud.docs.set(ref.path, options?.merge && current ? deepMerge(current, clone(data)) : clone(data));
}

export async function deleteDoc(ref: Ref) {
  check();
  cloud.docs.delete(ref.path);
}

export async function getDocs(ref: Ref) {
  check();
  const prefix = `${ref.path}/`;
  const docs = [...cloud.docs.keys()]
    .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map((p) => ({ id: p.slice(prefix.length) }));
  return { docs };
}

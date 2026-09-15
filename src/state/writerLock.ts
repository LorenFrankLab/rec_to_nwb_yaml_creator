/**
 * @fileoverview Single-writer ownership of the persisted workspace (review finding F4).
 *
 * Every save serializes the WHOLE workspace to one localStorage key, so two tabs editing at once
 * silently overwrite each other's work (the later save wins, whole-blob). The pilot policy is
 * therefore one editing tab: the first tab to open takes an exclusive **writer** lease; any other
 * tab opens **read-only** and says so, follows the writer's saves live, and can ask to take over
 * (the writer flushes, saves, releases, and turns read-only).
 *
 * Mechanism, in order of preference:
 *  1. **Web Locks** (`navigator.locks`, exclusive, `ifAvailable`) — a real, browser-arbitrated
 *     mutex that is released automatically when the holding tab closes or crashes. Chrome 69+,
 *     Firefox 96+, Safari 15.4+ (the supported set).
 *  2. **localStorage lease** fallback (no Web Locks — jsdom, old browsers): a heartbeat record that
 *     is treated as stale after {@link LEASE_STALE_MS}. Best effort; not race-proof.
 *
 * Independently of the lease, every write is stamped with a **revision** (`meta` key) and a save
 * refuses to overwrite a revision this tab has not seen (see `persistence.ts`), so even a tab that
 * wrongly believes it is the writer cannot clobber another tab's newer save.
 *
 * A `BroadcastChannel` carries the take-over handshake. The module is framework-free; React
 * subscribes through {@link subscribeWriterState}.
 */

/** The lock name (Web Locks) / lease key (fallback). */
export const WRITER_LOCK_NAME = 'rec_to_nwb_workspace_v1:writer';
/** localStorage key of the fallback lease. */
export const WRITER_LEASE_KEY = 'rec_to_nwb_workspace_v1.writer';
/** BroadcastChannel name for the hand-over handshake. */
export const WRITER_CHANNEL_NAME = 'rec_to_nwb_workspace_v1:writer-channel';
/** Fallback lease heartbeat period. */
export const LEASE_HEARTBEAT_MS = 5_000;
/** A fallback lease older than this is considered abandoned. */
export const LEASE_STALE_MS = 15_000;

/** Why this tab is read-only. */
export type ReaderReason =
  | 'held-elsewhere' // another tab holds the writer lease
  | 'handed-over' // this tab released the lease to another tab on request
  | 'unavailable'; // storage unavailable (nothing to own)

/** The tab's ownership state. */
export type WriterState =
  | { role: 'pending' }
  | { role: 'writer' }
  | { role: 'reader'; reason: ReaderReason };

/** Per-tab identity (stable for the page's lifetime). */
export const WRITER_ID: string =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

let state: WriterState = { role: 'pending' };
const listeners = new Set<() => void>();
let releaseHeld: (() => void) | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let channel: BroadcastChannel | null = null;
let acquired = false;

function setState(next: WriterState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

/**
 * The current ownership state.
 *
 * @returns The state (`pending` until {@link acquireWriterLock} settles).
 */
export function getWriterState(): WriterState {
  return state;
}

/**
 * Whether this tab may write the workspace blob.
 *
 * @returns True for the writer.
 */
export function isWriter(): boolean {
  return state.role === 'writer';
}

/**
 * Subscribe to ownership changes (`useSyncExternalStore` contract).
 *
 * @param listener - Called on every change.
 * @returns Unsubscribe.
 */
export function subscribeWriterState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function hasWebLocks(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as Navigator & { locks?: LockManager }).locks;
}

function readLease(): { writerId: string; heartbeat: number } | null {
  try {
    const raw = window.localStorage.getItem(WRITER_LEASE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { writerId?: unknown; heartbeat?: unknown };
    if (typeof parsed.writerId !== 'string' || typeof parsed.heartbeat !== 'number') return null;
    return { writerId: parsed.writerId, heartbeat: parsed.heartbeat };
  } catch {
    return null;
  }
}

function writeLease(): void {
  window.localStorage.setItem(WRITER_LEASE_KEY, JSON.stringify({ writerId: WRITER_ID, heartbeat: Date.now() }));
}

function clearLease(): void {
  try {
    const lease = readLease();
    if (lease && lease.writerId === WRITER_ID) window.localStorage.removeItem(WRITER_LEASE_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}

/** Try the Web Locks path: resolves true when the exclusive lock was granted to this tab. */
function acquireViaWebLocks(): Promise<boolean> {
  const locks = (navigator as Navigator & { locks: LockManager }).locks;
  return new Promise<boolean>((resolve) => {
    locks
      .request(WRITER_LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return undefined;
        }
        // Hold the lock until release; the browser releases it if the tab goes away.
        return new Promise<void>((release) => {
          releaseHeld = release;
          resolve(true);
        });
      })
      .catch(() => resolve(false));
  });
}

/** Try the localStorage-lease fallback. */
function acquireViaLease(): boolean {
  let lease: ReturnType<typeof readLease>;
  try {
    lease = readLease();
  } catch {
    return false;
  }
  const fresh = lease != null && Date.now() - lease.heartbeat < LEASE_STALE_MS;
  if (fresh && lease!.writerId !== WRITER_ID) return false;
  try {
    writeLease();
  } catch {
    return false;
  }
  heartbeat = setInterval(() => {
    try {
      writeLease();
    } catch {
      // storage unavailable mid-session — keep going; the revision check still guards writes
    }
  }, LEASE_HEARTBEAT_MS);
  releaseHeld = () => {
    if (heartbeat) clearInterval(heartbeat);
    heartbeat = null;
    clearLease();
  };
  return true;
}

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === 'undefined') return null;
  channel = new BroadcastChannel(WRITER_CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent) => {
    const msg = event.data as { type?: string; from?: string } | null;
    if (!msg || msg.from === WRITER_ID) return;
    if (msg.type === 'release-request' && state.role === 'writer') {
      // Another tab asked to edit: hand over. The persistence layer subscribed to `onBeforeHandOver`
      // flushes drafts and writes first (synchronously), then we release.
      beforeHandOver.forEach((fn) => {
        try {
          fn();
        } catch {
          // a failed final write must not block the hand-over; the revision stamp protects the blob
        }
      });
      releaseWriterLock('handed-over');
      channel?.postMessage({ type: 'released', from: WRITER_ID });
    }
  };
  return channel;
}

const beforeHandOver = new Set<() => void>();

/**
 * Register a callback the writer runs (synchronously) right before handing the lease to another
 * tab — persistence uses it to flush drafts and write the final state.
 *
 * @param fn - The callback.
 * @returns Unregister.
 */
export function onBeforeHandOver(fn: () => void): () => void {
  beforeHandOver.add(fn);
  return () => {
    beforeHandOver.delete(fn);
  };
}

/**
 * Acquire the writer lease for this tab (idempotent). Resolves to the resulting state.
 *
 * @returns The ownership state after the attempt.
 */
export async function acquireWriterLock(): Promise<WriterState> {
  if (acquired && state.role !== 'pending') return state;
  ensureChannel();
  let ok = false;
  if (hasWebLocks()) {
    ok = await acquireViaWebLocks();
  } else if (typeof window !== 'undefined' && window.localStorage) {
    ok = acquireViaLease();
  } else {
    setState({ role: 'reader', reason: 'unavailable' });
    acquired = true;
    return state;
  }
  acquired = true;
  setState(ok ? { role: 'writer' } : { role: 'reader', reason: 'held-elsewhere' });
  return state;
}

/**
 * Release the writer lease (this tab becomes read-only).
 *
 * @param reason - Why (defaults to `handed-over`).
 */
export function releaseWriterLock(reason: ReaderReason = 'handed-over'): void {
  if (releaseHeld) {
    releaseHeld();
    releaseHeld = null;
  }
  if (state.role === 'writer') setState({ role: 'reader', reason });
}

/**
 * Ask whichever tab holds the lease to hand it over, then take it. Resolves to the resulting
 * state (`writer` on success; `reader` if no tab released within the timeout).
 *
 * @param timeoutMs - How long to wait for the release.
 * @returns The ownership state after the attempt.
 */
export async function requestTakeOver(timeoutMs = 3_000): Promise<WriterState> {
  if (state.role === 'writer') return state;
  const ch = ensureChannel();
  ch?.postMessage({ type: 'release-request', from: WRITER_ID });
  const deadline = Date.now() + timeoutMs;
  // Retry the acquire until the previous holder releases (Web Locks) or its lease is cleared.
  while (Date.now() < deadline) {
    acquired = false;
    setState({ role: 'pending' });
    // eslint-disable-next-line no-await-in-loop
    const next = await acquireWriterLock();
    if (next.role === 'writer') return next;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  setState({ role: 'reader', reason: 'held-elsewhere' });
  return state;
}

/**
 * Re-try acquiring while read-only (the writer tab may have closed). Cheap; safe to poll.
 *
 * @returns The ownership state after the attempt.
 */
export async function retryAcquire(): Promise<WriterState> {
  if (state.role !== 'reader' || state.reason === 'unavailable') return state;
  acquired = false;
  const next = await acquireWriterLock();
  return next;
}

/** Test-only: release everything and forget the state. */
export function resetWriterLockForTests(): void {
  if (releaseHeld) releaseHeld();
  releaseHeld = null;
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  if (channel) {
    channel.close();
    channel = null;
  }
  beforeHandOver.clear();
  acquired = false;
  state = { role: 'pending' };
  listeners.clear();
}

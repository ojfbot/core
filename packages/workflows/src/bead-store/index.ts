/**
 * BeadStore factory — selects FilesystemBeadStore or DoltBeadStore based on
 * the BEAD_STORE environment variable and Dolt availability.
 *
 * Modes:
 *   'auto'       — TCP probe port 3307; Dolt if reachable, filesystem if not (default)
 *   'dolt'       — DoltBeadStore unconditionally
 *   'filesystem' — FilesystemBeadStore unconditionally
 *
 * The factory caches a singleton — repeated calls return the same instance.
 */

import net from 'net';
import type { BeadStore } from '../types/bead.js';
import { FilesystemBeadStore } from './FilesystemBeadStore.js';
import { DoltBeadStore } from './DoltBeadStore.js';

export type BeadStoreBackend = 'filesystem' | 'dolt' | 'auto';

let cachedStore: BeadStore | null = null;
let cachedBackend: BeadStoreBackend | null = null;

function isDoltReachable(port: number, timeoutMs: number = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Create or return a cached BeadStore instance.
 *
 * @param backend - Override the BEAD_STORE env var. Defaults to env or 'auto'.
 */
export async function createBeadStore(
  backend?: BeadStoreBackend,
): Promise<BeadStore> {
  const resolved = backend ?? (process.env.BEAD_STORE as BeadStoreBackend) ?? 'auto';

  // Return cached instance if same backend requested
  if (cachedStore && cachedBackend === resolved) {
    return cachedStore;
  }

  switch (resolved) {
    case 'filesystem':
      cachedStore = new FilesystemBeadStore();
      break;

    case 'dolt':
      cachedStore = new DoltBeadStore();
      break;

    case 'auto': {
      const port = parseInt(process.env.DOLT_PORT ?? '3307', 10);
      const reachable = await isDoltReachable(port);
      cachedStore = reachable ? new DoltBeadStore() : new FilesystemBeadStore();
      break;
    }

    default:
      cachedStore = new FilesystemBeadStore();
  }

  cachedBackend = resolved;
  return cachedStore;
}

/** Reset the cached store — useful in tests. */
export function resetBeadStoreCache(): void {
  cachedStore = null;
  cachedBackend = null;
}

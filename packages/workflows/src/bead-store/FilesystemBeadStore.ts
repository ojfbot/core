/**
 * FilesystemBeadStore
 *
 * Stores FrameBeads as JSON files under <root>/<prefix>/<id>.json.
 * Default root: ~/.beads/  (pass a custom root in tests or alternate configs)
 * Uses chokidar to power the watch() subscription API.
 *
 * Directory layout:
 *   ~/.beads/
 *     core/          ← core- and core-reader beads
 *     cv/            ← cv-builder beads
 *     blog/          ← blogengine beads
 *     trip/          ← tripplanner beads
 *     pure/          ← purefoy beads
 *     hq/            ← shell cross-app beads
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import chokidar from 'chokidar';
import type {
  BeadStore,
  BeadFilter,
  BeadEvent,
  FrameBead,
} from '../types/bead.js';
import { beadPrefix } from '../types/bead.js';

export const DEFAULT_BEADS_ROOT = path.join(os.homedir(), '.beads');

function matchesFilter(bead: FrameBead, filter: BeadFilter): boolean {
  if (filter.type && bead.type !== filter.type) return false;
  if (filter.status && bead.status !== filter.status) return false;
  if (filter.actor && bead.actor !== filter.actor) return false;
  if (filter.prefix && !bead.id.startsWith(filter.prefix + '-')) return false;
  if (filter.label) {
    for (const [k, v] of Object.entries(filter.label)) {
      if (bead.labels[k] !== v) return false;
    }
  }
  return true;
}

export class FilesystemBeadStore implements BeadStore {
  private readonly root: string;

  constructor(beadsRoot: string = DEFAULT_BEADS_ROOT) {
    this.root = beadsRoot;
  }

  private beadDir(id: string): string {
    return path.join(this.root, beadPrefix(id));
  }

  private beadPath(id: string): string {
    return path.join(this.beadDir(id), `${id}.json`);
  }

  async get(id: string): Promise<FrameBead | null> {
    try {
      const raw = await fs.readFile(this.beadPath(id), 'utf-8');
      return JSON.parse(raw) as FrameBead;
    } catch {
      return null;
    }
  }

  async create(bead: FrameBead): Promise<void> {
    await fs.mkdir(this.beadDir(bead.id), { recursive: true });
    await fs.writeFile(this.beadPath(bead.id), JSON.stringify(bead, null, 2));
  }

  async update(id: string, patch: Partial<FrameBead>): Promise<void> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Bead not found: ${id}`);
    const updated: FrameBead = {
      ...existing,
      ...patch,
      id,                         // never overwrite ID
      updated_at: new Date().toISOString(),
    };
    await fs.writeFile(this.beadPath(id), JSON.stringify(updated, null, 2));
  }

  async close(id: string): Promise<void> {
    await this.update(id, {
      status: 'closed',
      closed_at: new Date().toISOString(),
    });
  }

  async query(filter: BeadFilter): Promise<FrameBead[]> {
    const results: FrameBead[] = [];

    const prefixDirs = filter.prefix
      ? [path.join(this.root, filter.prefix)]
      : await this._allPrefixDirs();

    for (const dir of prefixDirs) {
      if (!fsSync.existsSync(dir)) continue;
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const raw = await fs.readFile(path.join(dir, f), 'utf-8');
          const bead = JSON.parse(raw) as FrameBead;
          if (matchesFilter(bead, filter)) results.push(bead);
        } catch {
          // skip malformed files
        }
      }
    }

    return results.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  watch(filter: BeadFilter, cb: (event: BeadEvent) => void): () => void {
    const watchDir = filter.prefix
      ? path.join(this.root, filter.prefix)
      : this.root;

    // chokidar v4+ dropped glob support — watch the directory, filter files via `ignored`
    const watcher = chokidar.watch(watchDir, {
      persistent: true,
      ignoreInitial: true,
      depth: filter.prefix ? 0 : 1,
      ignored: (_p: string, stats?: { isFile?: () => boolean }) =>
        stats?.isFile?.() === true && !_p.endsWith('.json'),
    });

    const handleFile = async (filePath: string, kind: 'created' | 'updated') => {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const bead = JSON.parse(raw) as FrameBead;
        if (matchesFilter(bead, filter)) {
          cb({ kind, bead });
        }
      } catch {
        // file may have been removed between watch event and read
      }
    };

    watcher.on('add', (p) => handleFile(p, 'created'));
    watcher.on('change', (p) => handleFile(p, 'updated'));

    return () => { watcher.close(); };
  }

  private async _allPrefixDirs(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.root, { withFileTypes: true });
      return entries
        .filter((e) => e.isDirectory())
        .map((e) => path.join(this.root, e.name));
    } catch {
      return [];
    }
  }
}

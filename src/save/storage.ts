/**
 * Versioned saves in localStorage, with migrations and portable save codes.
 * Every storage access is wrapped: private modes and blocked storage just mean
 * no persistence, never a crash.
 */
import { config } from '../config';
import type { RunState } from '../engine/state';

export const SAVE_VERSION = 1;

export interface Settings {
  theme: 'system' | 'light' | 'dark';
  highContrast: boolean;
  textScale: number;
  reduceMotion: boolean;
  stepFeedback: boolean;
}

export interface Profile {
  /** Scene ids whose Money Rule the player has collected (across all runs). */
  rules: string[];
  runsStarted: number;
}

export interface SaveFile {
  version: number;
  run: RunState | null;
  /** Snapshot taken at the start of the current chapter: for rewind and the report card. */
  chapterStart: RunState | null;
  profile: Profile;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', highContrast: false, textScale: 1, reduceMotion: false, stepFeedback: true };

export function emptySave(): SaveFile {
  return { version: SAVE_VERSION, run: null, chapterStart: null, profile: { rules: [], runsStarted: 0 }, settings: { ...DEFAULT_SETTINGS } };
}

/** migrations[n] upgrades a save from version n to n + 1. */
const migrations: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: unknown): SaveFile | null {
  if (!raw || typeof raw !== 'object') return null;
  let s = raw as Record<string, unknown>;
  let v = typeof s.version === 'number' ? s.version : 0;
  if (v > SAVE_VERSION) return null;
  while (v < SAVE_VERSION) {
    const m = migrations[v];
    if (!m) return null;
    s = m(s);
    v++;
    s.version = v;
  }
  const base = emptySave();
  const file = s as unknown as SaveFile;
  return {
    version: SAVE_VERSION,
    run: file.run ?? null,
    chapterStart: file.chapterStart ?? null,
    profile: { ...base.profile, ...(file.profile ?? {}) },
    settings: { ...base.settings, ...(file.settings ?? {}) },
  };
}

const KEY = `${config.storageKey}:save`;

export function storageAvailable(): boolean {
  try {
    const k = `${config.storageKey}:probe`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function loadSave(): SaveFile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptySave();
    return migrate(JSON.parse(raw)) ?? emptySave();
  } catch {
    return emptySave();
  }
}

export function writeSave(save: SaveFile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

// ── Save codes: base64url(JSON) with a short checksum ─────────────

function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function exportCode(save: SaveFile): string {
  const body = toBase64Url(JSON.stringify(save));
  return `CMP${SAVE_VERSION}.${checksum(body)}.${body}`;
}

export function importCode(code: string): SaveFile | null {
  try {
    const m = code.trim().replace(/\s+/g, '').match(/^CMP(\d+)\.([a-z0-9]+)\.([A-Za-z0-9_-]+)$/);
    if (!m || checksum(m[3]!) !== m[2]) return null;
    return migrate(JSON.parse(fromBase64Url(m[3]!)));
  } catch {
    return null;
  }
}

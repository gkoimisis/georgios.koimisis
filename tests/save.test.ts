import { describe, expect, it } from 'vitest';
import { emptySave, exportCode, importCode, migrate, SAVE_VERSION } from '../src/save/storage';
import { startRun } from '../src/engine/step';
import { engine } from './helpers';

describe('saves', () => {
  it('round-trips a run through a save code', () => {
    const save = emptySave();
    save.run = startRun(engine, { seed: 123 });
    save.profile.rules = ['ch1-e1-s1'];
    const code = exportCode(save);
    expect(code.startsWith(`CMP${SAVE_VERSION}.`)).toBe(true);
    expect(importCode(code)).toEqual(save);
  });
  it('rejects tampered or garbage codes', () => {
    const code = exportCode(emptySave());
    expect(importCode(code.slice(0, -3) + 'abc')).toBeNull();
    expect(importCode('hello')).toBeNull();
  });
  it('fills in missing fields and refuses saves from the future', () => {
    const m = migrate({ version: SAVE_VERSION, run: null });
    expect(m?.settings.textScale).toBe(1);
    expect(m?.profile.rules).toEqual([]);
    expect(migrate({ version: SAVE_VERSION + 1 })).toBeNull();
    expect(migrate(null)).toBeNull();
  });
});

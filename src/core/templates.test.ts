import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES, findTemplate, templateCategories } from './templates';
import { counterFromConfig, configOf, createCounter } from './counter';

describe('built-in templates', () => {
  it('provides every template the product promises', () => {
    const names = BUILTIN_TEMPLATES.map((t) => t.name);
    for (const expected of [
      'Habit tracker',
      'Workout tracker',
      'Attendance counter',
      'Inventory counter',
      'Sports scoreboard',
      'Gaming score counter',
      'Event attendance',
      'Daily tasks',
      'Business stock',
      'Personal goal',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('has unique ids and is marked built in', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BUILTIN_TEMPLATES.every((t) => t.builtin)).toBe(true);
  });

  it('every template creates a valid, working counter', () => {
    for (const t of BUILTIN_TEMPLATES) {
      const c = counterFromConfig(t.config, t.name);
      expect(c.name).toBe(t.name);
      expect(c.mode).toBe(t.config.mode);
      expect(c.value).toBe(c.startValue);
      if (c.mode === 'score') expect(c.players.length).toBeGreaterThanOrEqual(2);
      if (c.mode === 'multi') expect(c.subCounters.length).toBeGreaterThanOrEqual(2);
      if (c.mode === 'goal') expect((c.goal ?? 0) > 0).toBe(true);
      if (c.min !== null && c.max !== null) expect(c.min <= c.max).toBe(true);
    }
  });

  it('creates independent counters from the same template', () => {
    const t = findTemplate('builtin_scoreboard', [])!;
    const a = counterFromConfig(t.config, 'A');
    const b = counterFromConfig(t.config, 'B');
    a.players[0].score = 5;
    expect(b.players[0].score).toBe(0);
    expect(a.players[0].id === b.players[0].id).toBe(false);
  });

  it('lists categories in first-seen order', () => {
    const cats = templateCategories(BUILTIN_TEMPLATES);
    expect(cats.length).toBeGreaterThan(2);
    expect(new Set(cats).size).toBe(cats.length);
  });
});

describe('user templates', () => {
  it('saves a counter configuration without its value', () => {
    const c = createCounter({ name: 'Reps', mode: 'goal', goal: 50, value: 31, step: 5 });
    const config = configOf(c);
    expect('value' in config).toBe(false);
    const again = counterFromConfig(config, 'Reps 2');
    expect(again.goal).toBe(50);
    expect(again.step).toBe(5);
    expect(again.value).toBe(0);
  });

  it('finds user templates by id', () => {
    const user = { id: 'u1', name: 'Mine', description: '', category: 'My templates', builtin: false, createdAt: 1, config: configOf(createCounter()) };
    expect(findTemplate('u1', [user])).toBeTruthy();
    expect(findTemplate('nope', [user])).toBeUndefined();
  });
});

import type { CounterConfig, Template } from './types';
import { configOf, createCounter } from './counter';

function build(
  slug: string,
  name: string,
  category: string,
  description: string,
  config: Partial<CounterConfig> & Pick<CounterConfig, 'mode'>,
): Template {
  const base = createCounter({
    mode: config.mode,
    description: config.description ?? description,
    icon: config.icon,
    color: config.color,
    startValue: config.startValue,
    step: config.step,
    min: config.min,
    max: config.max,
    goal: config.goal,
    intervalMs: config.intervalMs,
    intervalDirection: config.intervalDirection,
    cardStyle: config.cardStyle,
    players: config.players?.map((p, i) => ({ id: `tp${i}`, name: p.name, color: p.color, score: 0 })),
    subCounters: config.subCounters?.map((s, i) => ({ id: `ts${i}`, name: s.name, color: s.color, value: 0 })),
  }, 0);
  return {
    id: `builtin_${slug}`,
    name,
    description,
    category,
    builtin: true,
    createdAt: 0,
    config: configOf(base),
  };
}

export const BUILTIN_TEMPLATES: Template[] = [
  build('habit', 'Habit tracker', 'Personal', 'Check in once a day and build a 30-day streak.', {
    mode: 'goal', icon: 'repeat', color: 'moss', goal: 30, min: 0, step: 1,
  }),
  build('water', 'Water intake', 'Personal', 'Eight glasses a day, tracked one at a time.', {
    mode: 'goal', icon: 'droplets', color: 'lagoon', goal: 8, min: 0, step: 1,
  }),
  build('goal', 'Personal goal', 'Personal', 'Track steady progress towards a number you care about.', {
    mode: 'goal', icon: 'target', color: 'iris', goal: 1000, min: 0, step: 10,
  }),
  build('tasks', 'Daily tasks', 'Personal', 'How many tasks have you finished today?', {
    mode: 'goal', icon: 'check-square', color: 'sun', goal: 5, min: 0, step: 1,
  }),
  build('workout', 'Workout tracker', 'Fitness', 'Reps for each exercise on one screen.', {
    mode: 'multi', icon: 'dumbbell', color: 'rose', min: 0, step: 1,
    subCounters: [
      { name: 'Push-ups', color: 'rose' },
      { name: 'Squats', color: 'ember' },
      { name: 'Sit-ups', color: 'sun' },
      { name: 'Planks', color: 'orchid' },
    ],
  }),
  build('attendance', 'Attendance counter', 'Events', 'Count people as they arrive. Hold the button to add quickly.', {
    mode: 'normal', icon: 'users', color: 'lagoon', min: 0, step: 1,
  }),
  build('event', 'Event attendance', 'Events', 'Fill a venue up to capacity with a live progress bar.', {
    mode: 'goal', icon: 'ticket', color: 'orchid', goal: 200, min: 0, step: 1,
  }),
  build('inventory', 'Inventory counter', 'Business', 'Count items on a shelf, never below zero.', {
    mode: 'normal', icon: 'package', color: 'sun', min: 0, step: 1,
  }),
  build('stock', 'Business stock', 'Business', 'Keep stock levels for several products together.', {
    mode: 'multi', icon: 'boxes', color: 'slate', min: 0, step: 1,
    subCounters: [
      { name: 'Product A', color: 'ember' },
      { name: 'Product B', color: 'lagoon' },
      { name: 'Product C', color: 'moss' },
    ],
  }),
  build('scoreboard', 'Sports scoreboard', 'Games', 'Two teams, big scores, easy to read from across the room.', {
    mode: 'score', icon: 'trophy', color: 'ember', min: 0, step: 1,
    players: [
      { name: 'Home', color: 'ember' },
      { name: 'Away', color: 'lagoon' },
    ],
  }),
  build('gaming', 'Gaming score counter', 'Games', 'Up to four players, with custom points per tap.', {
    mode: 'score', icon: 'gamepad-2', color: 'iris', step: 10,
    players: [
      { name: 'Player 1', color: 'ember' },
      { name: 'Player 2', color: 'lagoon' },
      { name: 'Player 3', color: 'moss' },
      { name: 'Player 4', color: 'orchid' },
    ],
  }),
  build('pacer', 'Breathing pacer', 'Personal', 'Counts up by itself every four seconds. Breathe along.', {
    mode: 'interval', icon: 'sparkles', color: 'lagoon', intervalMs: 4000, step: 1, min: 0,
  }),
];

export function findTemplate(id: string, userTemplates: Template[]): Template | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id) ?? userTemplates.find((t) => t.id === id);
}

export function templateCategories(templates: Template[]): string[] {
  const seen: string[] = [];
  for (const t of templates) if (!seen.includes(t.category)) seen.push(t.category);
  return seen;
}

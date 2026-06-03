import { HOURS_PER_DAY } from './utils.js';
import { getRealWorldTime, daysInYear } from './time.js';

const SPEED_LEVELS = [1, 5, 20, 100, 500];

/** At 1×: 1 real second = 1 game minute → full day in 24 real minutes */
const GAME_MINUTES_PER_REAL_SECOND_AT_1X = 1;

export class Simulation {
  constructor() {
    this.listeners = new Set();
    this.reset();
  }

  reset() {
    const real = getRealWorldTime();
    this.year = real.year;
    this.dayOfYear = real.dayOfYear;
    this.hourOfDay = real.hourOfDay;
    this.running = false;
    this.speedIndex = 0;
    this.seed = Math.floor(Math.random() * 1e9);
    this.elapsedDays = 0;
  }

  get speed() {
    return SPEED_LEVELS[this.speedIndex];
  }

  getState() {
    return {
      year: this.year,
      dayOfYear: this.dayOfYear,
      hourOfDay: this.hourOfDay,
      running: this.running,
      speedIndex: this.speedIndex,
      seed: this.seed,
      elapsedDays: this.elapsedDays,
    };
  }

  loadState(state) {
    if (!state) return;
    this.year = state.year ?? this.year;
    this.dayOfYear = state.dayOfYear ?? this.dayOfYear;
    this.hourOfDay = state.hourOfDay ?? this.hourOfDay;
    this.running = state.running ?? false;
    this.speedIndex = state.speedIndex ?? 0;
    this.seed = state.seed ?? this.seed;
    this.elapsedDays = state.elapsedDays ?? 0;
    this.notify();
  }

  toggleRunning() {
    this.running = !this.running;
    this.notify();
    return this.running;
  }

  cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % SPEED_LEVELS.length;
    this.notify();
    return this.speed;
  }

  advance(deltaSeconds) {
    if (!this.running) return;

    const gameMinutesPerSecond = GAME_MINUTES_PER_REAL_SECOND_AT_1X * this.speed;
    this.hourOfDay += (deltaSeconds * gameMinutesPerSecond) / 60;

    while (this.hourOfDay >= HOURS_PER_DAY) {
      this.hourOfDay -= HOURS_PER_DAY;
      this.dayOfYear += 1;
      this.elapsedDays += 1;

      const maxDays = daysInYear(this.year);
      if (this.dayOfYear > maxDays) {
        this.dayOfYear = 1;
        this.year += 1;
      }
    }

    this.notify();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.getState());
  }
}

export { SPEED_LEVELS };

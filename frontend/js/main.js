import { EarthScene } from './earth.js';
import { VegetationSystem } from './vegetation.js';
import { Simulation } from './simulation.js';
import { UIController } from './ui.js';

async function main() {
  const canvas = document.getElementById('earth-canvas');
  const overlay = document.getElementById('loading-overlay');

  const simulation = new Simulation();
  const earth = new EarthScene(canvas);

  try {
    await earth.init();
  } catch (err) {
    overlay.querySelector('p').textContent = `加载失败：${err.message || '未知错误'}`;
    console.error(err);
    return;
  }

  const vegetation = new VegetationSystem(earth, simulation.seed);
  overlay.querySelector('p').textContent = '正在分布植被…';
  await vegetation.generate();

  const ui = new UIController(simulation, earth, vegetation);
  simulation.notify();

  overlay.classList.add('hidden');

  let lastSeasonUpdate = -1;

  function loop(now) {
    requestAnimationFrame(loop);
    const delta = (now - (loop.prev || now)) / 1000;
    loop.prev = now;

    simulation.advance(delta);

    const state = simulation.getState();
    ui.updateClockPanel(state);

    if (Math.floor(state.dayOfYear) !== lastSeasonUpdate) {
      lastSeasonUpdate = Math.floor(state.dayOfYear);
      earth.updateSeason(state.dayOfYear, state.hourOfDay);
      vegetation.updateSeason(state.dayOfYear);
    } else {
      earth.updateSeason(state.dayOfYear, state.hourOfDay);
    }

    earth.render();
  }

  requestAnimationFrame(loop);
}

main();

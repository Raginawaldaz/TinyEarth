import { formatGameTime, showToast } from './utils.js';
import { getSeasonForHemisphere, getSeasonLabel, getSunAngleDisplay } from './seasons.js';
import {
  dayOfYearToCalendar,
  formatUtcClock,
  formatHourMinutes,
  getSolarTimes,
  getDayNightPhase,
  getDayProgress,
  getDaylightHours,
} from './time.js';
import { listSaves, loadSave, createSave, deleteSave } from './api.js';
import { SPEED_LEVELS } from './simulation.js';

export class UIController {
  constructor(simulation, earthScene, vegetation) {
    this.sim = simulation;
    this.earth = earthScene;
    this.vegetation = vegetation;

    this.btnToggle = document.getElementById('btn-toggle');
    this.btnSpeed = document.getElementById('btn-speed');
    this.btnSave = document.getElementById('btn-save');
    this.btnRestart = document.getElementById('btn-restart');
    this.timeDisplay = document.getElementById('time-display');
    this.seasonDisplay = document.getElementById('season-display');
    this.northSeason = document.getElementById('north-season');
    this.southSeason = document.getElementById('south-season');
    this.sunAngle = document.getElementById('sun-angle');
    this.vegCount = document.getElementById('veg-count');
    this.saveList = document.getElementById('save-list');

    this.clockDate = document.getElementById('clock-date');
    this.clockTime = document.getElementById('clock-time');
    this.clockSeason = document.getElementById('clock-season');
    this.clockPhase = document.getElementById('clock-phase');
    this.clockSunrise = document.getElementById('clock-sunrise');
    this.clockSunset = document.getElementById('clock-sunset');
    this.clockDaylight = document.getElementById('clock-daylight');
    this.dayNightMarker = document.getElementById('day-night-marker');

    this._bindEvents();
    this.sim.subscribe((state) => this.updateDisplay(state));
    this.refreshSaveList();
  }

  _bindEvents() {
    this.btnToggle.addEventListener('click', () => {
      const running = this.sim.toggleRunning();
      this.btnToggle.textContent = running ? '⏸ 暂停' : '▶ 开始';
      this.btnToggle.classList.toggle('running', running);
    });

    this.btnSpeed.addEventListener('click', () => {
      const speed = this.sim.cycleSpeed();
      this.btnSpeed.textContent = `⏩ ${speed}×`;
    });

    this.btnSave.addEventListener('click', () => this.handleSave());
    this.btnRestart.addEventListener('click', () => this.handleRestart());
  }

  updateClockPanel(state) {
    const cal = dayOfYearToCalendar(Math.floor(state.dayOfYear), state.year);
    const north = getSeasonForHemisphere(state.dayOfYear, 'north');
    const solar = getSolarTimes(state.dayOfYear, 35);
    const phase = getDayNightPhase(state.hourOfDay, solar);
    const daylight = getDaylightHours(solar);

    this.clockDate.textContent = `${state.year}年${cal.monthName}${cal.day}日`;
    this.clockTime.textContent = formatUtcClock(state.hourOfDay);

    this.clockSeason.textContent = `北半球 ${getSeasonLabel(north)}`;
    this.clockSeason.className = `season-badge ${north}`;

    this.clockPhase.textContent = `${phase.icon} ${phase.label}`;
    this.clockPhase.className = `phase-badge ${phase.phase}`;

    this.clockSunrise.textContent = solar.polarNight ? '—' : formatHourMinutes(solar.sunrise);
    this.clockSunset.textContent = solar.polarDay ? '—' : formatHourMinutes(solar.sunset);
    this.clockDaylight.textContent = daylight.toFixed(1);

    this.dayNightMarker.style.left = `${getDayProgress(state.hourOfDay)}%`;
  }

  updateDisplay(state) {
    this.timeDisplay.textContent = formatGameTime(state);
    this.updateClockPanel(state);

    const north = getSeasonForHemisphere(state.dayOfYear, 'north');
    const south = getSeasonForHemisphere(state.dayOfYear, 'south');

    this.seasonDisplay.textContent = `北半球 · ${getSeasonLabel(north)}`;
    this.seasonDisplay.className = `season-badge ${north}`;

    this.northSeason.textContent = getSeasonLabel(north);
    this.southSeason.textContent = getSeasonLabel(south);
    this.sunAngle.textContent = getSunAngleDisplay(state.dayOfYear);
    this.vegCount.textContent = `${this.vegetation.getCount().toLocaleString()} 株`;

    this.earth.updateSeason(state.dayOfYear, state.hourOfDay);
    this.vegetation.updateSeason(state.dayOfYear);
  }

  async handleSave() {
    try {
      const state = this.sim.getState();
      const name = `地球 ${formatGameTime(state)}`;
      await createSave(name, state);
      showToast('存档成功！');
      await this.refreshSaveList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async handleRestart() {
    if (!confirm('确定要重启吗？未保存的进度将丢失。')) return;

    this.sim.reset();
    this.sim.notify();
    this.vegetation.setSeed(this.sim.seed);
    await this.vegetation.generate();
    this.btnToggle.textContent = '▶ 开始';
    this.btnToggle.classList.remove('running');
    this.btnSpeed.textContent = `⏩ ${SPEED_LEVELS[0]}×`;
    showToast('已重启地球');
  }

  async loadGameState(state, { silent = false } = {}) {
    this.sim.loadState(state);
    this.vegetation.setSeed(state.seed);
    await this.vegetation.generate();

    this.btnToggle.textContent = state.running ? '⏸ 暂停' : '▶ 开始';
    this.btnToggle.classList.toggle('running', state.running);
    this.btnSpeed.textContent = `⏩ ${SPEED_LEVELS[state.speedIndex ?? 0]}×`;
    if (!silent) showToast('存档已加载');
  }

  async refreshSaveList() {
    try {
      const saves = await listSaves();
      this.saveList.innerHTML = '';

      if (saves.length === 0) {
        this.saveList.innerHTML = '<p class="hint">暂无存档</p>';
        return;
      }

      for (const save of saves) {
        const item = document.createElement('div');
        item.className = 'save-item';
        item.innerHTML = `
          <div class="save-item-info">
            <span class="save-item-name">${save.name}</span>
            <span class="save-item-meta">${save.year}年 第${save.dayOfYear}天</span>
          </div>
          <button class="save-item-del" title="删除">×</button>
        `;

        item.querySelector('.save-item-info').addEventListener('click', async () => {
          try {
            const data = await loadSave(save.id);
            await this.loadGameState(data.state);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });

        item.querySelector('.save-item-del').addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            await deleteSave(save.id);
            showToast('已删除存档');
            await this.refreshSaveList();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });

        this.saveList.appendChild(item);
      }
    } catch {
      this.saveList.innerHTML = '<p class="hint">无法连接后端</p>';
    }
  }
}

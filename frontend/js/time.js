import { AXIAL_TILT, DAYS_PER_YEAR, HOURS_PER_DAY, clamp, degToRad } from './utils.js';
import { getSeasonForHemisphere, getSeasonLabel } from './seasons.js';

const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

/** Build simulation state from real UTC clock */
export function getRealWorldTime() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((now - jan1) / 86400000) + 1;
  const hourOfDay =
    now.getUTCHours() +
    now.getUTCMinutes() / 60 +
    now.getUTCSeconds() / 3600 +
    now.getUTCMilliseconds() / 3600000;

  return { year, dayOfYear, hourOfDay };
}

export function daysInYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}

export function dayOfYearToCalendar(dayOfYear, year) {
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(dayOfYear);
  return {
    month: date.getUTCMonth() + 1,
    monthName: MONTH_NAMES[date.getUTCMonth()],
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

export function formatUtcClock(hourOfDay, withSeconds = true) {
  const totalSec = Math.floor(hourOfDay * 3600);
  const h = Math.floor(totalSec / 3600) % 24;
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (withSeconds) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatHourMinutes(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Solar sunrise/sunset in UTC hours for given latitude (equinox-adjusted via declination) */
export function getSolarTimes(dayOfYear, latitude = 35) {
  const decl = AXIAL_TILT * Math.cos((2 * Math.PI / DAYS_PER_YEAR) * (dayOfYear - 172));
  const latRad = degToRad(latitude);
  const cosHourAngle = -Math.tan(latRad) * Math.tan(decl);

  if (cosHourAngle <= -1) {
    return { sunrise: 0, sunset: 24, polarDay: true, polarNight: false };
  }
  if (cosHourAngle >= 1) {
    return { sunrise: 12, sunset: 12, polarDay: false, polarNight: true };
  }

  const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI) / 15;
  return {
    sunrise: 12 - hourAngle,
    sunset: 12 + hourAngle,
    polarDay: false,
    polarNight: false,
  };
}

export function getDaylightHours(solar) {
  if (solar.polarDay) return 24;
  if (solar.polarNight) return 0;
  return solar.sunset - solar.sunrise;
}

export function getDayNightPhase(hourOfDay, solar) {
  if (solar.polarDay) {
    return { phase: 'polar-day', label: '极昼', icon: '☀️' };
  }
  if (solar.polarNight) {
    return { phase: 'polar-night', label: '极夜', icon: '🌙' };
  }

  const dawnStart = solar.sunrise - 0.75;
  const dawnEnd = solar.sunrise + 0.5;
  const duskStart = solar.sunset - 0.5;
  const duskEnd = solar.sunset + 0.75;

  if (hourOfDay >= dawnStart && hourOfDay < dawnEnd) {
    return { phase: 'dawn', label: '黎明', icon: '🌅' };
  }
  if (hourOfDay >= dawnEnd && hourOfDay < 12) {
    return { phase: 'day', label: '白天', icon: '☀️' };
  }
  if (hourOfDay >= 12 && hourOfDay < duskStart) {
    return { phase: 'day', label: '白天', icon: '☀️' };
  }
  if (hourOfDay >= duskStart && hourOfDay < duskEnd) {
    return { phase: 'dusk', label: '黄昏', icon: '🌇' };
  }
  return { phase: 'night', label: '黑夜', icon: '🌙' };
}

export function getDayProgress(hourOfDay) {
  return (hourOfDay / HOURS_PER_DAY) * 100;
}

export function getSeasonInfo(dayOfYear) {
  const north = getSeasonForHemisphere(dayOfYear, 'north');
  const south = getSeasonForHemisphere(dayOfYear, 'south');
  return {
    north,
    south,
    northLabel: getSeasonLabel(north),
    southLabel: getSeasonLabel(south),
  };
}

/** Sun direction in world space (Earth at origin, +X = Greenwich noon at equinox baseline) */
export function getSunDirection(dayOfYear, hourOfDay) {
  const decl = AXIAL_TILT * Math.cos((2 * Math.PI / DAYS_PER_YEAR) * (dayOfYear - 172));
  const hourAngle = ((hourOfDay - 12) / 24) * Math.PI * 2;

  const x = Math.cos(decl) * Math.cos(hourAngle);
  const y = Math.sin(decl);
  const z = Math.cos(decl) * Math.sin(hourAngle);

  return { x, y, z, decl, hourAngle };
}

/** Scene sky color by hour (UTC global average) */
export function getSkyColor(hourOfDay, solar) {
  const phase = getDayNightPhase(hourOfDay, solar);
  const palette = {
    'polar-day': [0.04, 0.08, 0.18],
    'polar-night': [0.01, 0.015, 0.04],
    dawn: [0.08, 0.06, 0.14],
    day: [0.04, 0.08, 0.18],
    dusk: [0.07, 0.05, 0.12],
    night: [0.01, 0.015, 0.04],
  };
  const [r, g, b] = palette[phase.phase] || palette.day;

  if (phase.phase === 'dawn' || phase.phase === 'dusk') {
    const edge = phase.phase === 'dawn' ? solar.sunrise : solar.sunset;
    const dist = Math.abs(hourOfDay - edge);
    const t = clamp(1 - dist / 1.5, 0, 1);
    return {
      r: r + t * 0.06,
      g: g + t * 0.04,
      b: b + t * 0.02,
    };
  }
  return { r, g, b };
}

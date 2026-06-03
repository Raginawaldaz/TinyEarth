export const EARTH_RADIUS = 1;
export const AXIAL_TILT = 23.44 * (Math.PI / 180);
export const DAYS_PER_YEAR = 365;
export const HOURS_PER_DAY = 24;

export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

export function latLonToVector3(lat, lon, radius = EARTH_RADIUS) {
  const phi = degToRad(90 - lat);
  const theta = degToRad(lon + 180);
  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function vector3ToLatLon(x, y, z, radius = EARTH_RADIUS) {
  const lat = radToDeg(Math.asin(Math.max(-1, Math.min(1, y / radius))));
  const lon = radToDeg(Math.atan2(z, -x)) - 180;
  return { lat, lon: ((lon + 540) % 360) - 180 };
}

export function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function dayOfYearToDate(dayOfYear, year = 2024) {
  const date = new Date(Date.UTC(year, 0, 1));
  date.setUTCDate(dayOfYear);
  return date;
}

export function formatGameTime(state) {
  const date = dayOfYearToDate(Math.floor(state.dayOfYear), state.year);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = Math.floor(state.hourOfDay);
  const minute = Math.floor((state.hourOfDay % 1) * 60);
  return `${state.year}年${month}月${day}日 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC`;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

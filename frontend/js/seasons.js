import { DAYS_PER_YEAR, AXIAL_TILT, clamp, lerp, smoothstep } from './utils.js';

export const SEASONS = {
  SPRING: 'spring',
  SUMMER: 'summer',
  AUTUMN: 'autumn',
  WINTER: 'winter',
};

const SEASON_LABELS = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
};

/** Approximate season boundaries (northern hemisphere, day of year) */
const SEASON_RANGES = [
  { season: SEASONS.SPRING, start: 79, end: 172 },
  { season: SEASONS.SUMMER, start: 172, end: 266 },
  { season: SEASONS.AUTUMN, start: 266, end: 355 },
  { season: SEASONS.WINTER, start: 355, end: 79 },
];

export function getSeasonForHemisphere(dayOfYear, hemisphere = 'north') {
  let day = dayOfYear;
  if (hemisphere === 'south') {
    day = ((day + DAYS_PER_YEAR / 2 - 1) % DAYS_PER_YEAR) + 1;
  }

  for (const range of SEASON_RANGES) {
    if (range.start <= range.end) {
      if (day >= range.start && day < range.end) return range.season;
    } else {
      if (day >= range.start || day < range.end) return range.season;
    }
  }
  return SEASONS.SPRING;
}

export function getSeasonLabel(season) {
  return SEASON_LABELS[season] || season;
}

/** Sun declination angle in radians (seasonal tilt effect) */
export function getSunDeclination(dayOfYear) {
  return AXIAL_TILT * Math.cos((2 * Math.PI / DAYS_PER_YEAR) * (dayOfYear - 172));
}

/** Fraction of year through current season [0,1] */
export function getSeasonProgress(dayOfYear, hemisphere = 'north') {
  const season = getSeasonForHemisphere(dayOfYear, hemisphere);
  let day = dayOfYear;
  if (hemisphere === 'south') {
    day = ((day + DAYS_PER_YEAR / 2 - 1) % DAYS_PER_YEAR) + 1;
  }

  const range = SEASON_RANGES.find((r) => r.season === season);
  if (!range) return 0;

  let start = range.start;
  let end = range.end;
  if (start > end) {
    if (day >= start) {
      end += DAYS_PER_YEAR;
      if (day < range.end) day += DAYS_PER_YEAR;
    }
  }
  return clamp((day - start) / (end - start), 0, 1);
}

/** Snow cap latitude threshold (degrees from pole); lower = more snow */
export function getSnowLineLatitude(dayOfYear, hemisphere = 'north') {
  const decl = getSunDeclination(dayOfYear);
  const hemiDecl = hemisphere === 'north' ? decl : -decl;
  const winterFactor = clamp(-hemiDecl / AXIAL_TILT, 0, 1);
  return lerp(55, 72, 1 - winterFactor);
}

/** Vegetation color multiplier by season */
export function getVegetationSeasonColor(season, progress) {
  const palettes = {
    spring: { r: 0.55, g: 0.95, b: 0.45 },
    summer: { r: 0.35, g: 0.85, b: 0.3 },
    autumn: { r: 0.95, g: 0.65, b: 0.25 },
    winter: { r: 0.6, g: 0.65, b: 0.55 },
  };

  const nextSeason = {
    spring: SEASONS.SUMMER,
    summer: SEASONS.AUTUMN,
    autumn: SEASONS.WINTER,
    winter: SEASONS.SPRING,
  };

  const current = palettes[season];
  const next = palettes[nextSeason[season]];
  const t = smoothstep(0.7, 1, progress);

  return {
    r: lerp(current.r, next.r, t),
    g: lerp(current.g, next.g, t),
    b: lerp(current.b, next.b, t),
  };
}

/** Leaf density factor by season (winter = bare trees in temperate zones) */
export function getLeafDensity(season, lat) {
  const absLat = Math.abs(lat);
  if (absLat < 23.5) return 1;

  const factors = {
    spring: 0.7,
    summer: 1,
    autumn: 0.5,
    winter: absLat > 45 ? 0.05 : 0.15,
  };
  return factors[season] ?? 1;
}

/** Ambient light warmth by season */
export function getAtmosphereTint(dayOfYear) {
  const decl = getSunDeclination(dayOfYear);
  const warmth = clamp(decl / AXIAL_TILT, -1, 1);
  return {
    r: lerp(0.85, 1.05, warmth * 0.5 + 0.5),
    g: lerp(0.9, 1.0, warmth * 0.5 + 0.5),
    b: lerp(1.1, 0.9, warmth * 0.5 + 0.5),
  };
}

export function getSunAngleDisplay(dayOfYear) {
  const decl = getSunDeclination(dayOfYear);
  return `${(decl * (180 / Math.PI)).toFixed(1)}°`;
}

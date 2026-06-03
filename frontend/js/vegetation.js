import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3, seededRandom, clamp } from './utils.js';
import { getSeasonForHemisphere, getVegetationSeasonColor, getLeafDensity } from './seasons.js';

/** Simplified desert regions [lonMin, lonMax, latMin, latMax] */
const DESERT_REGIONS = [
  [-18, 55, 15, 35],
  [35, 60, 12, 32],
  [-120, -100, 25, 42],
  [110, 145, 18, 35],
  [-70, -35, -35, -20],
  [115, 145, -30, -18],
];

/** Rainforest belts */
const RAINFOREST_REGIONS = [
  [-80, -45, -5, 10],
  [10, 30, -5, 8],
  [95, 140, -5, 8],
  [-155, -135, -5, 5],
];

function isInRegion(lon, lat, regions) {
  return regions.some(([lonMin, lonMax, latMin, latMax]) =>
    lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax
  );
}

function getBiome(lat, lon) {
  const absLat = Math.abs(lat);

  if (isInRegion(lon, lat, DESERT_REGIONS)) return 'desert';
  if (absLat > 66) return 'tundra';
  if (absLat > 55) return 'boreal';
  if (isInRegion(lon, lat, RAINFOREST_REGIONS) || (absLat < 10 && !isInRegion(lon, lat, DESERT_REGIONS))) {
    return 'rainforest';
  }
  if (absLat < 23.5) return 'tropical';
  if (absLat < 45) return 'temperate';
  return 'boreal';
}

function createTreeGeometry(type) {
  if (type === 'palm') {
    const trunk = new THREE.CylinderGeometry(0.003, 0.004, 0.025, 5);
    const leaves = new THREE.ConeGeometry(0.018, 0.035, 6);
    leaves.translate(0, 0.03, 0);
    trunk.translate(0, 0.012, 0);
    return mergeGeometries([trunk, leaves]);
  }

  if (type === 'conifer') {
    const trunk = new THREE.CylinderGeometry(0.002, 0.003, 0.02, 4);
    const crown = new THREE.ConeGeometry(0.012, 0.03, 5);
    crown.translate(0, 0.025, 0);
    trunk.translate(0, 0.01, 0);
    return mergeGeometries([trunk, crown]);
  }

  if (type === 'bush') {
    return new THREE.SphereGeometry(0.008, 5, 4);
  }

  const trunk = new THREE.CylinderGeometry(0.002, 0.003, 0.015, 4);
  const crown = new THREE.SphereGeometry(0.012, 6, 5);
  crown.translate(0, 0.018, 0);
  trunk.translate(0, 0.007, 0);
  return mergeGeometries([trunk, crown]);
}

function mergeGeometries(parts) {
  const merged = new THREE.BufferGeometry();
  const positions = [];
  for (const geo of parts) {
    const pos = geo.attributes.position.array;
    for (let i = 0; i < pos.length; i++) positions.push(pos[i]);
    geo.dispose();
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
}

const BIOME_CONFIG = {
  desert: { types: ['bush'], density: 0.08, maxCount: 200, color: 0x8a9a5a },
  tundra: { types: ['bush'], density: 0.15, maxCount: 400, color: 0x6a8a5a },
  boreal: { types: ['conifer'], density: 0.35, maxCount: 1200, color: 0x2d6a3e },
  temperate: { types: ['deciduous', 'conifer', 'bush'], density: 0.4, maxCount: 1500, color: 0x3a8a40 },
  tropical: { types: ['deciduous', 'palm', 'bush'], density: 0.45, maxCount: 1800, color: 0x2a9a35 },
  rainforest: { types: ['deciduous', 'palm'], density: 0.55, maxCount: 2200, color: 0x1a8a28 },
};

export class VegetationSystem {
  constructor(earthScene, seed = 42) {
    this.earth = earthScene;
    this.seed = seed;
    this.instances = [];
    this.placements = [];
    this.group = new THREE.Group();
    earthScene.addToEarth(this.group);
  }

  async generate() {
    this.clear();
    const rand = seededRandom(this.seed);
    const maxAttempts = 12000;
    const biomeCounts = {};

    for (let i = 0; i < maxAttempts; i++) {
      const lat = rand() * 180 - 90;
      const lon = rand() * 360 - 180;

      if (!this.earth.isLand(lat, lon)) continue;

      const biome = getBiome(lat, lon);
      const config = BIOME_CONFIG[biome];
      biomeCounts[biome] = (biomeCounts[biome] || 0) + 1;

      if (biomeCounts[biome] > config.maxCount) continue;
      if (rand() > config.density) continue;

      const type = config.types[Math.floor(rand() * config.types.length)];
      this.placements.push({ lat, lon, biome, type, scale: 0.8 + rand() * 0.6, rot: rand() * Math.PI * 2 });
    }

    this._buildInstancedMeshes();
    return this.placements.length;
  }

  _buildInstancedMeshes() {
    const byGroup = {};
    for (const p of this.placements) {
      const hemi = p.lat >= 0 ? 'north' : 'south';
      const key = `${p.type}_${hemi}`;
      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(p);
    }

    for (const [key, items] of Object.entries(byGroup)) {
      const type = items[0].type;
      const hemisphere = key.endsWith('_north') ? 'north' : 'south';
      const geo = createTreeGeometry(type);
      const mat = new THREE.MeshLambertMaterial({
        color: 0x3a8a40,
        transparent: true,
      });

      const mesh = new THREE.InstancedMesh(geo, mat, items.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.type = type;
      mesh.userData.hemisphere = hemisphere;

      const dummy = new THREE.Object3D();
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        const pos = latLonToVector3(p.lat, p.lon, EARTH_RADIUS * 1.002);
        dummy.position.set(pos.x, pos.y, pos.z);

        const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, normal);
        dummy.quaternion.copy(quat);
        dummy.rotateOnAxis(normal, p.rot);

        dummy.scale.setScalar(p.scale * 0.04);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.userData.placements = items;
      }

      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
      this.instances.push(mesh);
    }
  }

  updateSeason(dayOfYear) {
    for (const mesh of this.instances) {
      const hemisphere = mesh.userData.hemisphere || 'north';
      const season = getSeasonForHemisphere(dayOfYear, hemisphere);
      const color = getVegetationSeasonColor(season, 0.5);

      mesh.material.color.setRGB(color.r, color.g, color.b);

      const placements = mesh.userData.placements;
      if (placements?.length) {
        let avgOpacity = 0;
        for (const p of placements) {
          avgOpacity += getLeafDensity(season, p.lat);
        }
        mesh.material.opacity = clamp(avgOpacity / placements.length, 0.15, 1);
      }
    }
  }

  setSeed(seed) {
    this.seed = seed;
  }

  clear() {
    for (const mesh of this.instances) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      this.group.remove(mesh);
    }
    this.instances = [];
    this.placements = [];
  }

  getCount() {
    return this.placements.length;
  }
}

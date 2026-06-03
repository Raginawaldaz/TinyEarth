import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EARTH_RADIUS, AXIAL_TILT, latLonToVector3 } from './utils.js';
import { getSunDeclination, getAtmosphereTint, getSnowLineLatitude } from './seasons.js';
import { getSolarTimes } from './time.js';
import { Cosmos } from './cosmos.js';

const TEXTURES = {
  earth: '/assets/earth.jpg',
  bump: '/assets/bump.png',
  clouds: '/assets/clouds.png',
  landMask: '/assets/land-mask.png',
};

const EARTH_VERT = `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAG = `
  uniform sampler2D dayMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  vec3 cityLights(vec3 dayColor, vec2 uv) {
    float land = smoothstep(0.28, 0.42, dayColor.g) * (1.0 - smoothstep(0.1, 0.35, dayColor.b));
    float city = 0.0;
    for (float x = -1.0; x <= 1.0; x += 1.0) {
      for (float y = -1.0; y <= 1.0; y += 1.0) {
        vec2 cell = floor(uv * vec2(720.0, 360.0) + vec2(x, y));
        city += land * step(0.93, hash(cell)) * (0.35 + 0.65 * hash(cell + 1.7));
      }
    }
    return vec3(1.0, 0.82, 0.45) * min(city, 1.0) * 0.45;
  }

  void main() {
    vec3 normal = normalize(vWorldNormal);
    vec3 sunDir = normalize(sunDirection);
    float sunDot = dot(normal, sunDir);

    vec3 dayColor = texture2D(dayMap, vUv).rgb;
    vec3 cities = cityLights(dayColor, vUv);

    float dayMix = smoothstep(-0.1, 0.28, sunDot);
    vec3 nightBase = dayColor * 0.48 + vec3(0.04, 0.05, 0.12);
    vec3 nightColor = nightBase + cities;
    vec3 color = mix(nightColor, dayColor, dayMix);

    float sunLight = smoothstep(-0.15, 0.4, sunDot);
    float ambient = 0.52;
    color *= ambient + sunLight * (1.0 - ambient);

    float moonGlow = smoothstep(0.05, -0.6, sunDot);
    color += vec3(0.12, 0.14, 0.2) * moonGlow * 0.35;

    float twilight = smoothstep(-0.2, 0.08, sunDot) * (1.0 - smoothstep(0.08, 0.35, sunDot));
    color += vec3(0.12, 0.06, 0.16) * twilight;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class EarthScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.landMaskData = null;
    this.landMaskSize = 0;
    this.sunDirection = new THREE.Vector3(1, 0, 0);

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.01,
      200
    );
    this.camera.position.set(0, 0.4, 2.8);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 8;

    this.cosmos = new Cosmos(this.scene);
    this.cosmos.init();

    this.earthGroup = new THREE.Group();
    this.earthGroup.rotation.z = AXIAL_TILT;
    this.scene.add(this.earthGroup);

    this.dayOfYear = 1;
    this.hourOfDay = 12;

    this._setupLights();
  }

  async init() {
    const loader = new THREE.TextureLoader();
    const [earthTex, bumpTex, landMaskTex] = await Promise.all([
      this._loadTexture(loader, TEXTURES.earth),
      this._loadTexture(loader, TEXTURES.bump),
      this._loadTexture(loader, TEXTURES.landMask),
    ]);

    let cloudTex;
    try {
      cloudTex = await this._loadTexture(loader, TEXTURES.clouds);
    } catch {
      cloudTex = this._createCloudTexture();
    }

    await this._buildLandMask(landMaskTex);

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    this.earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        dayMap: { value: earthTex },
        sunDirection: { value: this.sunDirection.clone() },
      },
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
    });

    this.earthMesh = new THREE.Mesh(earthGeo, this.earthMaterial);
    this.earthGroup.add(this.earthMesh);

    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 48, 48);
    this.cloudMaterial = new THREE.MeshLambertMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMaterial);
    this.earthGroup.add(this.cloudMesh);

    this._buildSnowCaps();
    this._buildAtmosphere();

    window.addEventListener('resize', () => this._onResize());
  }

  _loadTexture(loader, url) {
    return new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, () => {
        reject(new Error(`纹理加载失败: ${url}`));
      });
    });
  }

  _createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < img.data.length; i += 4) {
      const n = Math.random();
      const v = Math.floor(180 + n * 60);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(40 + n * 80);
    }
    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
  }

  async _buildLandMask(tex) {
    const img = tex.image;
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    this.landMaskData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    this.landMaskSize = canvas.width;
  }

  isLand(lat, lon) {
    if (!this.landMaskData) return false;
    const u = ((lon + 180) / 360) * this.landMaskSize;
    const v = ((90 - lat) / 180) * this.landMaskSize;
    const x = Math.floor(u) % this.landMaskSize;
    const y = Math.min(this.landMaskSize - 1, Math.max(0, Math.floor(v)));
    const idx = (y * this.landMaskSize + x) * 4;
    return this.landMaskData[idx] < 128;
  }

  _buildSnowCaps() {
    const segments = 64;
    const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.003, segments, segments / 2, 0, Math.PI * 2, 0, Math.PI * 0.18);
    this.snowMaterial = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    this.northSnow = new THREE.Mesh(geo, this.snowMaterial);
    this.earthGroup.add(this.northSnow);

    this.southSnow = this.northSnow.clone();
    this.southSnow.rotation.x = Math.PI;
    this.earthGroup.add(this.southSnow);
  }

  _buildAtmosphere() {
    const geo = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 32, 32);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        void main() {
          float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
          gl_FragColor = vec4(glowColor, intensity * 0.5);
        }
      `,
      uniforms: {
        glowColor: { value: new THREE.Color(0x4488ff) },
      },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(geo, mat);
    this.scene.add(this.atmosphere);
  }

  _setupLights() {
    this.ambientLight = new THREE.AmbientLight(0x4466aa, 0.28);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
    this.scene.add(this.sunLight);

    this.moonLight = new THREE.DirectionalLight(0x8899bb, 0.12);
    this.scene.add(this.moonLight);
  }

  updateSeason(dayOfYear, hourOfDay) {
    this.dayOfYear = dayOfYear;
    this.hourOfDay = hourOfDay;

    const decl = getSunDeclination(dayOfYear);
    this.sunDirection.set(Math.cos(decl), Math.sin(decl), 0).normalize();

    this.sunLight.position.copy(this.sunDirection).multiplyScalar(10);
    this.moonLight.position.copy(this.sunDirection).multiplyScalar(-8);

    this.earthMaterial.uniforms.sunDirection.value.copy(this.sunDirection);
    this.cosmos.update(this.sunDirection, hourOfDay);

    const solar = getSolarTimes(dayOfYear, 35);
    const isNight = hourOfDay < solar.sunrise || hourOfDay >= solar.sunset;
    this.ambientLight.intensity = isNight ? 0.22 : 0.32;
    this.moonLight.intensity = isNight ? 0.18 : 0.08;

    const tint = getAtmosphereTint(dayOfYear);
    this.atmosphere.material.uniforms.glowColor.value.setRGB(
      0.25 * tint.b,
      0.45 * tint.g,
      0.85 * tint.r
    );

    const northSnowLine = getSnowLineLatitude(dayOfYear, 'north');
    const southSnowLine = getSnowLineLatitude(dayOfYear, 'south');
    this.northSnow.scale.set(1, Math.max(0.15, ((90 - northSnowLine) / 90) * 1.2), 1);
    this.southSnow.scale.set(1, Math.max(0.15, ((90 - southSnowLine) / 90) * 1.2), 1);

    this.cloudMaterial.opacity = 0.28 + 0.12 * Math.sin((dayOfYear / 365) * Math.PI * 2);

    this.earthGroup.rotation.y = ((hourOfDay - 12) / 24) * Math.PI * 2;
  }

  getSurfaceNormal(lat, lon) {
    const v = latLonToVector3(lat, lon, 1);
    return new THREE.Vector3(v.x, v.y, v.z).normalize();
  }

  addToEarth(object) {
    this.earthGroup.add(object);
  }

  render() {
    this.controls.update();
    this.cloudMesh.rotation.y += 0.0002;
    this.renderer.render(this.scene, this.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}

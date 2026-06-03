import * as THREE from 'three';

const SKY_RADIUS = 80;

function createSkyTexture() {
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#020818');
  grad.addColorStop(0.35, '#050d22');
  grad.addColorStop(0.55, '#0a1230');
  grad.addColorStop(0.75, '#12082a');
  grad.addColorStop(1, '#020818');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const b = 120 + Math.random() * 135;
    const a = 0.15 + Math.random() * 0.85;
    const r = Math.random() < 0.08 ? 1.2 : 0.6;
    ctx.fillStyle = `rgba(${b},${b},${Math.floor(b * 1.05)},${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(w * 0.5, h * 0.55);
  ctx.rotate(-0.35);
  const band = ctx.createLinearGradient(-w * 0.6, 0, w * 0.6, 0);
  band.addColorStop(0, 'rgba(80,100,180,0)');
  band.addColorStop(0.25, 'rgba(120,140,220,0.06)');
  band.addColorStop(0.45, 'rgba(200,210,255,0.14)');
  band.addColorStop(0.55, 'rgba(200,210,255,0.14)');
  band.addColorStop(0.75, 'rgba(120,140,220,0.06)');
  band.addColorStop(1, 'rgba(80,100,180,0)');
  ctx.fillStyle = band;
  ctx.fillRect(-w * 0.55, -h * 0.08, w * 1.1, h * 0.16);
  ctx.restore();

  for (let i = 0; i < 12; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const rad = 40 + Math.random() * 120;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const hue = Math.random() < 0.5 ? '80,60,160' : '40,80,140';
    g.addColorStop(0, `rgba(${hue},0.12)`);
    g.addColorStop(1, `rgba(${hue},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMoonTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(size * 0.38, size * 0.35, size * 0.05, size * 0.5, size * 0.5, size * 0.5);
  grad.addColorStop(0, '#d8d8e0');
  grad.addColorStop(0.6, '#a8a8b0');
  grad.addColorStop(1, '#686870');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 85; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 28;
    ctx.fillStyle = `rgba(${50 + Math.random() * 40},${50 + Math.random() * 40},${55 + Math.random() * 40},${0.25 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 40; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 6;
    ctx.fillStyle = `rgba(90,90,100,${0.2 + Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Cosmos {
  constructor(scene) {
    this.scene = scene;
    this.sunDirection = new THREE.Vector3(1, 0, 0);
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  init() {
    this._buildSkybox();
    this._buildStarfield();
    this._buildSun();
    this._buildMoon();
  }

  _buildSkybox() {
    const tex = createSkyTexture();
    const geo = new THREE.SphereGeometry(SKY_RADIUS, 48, 32);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skybox = new THREE.Mesh(geo, mat);
    this.group.add(this.skybox);
  }

  _buildStarfield() {
    const count = 3500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const r = SKY_RADIUS * 0.92;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const tint = 0.75 + Math.random() * 0.25;
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint * (0.9 + Math.random() * 0.1);
      colors[i * 3 + 2] = tint * (0.95 + Math.random() * 0.15);
      sizes[i] = 0.04 + Math.random() * 0.12;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    this.stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.1,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    this.group.add(this.stars);
  }

  _buildSun() {
    this.sunGroup = new THREE.Group();

    const coreGeo = new THREE.SphereGeometry(0.42, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff8e8 });
    this.sunCore = new THREE.Mesh(coreGeo, coreMat);
    this.sunGroup.add(this.sunCore);

    const glowLayers = [
      { radius: 0.55, color: 0xffeeaa, opacity: 0.35 },
      { radius: 0.75, color: 0xffcc66, opacity: 0.18 },
      { radius: 1.05, color: 0xff9933, opacity: 0.08 },
    ];

    for (const layer of glowLayers) {
      const geo = new THREE.SphereGeometry(layer.radius, 24, 24);
      const mat = new THREE.MeshBasicMaterial({
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.sunGroup.add(new THREE.Mesh(geo, mat));
    }

    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 128;
    spriteCanvas.height = 128;
    const sctx = spriteCanvas.getContext('2d');
    const sg = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sg.addColorStop(0, 'rgba(255,240,200,0.9)');
    sg.addColorStop(0.2, 'rgba(255,200,100,0.5)');
    sg.addColorStop(0.5, 'rgba(255,150,50,0.15)');
    sg.addColorStop(1, 'rgba(255,100,0,0)');
    sctx.fillStyle = sg;
    sctx.fillRect(0, 0, 128, 128);
    const spriteTex = new THREE.CanvasTexture(spriteCanvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: spriteTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sunFlare = new THREE.Sprite(spriteMat);
    this.sunFlare.scale.set(4, 4, 1);
    this.sunGroup.add(this.sunFlare);

    this.group.add(this.sunGroup);
  }

  _buildMoon() {
    this.moonGroup = new THREE.Group();
    const tex = createMoonTexture();
    const geo = new THREE.SphereGeometry(0.09, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.95,
      metalness: 0.02,
      emissive: 0x111118,
      emissiveIntensity: 0.15,
    });
    this.moonMesh = new THREE.Mesh(geo, mat);
    this.moonGroup.add(this.moonMesh);

    const haloGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xaabbcc,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    this.moonGroup.add(new THREE.Mesh(haloGeo, haloMat));
    this.group.add(this.moonGroup);
  }

  update(sunDirection, hourOfDay) {
    this.sunDirection.copy(sunDirection).normalize();

    const sunDist = 22;
    this.sunGroup.position.copy(this.sunDirection).multiplyScalar(sunDist);

    const moonDist = 3.6;
    const moonDir = this.sunDirection.clone().negate();
    this.moonGroup.position.copy(moonDir.multiplyScalar(moonDist));

    const phase = 0.5 + 0.5 * Math.cos(((hourOfDay - 12) / 24) * Math.PI * 2);
    this.moonMesh.material.emissiveIntensity = 0.1 + phase * 0.12;

    const dayFactor = Math.max(0, this.sunDirection.y * 0.5 + 0.5);
    this.stars.material.opacity = 0.35 + (1 - dayFactor) * 0.6;
    this.skybox.material.opacity = 1;
  }
}

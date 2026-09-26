import * as THREE from 'three';

interface SkidQuad {
  active: boolean;
  alpha: number;
  matrix: THREE.Matrix4;
}

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  size: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
  opacity: number;
}

export class SkidManager {
  private scene: THREE.Scene;

  // Skid Marks via InstancedMesh for 60fps performance
  private maxSkidSegments = 800;
  private skidMesh: THREE.InstancedMesh;
  private skidQuads: SkidQuad[] = [];
  private skidHead = 0;
  private lastLeftPos: THREE.Vector3 | null = null;
  private lastRightPos: THREE.Vector3 | null = null;
  private minDistanceBetweenSkids = 0.45;

  // Soft Procedural Particle System (Tire Smoke, Dust, Water Spray)
  // Dramatic volumetric drift tire smoke matching realistic racing simulators!
  private maxParticles = 800;
  private particleGeo: THREE.BufferGeometry;
  private particleMat: THREE.PointsMaterial;
  private particlePoints: THREE.Points;
  private particles: Particle[] = [];
  private particlePositions: Float32Array;
  private particleColors: Float32Array;
  private smokeTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Skid marks instanced mesh (thin rubber ribbon laying flush on pavement)
    const quadGeo = new THREE.PlaneGeometry(0.32, 0.65);
    quadGeo.rotateX(-Math.PI / 2);

    const quadMat = new THREE.MeshBasicMaterial({
      color: 0x141414,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -4.0,
    });

    this.skidMesh = new THREE.InstancedMesh(quadGeo, quadMat, this.maxSkidSegments);
    this.skidMesh.frustumCulled = false;

    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.maxSkidSegments; i++) {
      this.skidQuads.push({
        active: false,
        alpha: 0,
        matrix: new THREE.Matrix4(),
      });
      this.skidMesh.setMatrixAt(i, zeroMatrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.skidMesh);

    // 2. Procedural soft radial gradient particle texture
    this.smokeTexture = this.createSoftParticleTexture();

    // 3. Smoke & Spray particle system with smooth alpha blending
    this.particlePositions = new Float32Array(this.maxParticles * 3);
    this.particleColors = new Float32Array(this.maxParticles * 3);

    this.particleGeo = new THREE.BufferGeometry();
    this.particleGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    this.particleGeo.setAttribute('color', new THREE.BufferAttribute(this.particleColors, 3));

    this.particleMat = new THREE.PointsMaterial({
      size: 2.2,
      map: this.smokeTexture,
      transparent: true,
      opacity: 0.9,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.particlePoints = new THREE.Points(this.particleGeo, this.particleMat);
    this.particlePoints.frustumCulled = false;
    this.scene.add(this.particlePoints);
  }

  /**
   * Generates a high-quality soft circular radial blur texture.
   * Completely eliminates square block artifacts from Three.js PointsMaterial!
   */
  private createSoftParticleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.25)');
      grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.08)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  public addSkidMark(leftTire: THREE.Vector3, rightTire: THREE.Vector3, heading: number) {
    // Left tire skid
    if (!this.lastLeftPos || this.lastLeftPos.distanceTo(leftTire) >= this.minDistanceBetweenSkids) {
      this.spawnQuad(leftTire, heading);
      this.lastLeftPos = leftTire.clone();
    }

    // Right tire skid
    if (!this.lastRightPos || this.lastRightPos.distanceTo(rightTire) >= this.minDistanceBetweenSkids) {
      this.spawnQuad(rightTire, heading);
      this.lastRightPos = rightTire.clone();
    }
  }

  private spawnQuad(pos: THREE.Vector3, heading: number) {
    const idx = this.skidHead;
    this.skidHead = (this.skidHead + 1) % this.maxSkidSegments;

    const dummy = new THREE.Object3D();
    dummy.position.set(pos.x, 0.028, pos.z);
    dummy.rotation.y = heading;
    dummy.updateMatrix();

    this.skidQuads[idx].active = true;
    this.skidQuads[idx].alpha = 0.85;
    this.skidQuads[idx].matrix.copy(dummy.matrix);

    this.skidMesh.setMatrixAt(idx, dummy.matrix);
    this.skidMesh.instanceMatrix.needsUpdate = true;
  }

  /**
   * Emits soft realistic tire smoke or water spray.
   */
  public emitTireSmoke(pos: THREE.Vector3, count: number = 2, isRain: boolean = false) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.45,
        0.1 + Math.random() * 0.15,
        (Math.random() - 0.5) * 0.45
      );

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2.2,
        0.8 + Math.random() * 1.4,
        (Math.random() - 0.5) * 2.2
      );

      const color = isRain
        ? new THREE.Color(0xa5c4e8) // Bluish rain mist
        : new THREE.Color(0xf5f8fa); // Pure billowy white drift smoke

      this.particles.push({
        pos: pos.clone().add(offset),
        vel,
        size: isRain ? 0.8 : 1.8,
        life: 0,
        maxLife: isRain ? 0.5 : 1.1,
        color,
        opacity: isRain ? 0.45 : 0.85,
      });
    }
  }

  /**
   * Emits subtle off-road dust when driving on grass or gravel.
   */
  public emitOffroadDust(pos: THREE.Vector3, count: number = 2) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        0.05 + Math.random() * 0.1,
        (Math.random() - 0.5) * 0.5
      );

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        0.8 + Math.random() * 1.2,
        (Math.random() - 0.5) * 1.8
      );

      // Sandy/brownish dust color
      const color = new THREE.Color(0x8a7258);

      this.particles.push({
        pos: pos.clone().add(offset),
        vel,
        size: 1.2,
        life: 0,
        maxLife: 0.7,
        color,
        opacity: 0.6,
      });
    }
  }

  public update(dt: number) {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.pos.addScaledVector(p.vel, dt);
      p.vel.y += 0.35 * dt; // buoyant smoke plume rise
      p.vel.multiplyScalar(0.93); // aerodynamic drag
      p.size += dt * 1.8; // expanding puffy smoke cloud
    }

    // Write to particle buffer
    const pCount = this.particles.length;
    for (let i = 0; i < pCount; i++) {
      const p = this.particles[i];
      const idx = i * 3;
      this.particlePositions[idx + 0] = p.pos.x;
      this.particlePositions[idx + 1] = p.pos.y;
      this.particlePositions[idx + 2] = p.pos.z;

      const fade = Math.max(0, 1 - p.life / p.maxLife);
      const intensity = p.opacity * fade;
      this.particleColors[idx + 0] = p.color.r * intensity;
      this.particleColors[idx + 1] = p.color.g * intensity;
      this.particleColors[idx + 2] = p.color.b * intensity;
    }

    // Clear remainder of buffer
    for (let i = pCount; i < this.maxParticles; i++) {
      const idx = i * 3;
      this.particlePositions[idx + 0] = 0;
      this.particlePositions[idx + 1] = -100;
      this.particlePositions[idx + 2] = 0;
      this.particleColors[idx + 0] = 0;
      this.particleColors[idx + 1] = 0;
      this.particleColors[idx + 2] = 0;
    }

    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;
  }
}

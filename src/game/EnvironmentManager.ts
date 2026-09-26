import * as THREE from 'three';
import { WeatherSettings, WeatherType } from '../types';
import { WEATHER_PRESETS } from '../constants';

export class EnvironmentManager {
  public scene: THREE.Scene;
  public currentWeather: WeatherType = 'sunny';
  public targetWeather: WeatherType = 'sunny';
  private transitionAlpha: number = 1.0;
  private transitionDuration: number = 4.0; // 4 seconds smooth transition
  private transitionTimer: number = 4.0;

  // Active interpolated parameters
  private activeSkyColor: THREE.Color = new THREE.Color();
  private activeHorizonColor: THREE.Color = new THREE.Color();
  private activeSunColor: THREE.Color = new THREE.Color();
  private activeSunIntensity: number = 1.25;
  private activeSunPos: THREE.Vector3 = new THREE.Vector3();
  private activeAmbientColor: THREE.Color = new THREE.Color();
  private activeAmbientIntensity: number = 0.42;
  private activeHemiSkyColor: THREE.Color = new THREE.Color();
  private activeHemiGroundColor: THREE.Color = new THREE.Color();
  private activeHemiIntensity: number = 0.35;
  private activeFogColor: THREE.Color = new THREE.Color();
  private activeFogDensity: number = 0.0022;
  public rainIntensity: number = 0;
  public roadWetness: number = 0;

  // Lights
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;
  public skyMesh: THREE.Mesh;

  // Rain particle system
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainMaterial: THREE.PointsMaterial | null = null;
  private rainPoints: THREE.Points | null = null;
  private rainPositions: Float32Array = new Float32Array(0);
  private rainVelocities: Float32Array = new Float32Array(0);
  private readonly rainCount = 2200;

  // Time of day (in hours, e.g. 14.5 = 14:30)
  public gameTimeHours: number = 14.0;
  public timeSpeed: number = 0.04; // 1 real sec = ~2.4 in-game minutes
  public autoCycleTime: boolean = true;
  public autoCycleWeather: boolean = true;
  private weatherTimer: number = 0;
  private nextWeatherChange: number = 75; // Change weather every 75-120 seconds

  // Materials to update wetness and night illumination
  public roadMaterials: THREE.MeshStandardMaterial[] = [];
  public streetLightMaterials: THREE.MeshBasicMaterial[] = [];
  public windowMaterials: THREE.MeshStandardMaterial[] = [];
  public lightPoolMaterials: THREE.MeshBasicMaterial[] = [];
  public neonMaterials: THREE.MeshBasicMaterial[] = [];
  public cityTheme: string = 'metropolis';

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Initialize lights with crisp, realistic values (Balanced, natural daylight without harsh glare)
    this.ambientLight = new THREE.AmbientLight(0xdceeff, 0.50);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x8fc4f8, 0x5b7055, 0.40);
    this.hemiLight.position.set(0, 100, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff8e8, 1.5);
    this.sunLight.position.set(150, 220, 100);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 450;
    const shadowD = 120;
    this.sunLight.shadow.camera.left = -shadowD;
    this.sunLight.shadow.camera.right = shadowD;
    this.sunLight.shadow.camera.top = shadowD;
    this.sunLight.shadow.camera.bottom = -shadowD;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);

    // Realistic scene fog (crisp distance haze)
    this.scene.fog = new THREE.FogExp2(0x94c8f5, 0.0012);

    // Procedural Sky Dome
    this.skyMesh = this.createSkyDome();
    this.scene.add(this.skyMesh);

    // Rain particles
    this.initRain();

    // Set initial values
    this.applyWeatherInstant('sunny');
  }

  private createSkyDome(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(750, 32, 24);
    geo.scale(-1, 1, 1); // Invert faces inward

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1e6fd9) },
        bottomColor: { value: new THREE.Color(0xa4d4ff) },
        offset: { value: 15.0 },
        exponent: { value: 0.65 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  private createRainDropTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(8, 0, 8, 64);
      grad.addColorStop(0, 'rgba(180, 215, 255, 0.0)');
      grad.addColorStop(0.3, 'rgba(180, 215, 255, 0.4)');
      grad.addColorStop(0.85, 'rgba(215, 235, 255, 0.9)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 1.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(8, 32, 4, 30, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  private initRain() {
    this.rainGeometry = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);
    this.rainVelocities = new Float32Array(this.rainCount);

    const spread = 90;
    const heightSpread = 50;

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3 + 0] = (Math.random() - 0.5) * spread;
      this.rainPositions[i * 3 + 1] = Math.random() * heightSpread + 1;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      this.rainVelocities[i] = 40 + Math.random() * 25; // m/s down
    }

    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    // Phase 10: Procedural smooth soft raindrop texture prevents square blocks
    const dropTexture = this.createRainDropTexture();

    this.rainMaterial = new THREE.PointsMaterial({
      color: 0xc4dcfa,
      size: 0.75,
      map: dropTexture,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.rainPoints = new THREE.Points(this.rainGeometry, this.rainMaterial);
    this.rainPoints.frustumCulled = false;
    this.scene.add(this.rainPoints);
  }

  public setWeather(weather: WeatherType, duration: number = 3.5) {
    if (this.currentWeather === weather && this.transitionAlpha >= 1.0) return;
    this.targetWeather = weather;
    this.transitionDuration = Math.max(0.5, duration);
    this.transitionTimer = 0;
    this.transitionAlpha = 0;
  }

  public applyWeatherInstant(weather: WeatherType) {
    this.currentWeather = weather;
    this.targetWeather = weather;
    this.transitionAlpha = 1.0;
    this.transitionTimer = this.transitionDuration;

    const preset = WEATHER_PRESETS[weather];
    this.activeSkyColor.setHex(preset.skyColor);
    this.activeHorizonColor.setHex(preset.horizonColor);
    this.activeSunColor.setHex(preset.sunColor);
    this.activeSunIntensity = preset.sunIntensity;
    this.activeSunPos.set(preset.sunPosition[0], preset.sunPosition[1], preset.sunPosition[2]);
    this.activeAmbientColor.setHex(preset.ambientColor);
    this.activeAmbientIntensity = preset.ambientIntensity;
    this.activeHemiSkyColor.setHex(preset.hemiSkyColor);
    this.activeHemiGroundColor.setHex(preset.hemiGroundColor);
    this.activeHemiIntensity = preset.hemiIntensity;
    this.activeFogColor.setHex(preset.fogColor);
    this.activeFogDensity = preset.fogDensity;
    this.rainIntensity = preset.rainIntensity;
    this.roadWetness = preset.roadWetness;

    this.updateRenderParams();
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    // 1. In-Game Clock update
    if (this.autoCycleTime) {
      this.gameTimeHours = (this.gameTimeHours + dt * this.timeSpeed) % 24;

      // Check if time-based weather sync is needed
      if (this.autoCycleWeather) {
        this.weatherTimer += dt;
        if (this.weatherTimer >= this.nextWeatherChange) {
          this.weatherTimer = 0;
          this.nextWeatherChange = 70 + Math.random() * 50;
          this.advanceNextWeather();
        }
      }
    }

    // 2. Weather transition interpolation
    if (this.transitionAlpha < 1.0) {
      this.transitionTimer += dt;
      this.transitionAlpha = Math.min(1.0, this.transitionTimer / this.transitionDuration);

      const src = WEATHER_PRESETS[this.currentWeather];
      const dst = WEATHER_PRESETS[this.targetWeather];
      const t = this.transitionAlpha;

      // Smooth step
      const smoothT = t * t * (3 - 2 * t);

      this.activeSkyColor.lerpColors(new THREE.Color(src.skyColor), new THREE.Color(dst.skyColor), smoothT);
      this.activeHorizonColor.lerpColors(new THREE.Color(src.horizonColor), new THREE.Color(dst.horizonColor), smoothT);
      this.activeSunColor.lerpColors(new THREE.Color(src.sunColor), new THREE.Color(dst.sunColor), smoothT);
      this.activeSunIntensity = THREE.MathUtils.lerp(src.sunIntensity, dst.sunIntensity, smoothT);

      const srcPos = new THREE.Vector3(...src.sunPosition);
      const dstPos = new THREE.Vector3(...dst.sunPosition);
      this.activeSunPos.lerpVectors(srcPos, dstPos, smoothT);

      this.activeAmbientColor.lerpColors(new THREE.Color(src.ambientColor), new THREE.Color(dst.ambientColor), smoothT);
      this.activeAmbientIntensity = THREE.MathUtils.lerp(src.ambientIntensity, dst.ambientIntensity, smoothT);

      this.activeHemiSkyColor.lerpColors(new THREE.Color(src.hemiSkyColor), new THREE.Color(dst.hemiSkyColor), smoothT);
      this.activeHemiGroundColor.lerpColors(new THREE.Color(src.hemiGroundColor), new THREE.Color(dst.hemiGroundColor), smoothT);
      this.activeHemiIntensity = THREE.MathUtils.lerp(src.hemiIntensity, dst.hemiIntensity, smoothT);

      this.activeFogColor.lerpColors(new THREE.Color(src.fogColor), new THREE.Color(dst.fogColor), smoothT);
      this.activeFogDensity = THREE.MathUtils.lerp(src.fogDensity, dst.fogDensity, smoothT);

      this.rainIntensity = THREE.MathUtils.lerp(src.rainIntensity, dst.rainIntensity, smoothT);
      this.roadWetness = THREE.MathUtils.lerp(src.roadWetness, dst.roadWetness, smoothT);

      if (this.transitionAlpha >= 1.0) {
        this.currentWeather = this.targetWeather;
      }
    }

    // 3. Apply active params to Three.js elements
    this.updateRenderParams();

    // 4. Update rain particles around player
    this.updateRainParticles(dt, playerPos);

    // 5. Update road wetness
    this.updateRoadMaterials();

    // 6. Sky follows player position
    this.skyMesh.position.set(playerPos.x, 0, playerPos.z);
    this.sunLight.target.position.set(playerPos.x, 0, playerPos.z);
    this.sunLight.target.updateMatrixWorld();
  }

  private advanceNextWeather() {
    const cycle: WeatherType[] = ['sunny', 'cloudy', 'sunset', 'night', 'rain', 'sunny'];
    const currentIndex = cycle.indexOf(this.currentWeather);
    const nextIndex = (currentIndex + 1) % cycle.length;
    this.setWeather(cycle[nextIndex], 4.5);
  }

  private updateRenderParams() {
    this.ambientLight.color.copy(this.activeAmbientColor);
    this.ambientLight.intensity = this.activeAmbientIntensity;

    this.hemiLight.color.copy(this.activeHemiSkyColor);
    this.hemiLight.groundColor.copy(this.activeHemiGroundColor);
    this.hemiLight.intensity = this.activeHemiIntensity;

    this.sunLight.color.copy(this.activeSunColor);
    this.sunLight.intensity = this.activeSunIntensity;
    this.sunLight.position.copy(this.activeSunPos);

    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.activeFogColor);
      this.scene.fog.density = this.activeFogDensity;
    }

    if (this.skyMesh && this.skyMesh.material instanceof THREE.ShaderMaterial) {
      this.skyMesh.material.uniforms.topColor.value.copy(this.activeSkyColor);
      this.skyMesh.material.uniforms.bottomColor.value.copy(this.activeHorizonColor);
    }

    // Street lights glow & window lights
    const isNightOrDark = this.currentWeather === 'night' || this.currentWeather === 'sunset' || this.currentWeather === 'rain';
    for (const mat of this.streetLightMaterials) {
      mat.color.setHex(isNightOrDark ? 0xffea9f : 0x444444);
    }
    for (const mat of this.windowMaterials) {
      mat.emissiveIntensity = isNightOrDark ? 0.95 : 0.08;
    }
    // Warm ground light pools beneath street lamps
    const poolOpacity = isNightOrDark ? (this.currentWeather === 'night' ? 0.65 : 0.45) : 0.02;
    for (const mat of this.lightPoolMaterials) {
      mat.opacity = poolOpacity;
    }
    // Neon signage glow
    for (const mat of this.neonMaterials) {
      // In daylight still visible, but at night super bright
      mat.opacity = isNightOrDark ? 1.0 : 0.85;
    }
  }

  public setCityTheme(theme: string) {
    this.cityTheme = theme;
    if (theme === 'cyberpunk') {
      this.setWeather('night', 1.0);
      this.activeAmbientColor.setHex(0x102b48);
      this.activeFogColor.setHex(0x120c24);
      this.activeFogDensity = 0.0028;
      this.roadWetness = 0.4;
    } else if (theme === 'sunset') {
      this.setWeather('sunset', 1.0);
      this.roadWetness = 0.0;
    } else if (theme === 'tokyo') {
      this.setWeather('rain', 1.0);
      this.roadWetness = 0.9;
    } else if (theme === 'noir') {
      this.setWeather('cloudy', 1.0);
      this.activeFogColor.setHex(0x333333);
      this.activeAmbientColor.setHex(0x444444);
    } else {
      this.setWeather('sunny', 1.0);
      this.roadWetness = 0.0;
    }
  }

  private updateRainParticles(dt: number, playerPos: THREE.Vector3) {
    if (!this.rainPoints || !this.rainMaterial || !this.rainGeometry) return;

    // Fade rain opacity according to rain intensity
    this.rainMaterial.opacity = this.rainIntensity * 0.75;
    if (this.rainIntensity <= 0.01) {
      this.rainPoints.visible = false;
      return;
    }
    this.rainPoints.visible = true;

    const spread = 85;
    const heightSpread = 45;
    const pos = this.rainPositions;

    for (let i = 0; i < this.rainCount; i++) {
      const idx = i * 3;
      pos[idx + 1] -= this.rainVelocities[i] * dt;

      // Wrap vertically and keep centered on player
      if (pos[idx + 1] < 0.2) {
        pos[idx + 0] = playerPos.x + (Math.random() - 0.5) * spread;
        pos[idx + 1] = playerPos.y + Math.random() * heightSpread + 10;
        pos[idx + 2] = playerPos.z + (Math.random() - 0.5) * spread;
      }

      // Re-center horizontally if player drove away
      if (Math.abs(pos[idx + 0] - playerPos.x) > spread * 0.6) {
        pos[idx + 0] = playerPos.x + (Math.random() - 0.5) * spread;
      }
      if (Math.abs(pos[idx + 2] - playerPos.z) > spread * 0.6) {
        pos[idx + 2] = playerPos.z + (Math.random() - 0.5) * spread;
      }
    }

    this.rainGeometry.attributes.position.needsUpdate = true;
  }

  private updateRoadMaterials() {
    // In rain: road roughness drops (0.85 -> 0.18 glossy), metalness rises (0.05 -> 0.45), color darkens
    const wet = this.roadWetness;
    const roughness = THREE.MathUtils.lerp(0.85, 0.22, wet);
    const metalness = THREE.MathUtils.lerp(0.05, 0.45, wet);

    for (const mat of this.roadMaterials) {
      mat.roughness = roughness;
      mat.metalness = metalness;
      // Darken asphalt when wet
      if (wet > 0.05) {
        mat.color.setRGB(
          THREE.MathUtils.lerp(0.2, 0.08, wet),
          THREE.MathUtils.lerp(0.2, 0.08, wet),
          THREE.MathUtils.lerp(0.22, 0.09, wet)
        );
      } else {
        mat.color.setHex(0x282c34);
      }
    }
  }

  public getFormattedTime(): string {
    const hours = Math.floor(this.gameTimeHours);
    const minutes = Math.floor((this.gameTimeHours - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
}

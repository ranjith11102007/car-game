import * as THREE from 'three';
import { CameraView } from '../types';
import { Vehicle } from './Vehicle';
import { CollisionObstacle } from './CityBuilder';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public viewMode: CameraView = 'chase';

  private currentTarget: THREE.Vector3 = new THREE.Vector3();
  private currentPosition: THREE.Vector3 = new THREE.Vector3();
  private smoothedHeading: number = 0;
  private initialized: boolean = false;

  // Drift swing offset
  private driftLagAngle: number = 0;

  // Camera Shake
  private shakeIntensity: number = 0;

  // Photo Mode State
  public isPhotoMode: boolean = false;
  public photoYaw: number = 0;
  public photoPitch: number = 0.22;
  public photoDistance: number = 5.6;
  public photoHeightOffset: number = 0.9;
  public photoFov: number = 46;
  public photoRoll: number = 0; // In radians
  public photoTargetOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0);

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public setViewMode(mode: CameraView) {
    this.viewMode = mode;
  }

  public nextViewMode() {
    const modes: CameraView[] = ['chase', 'close', 'hood', 'top'];
    const idx = modes.indexOf(this.viewMode);
    this.viewMode = modes[(idx + 1) % modes.length];
  }

  public triggerShake(intensity: number = 0.35) {
    this.shakeIntensity = Math.min(0.65, this.shakeIntensity + intensity);
  }

  // --- Photo Mode Controls ---
  public enterPhotoMode(vehicle: Vehicle) {
    this.isPhotoMode = true;
    this.photoYaw = vehicle.heading + 0.35; // Three-quarter front-side hero angle
    this.photoPitch = 0.24;
    this.photoDistance = 5.5;
    this.photoHeightOffset = 0.85;
    this.photoFov = 46;
    this.photoRoll = 0;
    this.photoTargetOffset.set(0, 0, 0);
  }

  public exitPhotoMode() {
    this.isPhotoMode = false;
    this.camera.fov = 72;
    this.camera.updateProjectionMatrix();
  }

  public orbit(deltaYaw: number, deltaPitch: number) {
    this.photoYaw += deltaYaw;
    this.photoPitch = THREE.MathUtils.clamp(this.photoPitch + deltaPitch, -0.15, 1.45);
  }

  public zoom(deltaDistance: number) {
    this.photoDistance = THREE.MathUtils.clamp(this.photoDistance + deltaDistance, 2.0, 30.0);
  }

  public pan(deltaRight: number, deltaUp: number) {
    // Pan in camera plane
    const right = new THREE.Vector3(Math.cos(this.photoYaw), 0, -Math.sin(this.photoYaw));
    this.photoTargetOffset.addScaledVector(right, deltaRight);
    this.photoTargetOffset.y = THREE.MathUtils.clamp(this.photoTargetOffset.y + deltaUp, -2.0, 10.0);
  }

  public setFov(fov: number) {
    this.photoFov = THREE.MathUtils.clamp(fov, 18, 95);
    this.camera.fov = this.photoFov;
    this.camera.updateProjectionMatrix();
  }

  public setRoll(rollDegrees: number) {
    this.photoRoll = THREE.MathUtils.degToRad(rollDegrees);
  }

  public setHeightOffset(h: number) {
    this.photoHeightOffset = THREE.MathUtils.clamp(h, 0.2, 5.0);
  }

  public resetPhotoCamera(vehicle: Vehicle) {
    this.enterPhotoMode(vehicle);
  }

  public update(dt: number, vehicle: Vehicle, obstacles?: CollisionObstacle[]) {
    // -------------------------------------------------------------
    // PHOTO MODE FREE CAMERA (Phase: Photo Mode)
    // -------------------------------------------------------------
    if (this.isPhotoMode) {
      const focusBase = vehicle.position.clone();
      const lookTarget = focusBase.clone().add(this.photoTargetOffset).add(new THREE.Vector3(0, this.photoHeightOffset, 0));

      const cosP = Math.cos(this.photoPitch);
      const sinP = Math.sin(this.photoPitch);
      const camOffset = new THREE.Vector3(
        Math.sin(this.photoYaw) * cosP * this.photoDistance,
        sinP * this.photoDistance,
        Math.cos(this.photoYaw) * cosP * this.photoDistance
      );

      const desiredPos = lookTarget.clone().add(camOffset);
      desiredPos.y = Math.max(0.35, desiredPos.y); // Prevent going underground

      this.currentPosition.lerp(desiredPos, Math.min(1.0, dt * 18));
      this.currentTarget.lerp(lookTarget, Math.min(1.0, dt * 18));

      this.camera.fov = this.photoFov;
      this.camera.updateProjectionMatrix();
      this.camera.position.copy(this.currentPosition);
      this.camera.lookAt(this.currentTarget);

      if (Math.abs(this.photoRoll) > 0.001) {
        this.camera.rotateZ(this.photoRoll);
      }
      return;
    }

    // -------------------------------------------------------------
    // STANDARD DRIVING CHASE / HOOD / TOP CAMERAS
    // -------------------------------------------------------------
    const carPos = vehicle.position;
    const heading = vehicle.heading;
    const speed = vehicle.speed;
    const speedKmh = Math.abs(speed * 3.6);
    const isBraking = vehicle.getTelemetry().isBraking;

    if (!this.initialized) {
      this.smoothedHeading = heading;
      this.currentPosition.set(
        carPos.x + Math.sin(heading) * 6,
        carPos.y + 2.2,
        carPos.z + Math.cos(heading) * 6
      );
      this.currentTarget.copy(carPos);
      this.initialized = true;
    }

    // Dynamic FOV widening at high speeds (72 -> 82 deg) & nitro
    const nitroBonus = vehicle.nitroAmount > 0 && (vehicle as unknown as { isNitroActive?: boolean }).isNitroActive ? 5 : 0;
    const targetFov = 72 + Math.min(10, (speedKmh / 190) * 10) + nitroBonus;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 5);
    this.camera.updateProjectionMatrix();

    // Smooth heading follow (prevents sudden 180° snap when reversing)
    let angleDiff = heading - this.smoothedHeading;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.smoothedHeading += angleDiff * Math.min(1.0, dt * 6.5);

    // Smooth drift angle swing: slightly rotate camera towards vehicle's movement vector
    if (vehicle.isDrifting && Math.abs(vehicle.slipAngle) > 0.05) {
      const targetDriftLag = Math.sign(vehicle.steerAngle || 1) * Math.min(0.42, vehicle.slipAngle * 0.45);
      this.driftLagAngle = THREE.MathUtils.lerp(this.driftLagAngle, targetDriftLag, dt * 5.0);
    } else {
      this.driftLagAngle = THREE.MathUtils.lerp(this.driftLagAngle, 0, dt * 6.0);
    }

    const effectiveHeading = this.smoothedHeading + this.driftLagAngle;

    let desiredPos = new THREE.Vector3();
    let desiredLook = new THREE.Vector3();

    if (this.viewMode === 'chase') {
      let distance = 5.8 + Math.min(1.3, (speedKmh / 210) * 1.3);
      if (isBraking && speedKmh > 10) {
        distance -= 0.65; // Dynamic forward pull during hard deceleration
      }

      let height = 2.0 + Math.min(0.4, (speedKmh / 220) * 0.4);
      if (isBraking && speedKmh > 10) {
        height -= 0.2;
      }

      const offset = new THREE.Vector3(
        Math.sin(effectiveHeading) * distance,
        height,
        Math.cos(effectiveHeading) * distance
      );

      desiredPos = carPos.clone().add(offset);
      desiredLook = carPos.clone().add(new THREE.Vector3(0, 0.95, 0));
    } else if (this.viewMode === 'close') {
      let distance = 5.0;
      if (isBraking && speedKmh > 10) distance -= 0.5;
      const height = 1.85;

      const offset = new THREE.Vector3(
        Math.sin(effectiveHeading) * distance,
        height,
        Math.cos(effectiveHeading) * distance
      );

      desiredPos = carPos.clone().add(offset);
      desiredLook = carPos.clone().add(new THREE.Vector3(0, 0.95, 0));
    } else if (this.viewMode === 'hood') {
      const forwardDir = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
      desiredPos = carPos.clone().add(new THREE.Vector3(0, 1.15, 0)).addScaledVector(forwardDir, 0.45);
      desiredLook = desiredPos.clone().addScaledVector(forwardDir, 12).add(new THREE.Vector3(0, -0.2, 0));
    } else {
      // Top-down tactical overview
      desiredPos = carPos.clone().add(new THREE.Vector3(0, 42, 8));
      desiredLook = carPos.clone();
    }

    // Avoid camera going underground
    desiredPos.y = Math.max(1.35, desiredPos.y);

    // Avoid camera clipping through buildings / obstacles
    if (obstacles && obstacles.length > 0 && (this.viewMode === 'chase' || this.viewMode === 'close')) {
      const camRayOrigin = carPos.clone().add(new THREE.Vector3(0, 1.0, 0));
      const rayVec = desiredPos.clone().sub(camRayOrigin);
      const totalDist = rayVec.length();
      const rayDir = rayVec.clone().normalize();

      let minHitDist = totalDist;
      const checkSteps = 8;
      for (let s = 1; s <= checkSteps; s++) {
        const testPt = camRayOrigin.clone().addScaledVector(rayDir, (totalDist * s) / checkSteps);
        for (const obs of obstacles) {
          if (
            testPt.x >= obs.minX - 0.5 &&
            testPt.x <= obs.maxX + 0.5 &&
            testPt.z >= obs.minZ - 0.5 &&
            testPt.z <= obs.maxZ + 0.5
          ) {
            const hitDist = (totalDist * (s - 0.8)) / checkSteps;
            if (hitDist < minHitDist) {
              minHitDist = Math.max(2.4, hitDist);
            }
          }
        }
      }

      if (minHitDist < totalDist) {
        desiredPos = camRayOrigin.clone().addScaledVector(rayDir, minHitDist);
        desiredPos.y = Math.max(1.5, desiredPos.y);
      }
    }

    // Camera shake decay
    if (this.shakeIntensity > 0.005) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 0.35;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 0.35;
      const shakeZ = (Math.random() - 0.5) * this.shakeIntensity * 0.35;
      desiredPos.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 2.8);
    }

    // Damping follow
    const followSpeed = this.viewMode === 'hood' ? 24 : 10.5;
    this.currentPosition.lerp(desiredPos, Math.min(1.0, dt * followSpeed));
    this.currentTarget.lerp(desiredLook, Math.min(1.0, dt * followSpeed));

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentTarget);
  }
}

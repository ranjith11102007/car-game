import * as THREE from 'three';
import { CAR_MODELS, DEFAULT_CAR_CUSTOMIZATION, VEHICLE_CONFIG } from '../constants';
import { CameraView, CarCustomization, VehicleState, VehicleTelemetry } from '../types';
import { SkidManager } from './SkidManager';
import { CollisionObstacle } from './CityBuilder';
import { SoundManager } from '../audio/SoundManager';

export interface VehicleInputs {
  forward: boolean;
  backward: boolean; // Brake / Reverse
  left: boolean;
  right: boolean;
  drift: boolean;    // Handbrake
  nitro: boolean;
}

export class Vehicle {
  public scene: THREE.Scene;
  public group: THREE.Group;
  public skidManager: SkidManager;
  public soundManager: SoundManager;

  // Customization & Visual Configuration
  public customization: CarCustomization = { ...DEFAULT_CAR_CUSTOMIZATION };

  // Visual 3D Meshes
  public bodyMesh!: THREE.Group;
  public wheelMeshes: THREE.Group[] = [];
  public headlightLeftSpot!: THREE.SpotLight;
  public headlightRightSpot!: THREE.SpotLight;
  public headlightLeftGlow!: THREE.Mesh;
  public headlightRightGlow!: THREE.Mesh;
  public brakeLightMat!: THREE.MeshBasicMaterial;
  public reverseLightMat!: THREE.MeshBasicMaterial;
  public headlightBulbMat!: THREE.MeshBasicMaterial;
  public exhaustFlames: THREE.Mesh[] = [];

  // Underglow & Police Lights
  public underglowMesh: THREE.Mesh | null = null;
  public underglowMat: THREE.MeshBasicMaterial | null = null;
  public underglowLight: THREE.PointLight | null = null;
  public policeStrobeL: THREE.Mesh | null = null;
  public policeStrobeR: THREE.Mesh | null = null;
  public policeLightL: THREE.PointLight | null = null;
  public policeLightR: THREE.PointLight | null = null;
  private policeTimer: number = 0;
  private rainbowTimer: number = 0;

  // Vitals & Progression
  public fuelPercent: number = 92;
  public damagePercent: number = 100;
  public cash: number = 2000;

  // Physics State
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public heading: number = 0; // Yaw angle in radians (0 = facing -Z)
  public angularVelocity: number = 0;
  public speed: number = 0; // scalar forward speed (positive = forward, negative = reverse)

  // Steering
  public steerAngle: number = 0; // radians

  // Drift & Grip
  public isHandbrake: boolean = false;
  public lateralGrip: number = VEHICLE_CONFIG.NORMAL_LATERAL_GRIP;
  public slipAngle: number = 0;
  public isDrifting: boolean = false;
  public driftDuration: number = 0;
  public driftScore: number = 0;
  public driftCombo: number = 1;

  // Headlights
  public headlightsOn: boolean = false;

  // Nitro
  public nitroAmount: number = 100; // 0 to 100%

  // Visual Lean & Wheel Spin
  private rollAngle: number = 0;
  private pitchAngle: number = 0;
  private wheelRotation: number = 0;

  // Transmission & Throttle/Brake separation
  public gearMode: 'D' | 'R' = 'D';
  private standstillTimer: number = 0;
  private mustReleaseBrakeBeforeReverse: boolean = false;

  // Additional Vehicle Dynamics & Ground States
  public activeState: VehicleState = 'idle';
  public isNitroActive: boolean = false;
  public surfaceType: 'road' | 'sidewalk' | 'offroad' = 'road';
  public collisionCooldown: number = 0;
  public onCollision?: () => void;

  // Collision
  public obstacles: CollisionObstacle[] = [];
  public trafficManager: any = null;

  constructor(scene: THREE.Scene, skidManager: SkidManager, soundManager: SoundManager) {
    this.scene = scene;
    this.skidManager = skidManager;
    this.soundManager = soundManager;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.buildCarModel();
    this.reset(0, 0, 0);
  }

  public reset(spawnX?: number, spawnZ?: number, spawnHeading?: number) {
    // If no coordinates provided, upright the vehicle and align to nearest road center
    let targetX = spawnX;
    let targetZ = spawnZ;
    let targetHeading = spawnHeading;

    if (targetX === undefined || targetZ === undefined) {
      const step = 120;
      const nearestRoadX = Math.round(this.position.x / step) * step;
      const nearestRoadZ = Math.round(this.position.z / step) * step;
      const distToX = Math.abs(this.position.x - nearestRoadX);
      const distToZ = Math.abs(this.position.z - nearestRoadZ);

      if (distToX < distToZ) {
        targetX = nearestRoadX;
        targetZ = this.position.z;
        targetHeading = Math.cos(this.heading) >= 0 ? 0 : Math.PI;
      } else {
        targetX = this.position.x;
        targetZ = nearestRoadZ;
        targetHeading = Math.sin(this.heading) >= 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }

    if (targetHeading === undefined) {
      targetHeading = 0;
    }

    this.position.set(targetX, 0, targetZ);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.heading = targetHeading;
    this.angularVelocity = 0;
    this.steerAngle = 0;
    this.rollAngle = 0;
    this.pitchAngle = 0;
    this.isDrifting = false;
    this.driftCombo = 1;
    this.driftDuration = 0;
    this.lateralGrip = VEHICLE_CONFIG.NORMAL_LATERAL_GRIP;
    this.gearMode = 'D';
    this.standstillTimer = 0;
    this.mustReleaseBrakeBeforeReverse = false;
    this.collisionCooldown = 0.3;

    this.group.position.copy(this.position);
    this.group.rotation.set(0, this.heading, 0);
  }

  public applyCustomization(custom: Partial<CarCustomization>) {
    this.customization = { ...this.customization, ...custom };

    // Tune physics based on model & handling preset
    const modelDef = CAR_MODELS[this.customization.model];
    if (this.customization.handlingPreset === 'drift') {
      this.lateralGrip = 10.5;
    } else if (this.customization.handlingPreset === 'grip') {
      this.lateralGrip = 16.5;
    } else if (this.customization.handlingPreset === 'drag') {
      this.lateralGrip = 13.0;
    } else {
      this.lateralGrip = VEHICLE_CONFIG.NORMAL_LATERAL_GRIP;
    }

    // Rebuild visual model preserving position & rotation
    const curPos = this.group.position.clone();
    const curRot = this.group.rotation.clone();

    // Clean up old body and wheels
    this.clearOldMeshes();

    this.buildCarModel();

    this.group.position.copy(curPos);
    this.group.rotation.copy(curRot);
  }

  private clearOldMeshes() {
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.wheelMeshes = [];
    this.exhaustFlames = [];
    this.policeStrobeL = null;
    this.policeStrobeR = null;
    this.policeLightL = null;
    this.policeLightR = null;
    this.underglowMesh = null;
    this.underglowLight = null;
  }

  private buildCarModel() {
    this.bodyMesh = new THREE.Group();
    const custom = this.customization;

    // Body paint materials
    let metalness = 0.88;
    let roughness = 0.14;
    if (custom.finish === 'matte') {
      metalness = 0.2;
      roughness = 0.75;
    } else if (custom.finish === 'chrome') {
      metalness = 1.0;
      roughness = 0.04;
    } else if (custom.finish === 'chameleon') {
      metalness = 0.95;
      roughness = 0.1;
    }

    const primaryMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(custom.primaryColor),
      metalness,
      roughness,
    });

    const secondaryMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(custom.secondaryColor),
      metalness: 0.8,
      roughness: 0.2,
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x141416,
      metalness: 0.45,
      roughness: 0.45,
    });

    const glassCanopyMat = new THREE.MeshStandardMaterial({
      color: 0x050d18,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.88,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    // 0. Soft Contact Ground Shadow
    const shadowGeo = new THREE.PlaneGeometry(2.4, 4.8);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d')!;
    const sgrad = sctx.createRadialGradient(64, 128, 20, 64, 128, 110);
    sgrad.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    sgrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.4)');
    sgrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 128, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
    const groundShadow = new THREE.Mesh(shadowGeo, shadowMat);
    groundShadow.position.y = 0.02;
    this.group.add(groundShadow);

    // 1. Build Model-Specific Chassis & Aero
    switch (custom.model) {
      case 'tuner':
        this.buildTunerBody(primaryMat, secondaryMat, carbonMat, chromeMat, glassCanopyMat);
        break;
      case 'muscle':
        this.buildMuscleBody(primaryMat, secondaryMat, carbonMat, chromeMat, glassCanopyMat);
        break;
      case 'cyber':
        this.buildCyberBody(primaryMat, secondaryMat, carbonMat, chromeMat, glassCanopyMat);
        break;
      case 'police':
        this.buildPoliceBody(primaryMat, secondaryMat, carbonMat, chromeMat, glassCanopyMat);
        break;
      case 'hypercar':
      default:
        this.buildHypercarBody(primaryMat, secondaryMat, carbonMat, chromeMat, glassCanopyMat);
        break;
    }

    this.group.add(this.bodyMesh);

    // 2. Underglow Neon
    this.buildUnderglow();

    // 3. Wheels & Rims
    this.buildWheels();
  }

  // --- MODEL 1: APEX HYPERCAR ---
  private buildHypercarBody(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    carbonMat: THREE.Material,
    chromeMat: THREE.Material,
    glassCanopyMat: THREE.Material
  ) {
    // 1. Sculpted Low-Slung Aerodynamic Monocoque Core
    const chassisGeo = new THREE.BoxGeometry(1.96, 0.38, 4.35);
    const chassis = new THREE.Mesh(chassisGeo, primaryMat);
    chassis.position.y = 0.36;
    chassis.castShadow = true;
    this.bodyMesh.add(chassis);

    // 2. Swept Front Nose & Sloped Aero Hood
    const noseGeo = new THREE.ConeGeometry(0.98, 1.45, 4);
    noseGeo.rotateX(-Math.PI / 2);
    noseGeo.rotateY(Math.PI / 4);
    const nose = new THREE.Mesh(noseGeo, primaryMat);
    nose.position.set(0, 0.33, -2.38);
    nose.scale.set(1.92, 0.34, 1.0);
    nose.castShadow = true;
    this.bodyMesh.add(nose);

    const hoodSlope = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.1, 1.45), primaryMat);
    hoodSlope.position.set(0, 0.52, -1.35);
    hoodSlope.rotation.x = -0.11;
    this.bodyMesh.add(hoodSlope);

    // Recessed Carbon Front Radiator Ducts
    const ductL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.45), carbonMat);
    ductL.position.set(-0.56, 0.3, -2.18);
    this.bodyMesh.add(ductL);

    const ductR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.45), carbonMat);
    ductR.position.set(0.56, 0.3, -2.18);
    this.bodyMesh.add(ductR);

    // Racing Livery Stripe across center hood
    if (this.customization.livery !== 'none') {
      const hoodStripeGeo = new THREE.BoxGeometry(0.65, 0.03, 1.75);
      const hoodStripe = new THREE.Mesh(hoodStripeGeo, secondaryMat);
      hoodStripe.position.set(0, 0.56, -1.35);
      hoodStripe.rotation.x = -0.11;
      this.bodyMesh.add(hoodStripe);
    }

    // 3. Front Carbon Splitter, Aero Blades & Canards
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.05, 0.75), carbonMat);
    splitter.position.set(0, 0.15, -2.28);
    this.bodyMesh.add(splitter);

    const canardL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.32), secondaryMat);
    canardL.position.set(-1.02, 0.28, -2.1);
    canardL.rotation.z = 0.25;
    this.bodyMesh.add(canardL);

    const canardR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.32), secondaryMat);
    canardR.position.set(1.02, 0.28, -2.1);
    canardR.rotation.z = -0.25;
    this.bodyMesh.add(canardR);

    // 4. Sculpted Muscular Wheel Arches & Venturi Sidepods
    const archOffsets = [
      { x: -1.04, z: -1.35, r: 0.46 },
      { x: 1.04, z: -1.35, r: 0.46 },
      { x: -1.07, z: 1.35, r: 0.50 },
      { x: 1.07, z: 1.35, r: 0.50 },
    ];
    for (const ao of archOffsets) {
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(ao.r, ao.r, 0.22, 20), primaryMat);
      arch.rotation.z = Math.PI / 2;
      arch.position.set(ao.x, 0.42, ao.z);
      this.bodyMesh.add(arch);
    }

    const sidepodGeo = new THREE.BoxGeometry(0.36, 0.36, 2.05);
    const sidepodL = new THREE.Mesh(sidepodGeo, primaryMat);
    sidepodL.position.set(-0.96, 0.42, 0.08);
    this.bodyMesh.add(sidepodL);

    const sidepodR = new THREE.Mesh(sidepodGeo, primaryMat);
    sidepodR.position.set(0.96, 0.42, 0.08);
    this.bodyMesh.add(sidepodR);

    // Carbon Side Intake Scoops
    const intakeL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.65), carbonMat);
    intakeL.position.set(-1.08, 0.44, 0.35);
    this.bodyMesh.add(intakeL);

    const intakeR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.65), carbonMat);
    intakeR.position.set(1.08, 0.44, 0.35);
    this.bodyMesh.add(intakeR);

    // Carbon Side Skirts
    const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 2.25), carbonMat);
    skirtL.position.set(-1.05, 0.15, 0);
    this.bodyMesh.add(skirtL);

    const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 2.25), carbonMat);
    skirtR.position.set(1.05, 0.15, 0);
    this.bodyMesh.add(skirtR);

    // 5. Rear Haunches & Vented Engine Louvers
    const rearFenders = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.42, 1.55), primaryMat);
    rearFenders.position.set(0, 0.46, 1.28);
    rearFenders.castShadow = true;
    this.bodyMesh.add(rearFenders);

    for (let i = 0; i < 4; i++) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.03, 0.14), carbonMat);
      louver.position.set(0, 0.78 - i * 0.03, 0.95 + i * 0.24);
      louver.rotation.x = 0.25;
      this.bodyMesh.add(louver);
    }

    // 6. Teardrop Glass Canopy & Carbon Roof Spine
    const canopyGeo = new THREE.CylinderGeometry(0.54, 0.74, 2.15, 18);
    canopyGeo.rotateX(Math.PI / 2);
    const canopy = new THREE.Mesh(canopyGeo, glassCanopyMat);
    canopy.position.set(0, 0.76, -0.05);
    canopy.scale.set(1.02, 0.56, 1.0);
    canopy.castShadow = true;
    this.bodyMesh.add(canopy);

    const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 1.25), carbonMat);
    scoop.position.set(0, 1.04, 0.25);
    scoop.rotation.x = -0.08;
    this.bodyMesh.add(scoop);

    // Side Mirrors on Stalks
    this.buildSideMirrors(primaryMat, carbonMat, chromeMat, 0.78, -0.65);

    // 7. Rear Diffuser with Vertical Aero Strakes
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 0.5), carbonMat);
    diffuser.position.set(0, 0.16, 2.12);
    this.bodyMesh.add(diffuser);
    for (const sx of [-0.65, -0.22, 0.22, 0.65]) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.44), carbonMat);
      strake.position.set(sx, 0.15, 2.16);
      this.bodyMesh.add(strake);
    }

    // Rear Wing / Spoiler
    this.buildSpoiler(carbonMat, secondaryMat);

    // Headlights and Taillights
    this.buildHeadlightsAndTaillights(carbonMat, chromeMat);

    // Quad Center Exhaust
    this.buildExhaustPipes(
      [
        { x: -0.36, y: 0.32, z: 2.25 },
        { x: -0.12, y: 0.32, z: 2.25 },
        { x: 0.12, y: 0.32, z: 2.25 },
        { x: 0.36, y: 0.32, z: 2.25 },
      ],
      chromeMat
    );
  }

  // --- MODEL 2: JDM WIDEBODY TUNER (Apex GT-R Drift Coupe from reference image) ---
  private buildTunerBody(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    carbonMat: THREE.Material,
    chromeMat: THREE.Material,
    glassCanopyMat: THREE.Material
  ) {
    // 1. Sculpted Low-Slung Chassis with Aerodynamic Contours
    const chassisGeo = new THREE.BoxGeometry(2.02, 0.42, 4.35);
    const mainBody = new THREE.Mesh(chassisGeo, primaryMat);
    mainBody.position.y = 0.42;
    mainBody.castShadow = true;
    this.bodyMesh.add(mainBody);

    // 2. Sculpted Hood with Dual NACA Air Ducts & Heat Extractors
    const hoodGeo = new THREE.BoxGeometry(1.58, 0.12, 1.6);
    const hood = new THREE.Mesh(hoodGeo, primaryMat);
    hood.position.set(0, 0.58, -1.25);
    hood.rotation.x = -0.06;
    this.bodyMesh.add(hood);

    // Dual Recessed NACA Ducts
    const nacaGeo = new THREE.BoxGeometry(0.24, 0.04, 0.45);
    const nacaL = new THREE.Mesh(nacaGeo, carbonMat);
    nacaL.position.set(-0.42, 0.64, -1.35);
    nacaL.rotation.x = -0.1;
    this.bodyMesh.add(nacaL);

    const nacaR = new THREE.Mesh(nacaGeo, carbonMat);
    nacaR.position.set(0.42, 0.64, -1.35);
    nacaR.rotation.x = -0.1;
    this.bodyMesh.add(nacaR);

    // 3. Aggressive Front Bumper with Large Intercooler Air Intake
    const bumperFace = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.36, 0.35), primaryMat);
    bumperFace.position.set(0, 0.34, -2.18);
    this.bodyMesh.add(bumperFace);

    // Chrome Intercooler Core & Mesh Grille
    const intercooler = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.24, 0.16), chromeMat);
    intercooler.position.set(0, 0.28, -2.26);
    this.bodyMesh.add(intercooler);

    const meshGrille = new THREE.Mesh(
      new THREE.BoxGeometry(1.28, 0.28, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    meshGrille.position.set(0, 0.28, -2.33);
    this.bodyMesh.add(meshGrille);

    // Deep Carbon Front Splitter with Stainless Steel Tie Rods
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.05, 0.72), carbonMat);
    splitter.position.set(0, 0.14, -2.28);
    this.bodyMesh.add(splitter);

    const strutGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.24, 8);
    const strutL = new THREE.Mesh(strutGeo, chromeMat);
    strutL.position.set(-0.48, 0.24, -2.38);
    strutL.rotation.x = -0.32;
    this.bodyMesh.add(strutL);

    const strutR = new THREE.Mesh(strutGeo, chromeMat);
    strutR.position.set(0.48, 0.24, -2.38);
    strutR.rotation.x = -0.32;
    this.bodyMesh.add(strutR);

    // 4. Bolted-on Widebody Fender Flares (Front and Rear - matching reference image)
    const flareOffsets = [
      { x: -1.06, z: -1.35, isRear: false },
      { x: 1.06, z: -1.35, isRear: false },
      { x: -1.08, z: 1.35, isRear: true },
      { x: 1.08, z: 1.35, isRear: true },
    ];
    for (const fo of flareOffsets) {
      const w = 0.24;
      const r = fo.isRear ? 0.52 : 0.48;
      const flareMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 20), primaryMat);
      flareMesh.rotation.z = Math.PI / 2;
      flareMesh.position.set(fo.x, 0.44, fo.z);
      this.bodyMesh.add(flareMesh);

      // Aero vent behind front fenders
      if (!fo.isRear) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.35), carbonMat);
        vent.position.set(fo.x > 0 ? fo.x - 0.02 : fo.x + 0.02, 0.44, fo.z + 0.45);
        this.bodyMesh.add(vent);
      }
    }

    // Aerodynamic Carbon Side Skirts
    const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 2.3), carbonMat);
    skirtL.position.set(-1.05, 0.16, 0);
    this.bodyMesh.add(skirtL);

    const skirtR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 2.3), carbonMat);
    skirtR.position.set(1.05, 0.16, 0);
    this.bodyMesh.add(skirtR);

    // 5. Aerodynamic Side Wing Mirrors on A-Pillars
    const mirrorStemGeo = new THREE.BoxGeometry(0.14, 0.04, 0.06);
    const mirrorHeadGeo = new THREE.BoxGeometry(0.24, 0.12, 0.15);
    const mirrorFaceGeo = new THREE.PlaneGeometry(0.22, 0.1);
    const mirrorGlassMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.1 });

    // Left mirror
    const mStemL = new THREE.Mesh(mirrorStemGeo, carbonMat);
    mStemL.position.set(-0.94, 0.82, -0.6);
    mStemL.rotation.z = 0.25;
    this.bodyMesh.add(mStemL);

    const mHeadL = new THREE.Mesh(mirrorHeadGeo, primaryMat);
    mHeadL.position.set(-1.06, 0.85, -0.6);
    this.bodyMesh.add(mHeadL);

    const mFaceL = new THREE.Mesh(mirrorFaceGeo, mirrorGlassMat);
    mFaceL.position.set(-1.05, 0.85, -0.52);
    mFaceL.rotation.y = Math.PI;
    this.bodyMesh.add(mFaceL);

    // Right mirror
    const mStemR = new THREE.Mesh(mirrorStemGeo, carbonMat);
    mStemR.position.set(0.94, 0.82, -0.6);
    mStemR.rotation.z = -0.25;
    this.bodyMesh.add(mStemR);

    const mHeadR = new THREE.Mesh(mirrorHeadGeo, primaryMat);
    mHeadR.position.set(1.06, 0.85, -0.6);
    this.bodyMesh.add(mHeadR);

    const mFaceR = new THREE.Mesh(mirrorFaceGeo, mirrorGlassMat);
    mFaceR.position.set(1.05, 0.85, -0.52);
    mFaceR.rotation.y = Math.PI;
    this.bodyMesh.add(mFaceR);

    // 6. Fastback Coupe Greenhouse with Windshield Rake & Black Pillars
    const greenhouse = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.52, 2.15), glassCanopyMat);
    greenhouse.position.set(0, 0.88, 0.05);
    this.bodyMesh.add(greenhouse);

    // Roof Panel
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.05, 1.4), primaryMat);
    roof.position.set(0, 1.15, 0.1);
    this.bodyMesh.add(roof);

    // A-Pillars & C-Pillars Black Trims
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), carbonMat);
    pillarL.position.set(-0.75, 0.88, -0.85);
    pillarL.rotation.x = -0.45;
    this.bodyMesh.add(pillarL);

    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), carbonMat);
    pillarR.position.set(0.75, 0.88, -0.85);
    pillarR.rotation.x = -0.45;
    this.bodyMesh.add(pillarR);

    // Rear Window Slope
    const rearSlant = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.06, 0.95), glassCanopyMat);
    rearSlant.position.set(0, 0.95, 1.0);
    rearSlant.rotation.x = 0.38;
    this.bodyMesh.add(rearSlant);

    // 7. Rear Deck & Recessed License Plate Fascia (matching reference image)
    const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.38, 0.4), primaryMat);
    rearDeck.position.set(0, 0.52, 2.05);
    this.bodyMesh.add(rearDeck);

    // License Plate Recess
    const plateRecess = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.22, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x111620, roughness: 0.8 })
    );
    plateRecess.position.set(0, 0.44, 2.24);
    this.bodyMesh.add(plateRecess);

    // White License Plate
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    plate.position.set(0, 0.44, 2.285);
    this.bodyMesh.add(plate);

    // 8. Rear Carbon Aerodynamic Diffuser with 4 Vertical Strakes
    const diffuserBase = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.12, 0.55), carbonMat);
    diffuserBase.position.set(0, 0.16, 2.12);
    this.bodyMesh.add(diffuserBase);

    const strakeGeo = new THREE.BoxGeometry(0.04, 0.18, 0.45);
    const strakePositions = [-0.68, -0.22, 0.22, 0.68];
    for (const sx of strakePositions) {
      const strake = new THREE.Mesh(strakeGeo, carbonMat);
      strake.position.set(sx, 0.14, 2.15);
      this.bodyMesh.add(strake);
    }

    // 9. Rear GT Wing / Spoiler
    this.buildSpoiler(carbonMat, secondaryMat);

    // 10. Headlights & Iconic Quad Circular Red LED Halo Taillights
    this.buildHeadlightsAndTaillights(carbonMat, chromeMat);

    // 11. Quad Titanium Exhaust Tips (2 Left + 2 Right - matching reference image)
    this.buildExhaustPipes(
      [
        { x: -0.64, y: 0.22, z: 2.28 },
        { x: -0.46, y: 0.22, z: 2.28 },
        { x: 0.46, y: 0.22, z: 2.28 },
        { x: 0.64, y: 0.22, z: 2.28 },
      ],
      chromeMat
    );
  }

  // --- MODEL 3: AMERICAN V8 MUSCLE ---
  private buildMuscleBody(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    carbonMat: THREE.Material,
    chromeMat: THREE.Material,
    glassCanopyMat: THREE.Material
  ) {
    // 1. Sculpted Wide-Stance Muscle Chassis & Coke-Bottle Haunches
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.5, 4.55), primaryMat);
    mainBody.position.y = 0.45;
    mainBody.castShadow = true;
    this.bodyMesh.add(mainBody);

    // Sculpted Long Power-Dome Hood
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.14, 1.85), primaryMat);
    hood.position.set(0, 0.68, -1.22);
    hood.rotation.x = -0.04;
    this.bodyMesh.add(hood);

    // Recessed Deep Front Muscle Grille & Chrome Surround
    const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.28, 0.16), chromeMat);
    grilleFrame.position.set(0, 0.52, -2.24);
    this.bodyMesh.add(grilleFrame);

    const grilleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.76, 0.22, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 })
    );
    grilleMesh.position.set(0, 0.52, -2.28);
    this.bodyMesh.add(grilleMesh);

    // Front Chin Spoiler Splitter
    const chinSpoiler = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.08, 0.55), carbonMat);
    chinSpoiler.position.set(0, 0.17, -2.22);
    this.bodyMesh.add(chinSpoiler);

    // Flared Wheel Arches (Front & Rear Muscular Quarters)
    const archOffsets = [
      { x: -1.06, z: -1.35, r: 0.48 },
      { x: 1.06, z: -1.35, r: 0.48 },
      { x: -1.08, z: 1.35, r: 0.52 },
      { x: 1.08, z: 1.35, r: 0.52 },
    ];
    for (const ao of archOffsets) {
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(ao.r, ao.r, 0.22, 20), primaryMat);
      arch.rotation.z = Math.PI / 2;
      arch.position.set(ao.x, 0.44, ao.z);
      this.bodyMesh.add(arch);
    }

    // Dual Classic Racing Stripes
    if (this.customization.livery !== 'none') {
      const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 4.48), secondaryMat);
      stripeL.position.set(-0.24, 0.76, 0);
      this.bodyMesh.add(stripeL);

      const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 4.48), secondaryMat);
      stripeR.position.set(0.24, 0.76, 0);
      this.bodyMesh.add(stripeR);
    }

    // Protruding Chrome Supercharger Blower Case & Triple Butterfly Intake
    const blowerCase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.32, 0.72), chromeMat);
    blowerCase.position.set(0, 0.88, -1.1);
    this.bodyMesh.add(blowerCase);

    const scoopFaceMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const bScope = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.28), chromeMat);
    bScope.position.set(0, 1.04, -1.32);
    this.bodyMesh.add(bScope);

    const bFlap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.11, 0.02), scoopFaceMat);
    bFlap.position.set(0, 1.04, -1.47);
    this.bodyMesh.add(bFlap);

    // Fastback Muscle Greenhouse with Slanted Windshield, Roof & Rear Louvers
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.48, 2.05), glassCanopyMat);
    cabin.position.set(0, 0.92, 0.25);
    this.bodyMesh.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.05, 1.35), primaryMat);
    roof.position.set(0, 1.17, 0.22);
    this.bodyMesh.add(roof);

    const rearWindowSlope = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.05, 0.92), glassCanopyMat);
    rearWindowSlope.position.set(0, 0.98, 1.18);
    rearWindowSlope.rotation.x = 0.36;
    this.bodyMesh.add(rearWindowSlope);

    // Side Mirrors
    this.buildSideMirrors(primaryMat, carbonMat, chromeMat, 0.84, -0.58);

    // Rear Muscle Valance & Diffuser
    const rearValance = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.16, 0.42), carbonMat);
    rearValance.position.set(0, 0.18, 2.16);
    this.bodyMesh.add(rearValance);

    // Ducktail or High Wing
    this.buildSpoiler(carbonMat, secondaryMat);

    // Headlights & Taillights
    this.buildHeadlightsAndTaillights(carbonMat, chromeMat);

    // Heavy Quad Exhausts
    this.buildExhaustPipes(
      [
        { x: -0.65, y: 0.26, z: 2.32 },
        { x: -0.45, y: 0.26, z: 2.32 },
        { x: 0.45, y: 0.26, z: 2.32 },
        { x: 0.65, y: 0.26, z: 2.32 },
      ],
      chromeMat
    );
  }

  // --- MODEL 4: CYBER RACER 2099 ---
  private buildCyberBody(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    carbonMat: THREE.Material,
    chromeMat: THREE.Material,
    glassCanopyMat: THREE.Material
  ) {
    // 1. Sculpted Faceted Stealth Wedge Monocoque
    const cyberChassis = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.42, 4.48), primaryMat);
    cyberChassis.position.y = 0.39;
    cyberChassis.castShadow = true;
    this.bodyMesh.add(cyberChassis);

    const frontWedge = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.14, 1.55), primaryMat);
    frontWedge.position.set(0, 0.52, -1.4);
    frontWedge.rotation.x = -0.12;
    this.bodyMesh.add(frontWedge);

    // Sculpted Wheel Arches
    const archOffsets = [
      { x: -1.05, z: -1.35, r: 0.48 },
      { x: 1.05, z: -1.35, r: 0.48 },
      { x: -1.07, z: 1.35, r: 0.50 },
      { x: 1.07, z: 1.35, r: 0.50 },
    ];
    for (const ao of archOffsets) {
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(ao.r, ao.r, 0.22, 16), primaryMat);
      arch.rotation.z = Math.PI / 2;
      arch.position.set(ao.x, 0.42, ao.z);
      this.bodyMesh.add(arch);
    }

    // Front Splitter & Side Skirts
    const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.05, 0.65), carbonMat);
    splitter.position.set(0, 0.15, -2.25);
    this.bodyMesh.add(splitter);

    // Full-width continuous neon visor lightbar in front
    const visorMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const visorBar = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.07, 0.1), visorMat);
    visorBar.position.set(0, 0.42, -2.26);
    this.bodyMesh.add(visorBar);

    // Rear continuous neon blade taillight & carbon diffuser
    const rearVisorMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
    const rearVisor = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.08, 0.1), rearVisorMat);
    rearVisor.position.set(0, 0.54, 2.26);
    this.bodyMesh.add(rearVisor);

    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.14, 0.48), carbonMat);
    diffuser.position.set(0, 0.16, 2.12);
    this.bodyMesh.add(diffuser);

    // Angular Sci-Fi Cockpit Canopy
    const canopyGeo = new THREE.ConeGeometry(0.85, 2.8, 4);
    canopyGeo.rotateX(-Math.PI / 2);
    canopyGeo.rotateY(Math.PI / 4);
    const cyberCanopy = new THREE.Mesh(canopyGeo, glassCanopyMat);
    cyberCanopy.position.set(0, 0.82, 0.1);
    cyberCanopy.scale.set(1.15, 0.5, 0.95);
    this.bodyMesh.add(cyberCanopy);

    // Side Camera Wing Mirrors
    this.buildSideMirrors(primaryMat, carbonMat, chromeMat, 0.78, -0.62);

    // Twin Rear Vertical Stabilizing Aero Fins
    const finMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 1.4), finMat);
    finL.position.set(-0.95, 0.72, 1.4);
    this.bodyMesh.add(finL);

    const finR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 1.4), finMat);
    finR.position.set(0.95, 0.72, 1.4);
    this.bodyMesh.add(finR);

    // Headlights and spots
    this.buildHeadlightsAndTaillights(carbonMat, chromeMat);

    // Cyber Plasma Thruster Exhaust
    this.buildExhaustPipes(
      [
        { x: -0.28, y: 0.32, z: 2.26 },
        { x: 0.28, y: 0.32, z: 2.26 },
      ],
      chromeMat
    );
  }

  // --- MODEL 5: POLICE HIGHWAY INTERCEPTOR ---
  private buildPoliceBody(
    primaryMat: THREE.Material,
    secondaryMat: THREE.Material,
    carbonMat: THREE.Material,
    chromeMat: THREE.Material,
    glassCanopyMat: THREE.Material
  ) {
    // 1. Sculpted Pursuit Sedan Body, Sloped Hood & Rear Trunk Deck
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.5, 4.65), primaryMat);
    mainBody.position.y = 0.45;
    mainBody.castShadow = true;
    this.bodyMesh.add(mainBody);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.12, 1.55), primaryMat);
    hood.position.set(0, 0.64, -1.35);
    hood.rotation.x = -0.05;
    this.bodyMesh.add(hood);

    // Wheel Arches
    const archOffsets = [
      { x: -1.04, z: -1.35, r: 0.48 },
      { x: 1.04, z: -1.35, r: 0.48 },
      { x: -1.06, z: 1.35, r: 0.50 },
      { x: 1.06, z: 1.35, r: 0.50 },
    ];
    for (const ao of archOffsets) {
      const arch = new THREE.Mesh(new THREE.CylinderGeometry(ao.r, ao.r, 0.2, 20), primaryMat);
      arch.rotation.z = Math.PI / 2;
      arch.position.set(ao.x, 0.44, ao.z);
      this.bodyMesh.add(arch);
    }

    // White Door Livery Panels (Black & White Police cruiser)
    const whiteDoorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22, metalness: 0.45 });
    const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 2.0), whiteDoorMat);
    doorL.position.set(-1.04, 0.46, 0.1);
    this.bodyMesh.add(doorL);

    const doorR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 2.0), whiteDoorMat);
    doorR.position.set(1.04, 0.46, 0.1);
    this.bodyMesh.add(doorR);

    // Cabin glass & White Roof Panel
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.5, 2.18), glassCanopyMat);
    cabin.position.set(0, 0.92, 0.15);
    this.bodyMesh.add(cabin);

    const roofWhite = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.05, 1.42), whiteDoorMat);
    roofWhite.position.set(0, 1.17, 0.18);
    this.bodyMesh.add(roofWhite);

    const rearSlant = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.05, 0.85), glassCanopyMat);
    rearSlant.position.set(0, 0.96, 1.08);
    rearSlant.rotation.x = 0.38;
    this.bodyMesh.add(rearSlant);

    // Side Mirrors & A-Pillar Searchlights
    this.buildSideMirrors(primaryMat, carbonMat, chromeMat, 0.84, -0.58);

    // Heavy Push Bumper (PIT Bull Bar) on Front
    const bullBarMat = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.45, metalness: 0.85 });
    const bullBar = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.46, 0.16), bullBarMat);
    bullBar.position.set(0, 0.38, -2.42);
    this.bodyMesh.add(bullBar);

    const barUprightL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.22), bullBarMat);
    barUprightL.position.set(-0.48, 0.42, -2.42);
    this.bodyMesh.add(barUprightL);

    const barUprightR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.22), bullBarMat);
    barUprightR.position.set(0.48, 0.42, -2.42);
    this.bodyMesh.add(barUprightR);

    // Roof-Mounted Tactical LED Emergency Strobe Lightbar
    const barFrame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.07, 0.28), bullBarMat);
    barFrame.position.set(0, 1.23, 0.22);
    this.bodyMesh.add(barFrame);

    // Left Red Strobe & Right Blue Strobe
    const redStrobeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const blueStrobeMat = new THREE.MeshBasicMaterial({ color: 0x0066ff });

    this.policeStrobeL = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.25), redStrobeMat);
    this.policeStrobeL.position.set(-0.3, 1.27, 0.22);
    this.bodyMesh.add(this.policeStrobeL);

    this.policeStrobeR = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.25), blueStrobeMat);
    this.policeStrobeR.position.set(0.3, 1.27, 0.22);
    this.bodyMesh.add(this.policeStrobeR);

    this.policeLightL = new THREE.PointLight(0xff0000, 2.0, 15);
    this.policeLightL.position.set(-0.3, 1.32, 0.22);
    this.bodyMesh.add(this.policeLightL);

    this.policeLightR = new THREE.PointLight(0x0066ff, 2.0, 15);
    this.policeLightR.position.set(0.3, 1.32, 0.22);
    this.bodyMesh.add(this.policeLightR);

    // Spoiler
    this.buildSpoiler(carbonMat, secondaryMat);

    // Headlights and Taillights
    this.buildHeadlightsAndTaillights(carbonMat, chromeMat);

    // Dual Rear Pursuit Exhausts
    this.buildExhaustPipes(
      [
        { x: -0.52, y: 0.26, z: 2.34 },
        { x: 0.52, y: 0.26, z: 2.34 },
      ],
      chromeMat
    );
  }

  // --- REUSABLE COMPONENTS ---
  private buildSideMirrors(
    primaryMat: THREE.Material,
    carbonMat: THREE.Material,
    chromeMat: THREE.Material,
    yPos: number,
    zPos: number
  ) {
    const mirrorStemGeo = new THREE.BoxGeometry(0.14, 0.04, 0.06);
    const mirrorHeadGeo = new THREE.BoxGeometry(0.24, 0.11, 0.14);
    const mirrorFaceGeo = new THREE.PlaneGeometry(0.21, 0.09);

    const mStemL = new THREE.Mesh(mirrorStemGeo, carbonMat);
    mStemL.position.set(-0.92, yPos, zPos);
    mStemL.rotation.z = 0.22;
    this.bodyMesh.add(mStemL);

    const mHeadL = new THREE.Mesh(mirrorHeadGeo, primaryMat);
    mHeadL.position.set(-1.04, yPos + 0.03, zPos);
    this.bodyMesh.add(mHeadL);

    const mFaceL = new THREE.Mesh(mirrorFaceGeo, chromeMat);
    mFaceL.position.set(-1.04, yPos + 0.03, zPos + 0.075);
    this.bodyMesh.add(mFaceL);

    const mStemR = new THREE.Mesh(mirrorStemGeo, carbonMat);
    mStemR.position.set(0.92, yPos, zPos);
    mStemR.rotation.z = -0.22;
    this.bodyMesh.add(mStemR);

    const mHeadR = new THREE.Mesh(mirrorHeadGeo, primaryMat);
    mHeadR.position.set(1.04, yPos + 0.03, zPos);
    this.bodyMesh.add(mHeadR);

    const mFaceR = new THREE.Mesh(mirrorFaceGeo, chromeMat);
    mFaceR.position.set(1.04, yPos + 0.03, zPos + 0.075);
    this.bodyMesh.add(mFaceR);
  }

  private buildSpoiler(carbonMat: THREE.Material, secondaryMat: THREE.Material) {
    const style = this.customization.spoilerStyle;
    if (style === 'none') return;

    if (style === 'ducktail') {
      const ducktail = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.16, 0.28), carbonMat);
      ducktail.position.set(0, 0.72, 2.15);
      ducktail.rotation.x = -0.3;
      this.bodyMesh.add(ducktail);
    } else if (style === 'double_wing') {
      // Lower wing
      const wing1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.38), carbonMat);
      wing1.position.set(0, 0.85, 2.05);
      this.bodyMesh.add(wing1);

      // Upper wing
      const wing2 = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.06, 0.44), carbonMat);
      wing2.position.set(0, 1.15, 2.15);
      this.bodyMesh.add(wing2);

      // Pylons
      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.14), carbonMat);
      pylonL.position.set(-0.55, 0.9, 2.05);
      this.bodyMesh.add(pylonL);

      const pylonR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.14), carbonMat);
      pylonR.position.set(0.55, 0.9, 2.05);
      this.bodyMesh.add(pylonR);
    } else {
      // High GT Wing
      const wing = new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.06, 0.42), carbonMat);
      wing.position.set(0, 0.98, 2.05);
      this.bodyMesh.add(wing);

      const endplateL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.48), secondaryMat);
      endplateL.position.set(-1.04, 0.98, 2.05);
      this.bodyMesh.add(endplateL);

      const endplateR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.48), secondaryMat);
      endplateR.position.set(1.04, 0.98, 2.05);
      this.bodyMesh.add(endplateR);

      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.14), carbonMat);
      pylonL.position.set(-0.48, 0.78, 2.0);
      this.bodyMesh.add(pylonL);

      const pylonR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.14), carbonMat);
      pylonR.position.set(0.48, 0.78, 2.0);
      this.bodyMesh.add(pylonR);
    }
  }

  private buildHeadlightsAndTaillights(carbonMat: THREE.Material, chromeMat: THREE.Material) {
    this.headlightBulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lensGeo = new THREE.SphereGeometry(0.08, 12, 12);

    // Left Headlight
    const hlEyeL1 = new THREE.Mesh(lensGeo, this.headlightBulbMat);
    hlEyeL1.position.set(-0.66, 0.46, -2.16);
    this.bodyMesh.add(hlEyeL1);

    const hlEyeL2 = new THREE.Mesh(lensGeo, this.headlightBulbMat);
    hlEyeL2.position.set(-0.82, 0.46, -2.06);
    this.bodyMesh.add(hlEyeL2);

    // Right Headlight
    const hlEyeR1 = new THREE.Mesh(lensGeo, this.headlightBulbMat);
    hlEyeR1.position.set(0.66, 0.46, -2.16);
    this.bodyMesh.add(hlEyeR1);

    const hlEyeR2 = new THREE.Mesh(lensGeo, this.headlightBulbMat);
    hlEyeR2.position.set(0.82, 0.46, -2.06);
    this.bodyMesh.add(hlEyeR2);

    // Forward Spotlights with cone angle
    this.headlightLeftSpot = new THREE.SpotLight(0xfff8e7, 0, 52, Math.PI / 5.5, 0.5, 1.2);
    this.headlightLeftSpot.position.set(-0.74, 0.46, -2.1);
    this.headlightLeftSpot.target.position.set(-0.74, 0, -25);
    this.bodyMesh.add(this.headlightLeftSpot);
    this.bodyMesh.add(this.headlightLeftSpot.target);

    this.headlightRightSpot = new THREE.SpotLight(0xfff8e7, 0, 52, Math.PI / 5.5, 0.5, 1.2);
    this.headlightRightSpot.position.set(0.74, 0.46, -2.1);
    this.headlightRightSpot.target.position.set(0.74, 0, -25);
    this.bodyMesh.add(this.headlightRightSpot);
    this.bodyMesh.add(this.headlightRightSpot.target);

    // Taillights
    this.brakeLightMat = new THREE.MeshBasicMaterial({ color: 0xdd1111 });

    if (this.customization.model === 'tuner') {
      // Iconic 4 Circular Red LED Halo Taillights (Exact match to reference image)
      const ringGeo = new THREE.TorusGeometry(0.095, 0.024, 12, 24);
      const haloMat = new THREE.MeshBasicMaterial({ color: 0xdd1111 });
      const coreGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.035, 16);
      coreGeo.rotateX(Math.PI / 2);
      const bezelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 18);
      bezelGeo.rotateX(Math.PI / 2);

      const lightOffsets = [-0.74, -0.48, 0.48, 0.74];
      for (const lx of lightOffsets) {
        // Black cylindrical housing bezel
        const bezel = new THREE.Mesh(bezelGeo, carbonMat);
        bezel.position.set(lx, 0.58, 2.22);
        this.bodyMesh.add(bezel);

        // Outer glowing LED red halo ring
        const halo = new THREE.Mesh(ringGeo, haloMat);
        halo.position.set(lx, 0.58, 2.235);
        this.bodyMesh.add(halo);

        // Inner high-intensity brake light projector
        const core = new THREE.Mesh(coreGeo, this.brakeLightMat);
        core.position.set(lx, 0.58, 2.23);
        this.bodyMesh.add(core);
      }
    } else {
      const tailBladeGeo = new THREE.BoxGeometry(0.65, 0.08, 0.08);

      const tlLeft = new THREE.Mesh(tailBladeGeo, this.brakeLightMat);
      tlLeft.position.set(-0.58, 0.54, 2.22);
      this.bodyMesh.add(tlLeft);

      const tlRight = new THREE.Mesh(tailBladeGeo, this.brakeLightMat);
      tlRight.position.set(0.58, 0.54, 2.22);
      this.bodyMesh.add(tlRight);
    }

    // Reverse lights
    this.reverseLightMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const revGeo = new THREE.BoxGeometry(0.18, 0.06, 0.06);
    const revL = new THREE.Mesh(revGeo, this.reverseLightMat);
    revL.position.set(-0.25, 0.22, 2.24);
    this.bodyMesh.add(revL);
    const revR = new THREE.Mesh(revGeo, this.reverseLightMat);
    revR.position.set(0.25, 0.22, 2.24);
    this.bodyMesh.add(revR);
  }

  private buildExhaustPipes(positions: { x: number; y: number; z: number; rotY?: number }[], chromeMat: THREE.Material) {
    const exhaustGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.22, 16);
    exhaustGeo.rotateX(Math.PI / 2);

    this.exhaustFlames = [];
    const flameGeo = new THREE.ConeGeometry(0.13, 0.95, 12);
    flameGeo.rotateX(-Math.PI / 2);

    positions.forEach((pos) => {
      // Chrome/Titanium Pipe Body
      const pipe = new THREE.Mesh(exhaustGeo, chromeMat);
      pipe.position.set(pos.x, pos.y, pos.z);
      if (pos.rotY) pipe.rotation.y = pos.rotY;
      this.bodyMesh.add(pipe);

      // Burnt Titanium Blue/Purple Lip Ring
      const tipRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.085, 0.014, 8, 16),
        new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.95, roughness: 0.1 })
      );
      tipRing.position.set(pos.x, pos.y, pos.z + 0.1);
      this.bodyMesh.add(tipRing);

      // Flame Cone (Dual Cyan/Blue Core + Amber/Orange Tip)
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(pos.x, pos.y, pos.z + 0.5);
      flame.scale.set(0, 0, 0);
      this.bodyMesh.add(flame);
      this.exhaustFlames.push(flame);
    });
  }

  private buildUnderglow() {
    if (this.customization.underglowColor === 'off') return;

    const underglowCanvas = document.createElement('canvas');
    underglowCanvas.width = 128;
    underglowCanvas.height = 256;
    const ctx = underglowCanvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 128, 10, 64, 128, 110);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);

    const underglowTex = new THREE.CanvasTexture(underglowCanvas);
    const colorVal = this.customization.underglowColor === 'rainbow' ? 0x06b6d4 : new THREE.Color(this.customization.underglowColor).getHex();

    this.underglowMat = new THREE.MeshBasicMaterial({
      map: underglowTex,
      color: colorVal,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const glowGeo = new THREE.PlaneGeometry(2.8, 5.0);
    glowGeo.rotateX(-Math.PI / 2);
    this.underglowMesh = new THREE.Mesh(glowGeo, this.underglowMat);
    this.underglowMesh.position.y = 0.03;
    this.group.add(this.underglowMesh);

    this.underglowLight = new THREE.PointLight(colorVal, 1.5, 6);
    this.underglowLight.position.set(0, 0.2, 0);
    this.group.add(this.underglowLight);
  }

  private buildWheels() {
    const wheelRadius = VEHICLE_CONFIG.WHEEL_RADIUS;
    const wheelWidth = 0.34;
    const custom = this.customization;

    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20);
    tireGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.9 });

    // Rim & Chrome materials
    const rimColor = new THREE.Color(custom.rimColor);
    const rimMat = new THREE.MeshStandardMaterial({
      color: rimColor,
      metalness: 0.95,
      roughness: 0.15,
    });
    const chromeWheelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1,
    });

    // Brake Disc & Caliper
    const discGeo = new THREE.CylinderGeometry(wheelRadius * 0.52, wheelRadius * 0.52, 0.03, 16);
    discGeo.rotateZ(Math.PI / 2);
    const discMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.3 });

    const caliperGeo = new THREE.BoxGeometry(0.08, 0.12, 0.16);
    const caliperMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(custom.caliperColor), metalness: 0.6, roughness: 0.3 });

    const wheelOffsets = [
      { name: 'FL', x: -1.02, y: wheelRadius + custom.stanceHeight, z: -1.35 },
      { name: 'FR', x: 1.02, y: wheelRadius + custom.stanceHeight, z: -1.35 },
      { name: 'RL', x: -1.04, y: wheelRadius + custom.stanceHeight, z: 1.35 },
      { name: 'RR', x: 1.04, y: wheelRadius + custom.stanceHeight, z: 1.35 },
    ];

    this.wheelMeshes = [];
    for (const offset of wheelOffsets) {
      const wheelGroup = new THREE.Group();
      wheelGroup.rotation.order = 'YXZ'; // Ensures Y-axis steering applies before X-axis rolling
      wheelGroup.position.set(offset.x, offset.y, offset.z);

      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      // Drilled Disc & Performance Caliper
      const disc = new THREE.Mesh(discGeo, discMat);
      wheelGroup.add(disc);

      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(offset.x > 0 ? -0.06 : 0.06, wheelRadius * 0.28, 0);
      wheelGroup.add(caliper);

      // Deep-dish Rim Barrel
      const rimBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(wheelRadius * 0.75, wheelRadius * 0.72, wheelWidth * 0.85, 20),
        rimMat
      );
      rimBarrel.rotation.z = Math.PI / 2;
      wheelGroup.add(rimBarrel);

      // Polished Deep Dish Outer Lip Ring
      const lipRing = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius * 0.76, 0.02, 12, 24),
        chromeWheelMat
      );
      lipRing.rotation.y = Math.PI / 2;
      lipRing.position.x = offset.x > 0 ? wheelWidth * 0.44 : -wheelWidth * 0.44;
      wheelGroup.add(lipRing);

      // Multi-spoke alloy pattern (5 twin spokes = 10 spokes)
      const spokeGeo = new THREE.BoxGeometry(0.025, wheelRadius * 0.68, 0.04);
      const spokeOuterX = offset.x > 0 ? wheelWidth * 0.38 : -wheelWidth * 0.38;
      for (let s = 0; s < 5; s++) {
        const ang = (s * Math.PI * 2) / 5;
        const spoke1 = new THREE.Mesh(spokeGeo, rimMat);
        spoke1.position.set(spokeOuterX, 0, 0);
        spoke1.rotation.x = ang - 0.08;
        wheelGroup.add(spoke1);

        const spoke2 = new THREE.Mesh(spokeGeo, rimMat);
        spoke2.position.set(spokeOuterX, 0, 0);
        spoke2.rotation.x = ang + 0.08;
        wheelGroup.add(spoke2);
      }

      // Central Hub & Chrome Center Cap
      const hubCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.04, 16),
        chromeWheelMat
      );
      hubCap.rotation.z = Math.PI / 2;
      hubCap.position.x = offset.x > 0 ? wheelWidth * 0.46 : -wheelWidth * 0.46;
      wheelGroup.add(hubCap);

      this.wheelMeshes.push(wheelGroup);
      this.group.add(wheelGroup);
    }
  }

  public update(dt: number, inputs: VehicleInputs, isRain: boolean) {
    if (this.collisionCooldown > 0) {
      this.collisionCooldown -= dt;
    }

    // -------------------------------------------------------------
    // 0. ROAD & TERRAIN SURFACE DETECTION (Phase 5)
    // -------------------------------------------------------------
    const step = 120;
    const cityLimit = 4 * step + 15;
    const distToXRoad = Math.abs(this.position.z - Math.round(this.position.z / step) * step);
    const distToZRoad = Math.abs(this.position.x - Math.round(this.position.x / step) * step);
    const isWithinGrid = Math.abs(this.position.x) <= cityLimit && Math.abs(this.position.z) <= cityLimit;
    const distToRoadCenter = isWithinGrid ? Math.min(distToXRoad, distToZRoad) : 999;

    if (distToRoadCenter <= 11.2) {
      this.surfaceType = 'road';
    } else if (distToRoadCenter <= 14.8) {
      this.surfaceType = 'sidewalk';
    } else {
      this.surfaceType = 'offroad';
      // Phase 5 & 10: Emit subtle off-road dust when driving fast on dirt/grass
      if (Math.abs(this.speed) > 3.5) {
        this.skidManager.emitOffroadDust(this.position, 1);
      }
    }

    const surfaceGripMultiplier =
      this.surfaceType === 'road' ? 1.0 : this.surfaceType === 'sidewalk' ? 0.85 : 0.55;
    const surfaceAccelMultiplier =
      this.surfaceType === 'road' ? 1.0 : this.surfaceType === 'sidewalk' ? 0.9 : 0.65;

    // -------------------------------------------------------------
    // 1. INPUT DECOUPLING: SEPARATE FORWARD BRAKING FROM REVERSE (Phase 3)
    // -------------------------------------------------------------
    const forwardInput = inputs.forward;
    const backwardInput = inputs.backward;
    const driftInput = inputs.drift;

    // Nitro handling (Phase 12)
    const hasNitroFuel = this.nitroAmount > 5;
    const nitroInput = inputs.nitro && hasNitroFuel;
    this.isNitroActive = nitroInput;

    if (nitroInput) {
      this.nitroAmount = Math.max(0, this.nitroAmount - dt * 25);
    } else {
      // Gradual nitro replenishment when cruising / idling
      this.nitroAmount = Math.min(100, this.nitroAmount + dt * 10);
    }

    let requestedThrottle = 0;
    let requestedBrake = 0;

    const absSpeed = Math.abs(this.speed);
    const isMovingForward = this.speed > 0.08;
    const isMovingReverse = this.speed < -0.08;
    const isStopped = !isMovingForward && !isMovingReverse;

    // Transmission & State Machine (Mutual exclusion of opposing forces)
    if (isStopped) {
      this.speed = 0;
      this.velocity.set(0, 0, 0);

      if (forwardInput) {
        this.gearMode = 'D';
        requestedThrottle = 1.0;
        this.standstillTimer = 0;
        this.mustReleaseBrakeBeforeReverse = false;
      } else if (backwardInput) {
        if (!this.mustReleaseBrakeBeforeReverse) {
          // Intentional reverse input: shift into R
          this.gearMode = 'R';
          requestedThrottle = 1.0;
        } else {
          // User was braking from forward motion and hasn't released brake pedal yet
          this.standstillTimer += dt;
          if (this.standstillTimer >= 0.65) {
            // Held brake for over 0.65s after stopping: engage reverse
            this.gearMode = 'R';
            requestedThrottle = 1.0;
            this.mustReleaseBrakeBeforeReverse = false;
          } else {
            requestedBrake = 1.0; // Hold foot on brake pedal at 0 KM/H stop
          }
        }
      } else {
        this.standstillTimer = 0;
        this.mustReleaseBrakeBeforeReverse = false;
      }
    } else if (isMovingForward) {
      this.gearMode = 'D';
      this.standstillTimer = 0;
      if (backwardInput) {
        // Moving forward + Backward input = STRICTLY FORWARD BRAKE (Phase 3)
        requestedBrake = 1.0;
        this.mustReleaseBrakeBeforeReverse = true;
      } else if (forwardInput) {
        requestedThrottle = 1.0;
        this.mustReleaseBrakeBeforeReverse = false;
      }
    } else {
      // isMovingReverse
      this.gearMode = 'R';
      this.standstillTimer = 0;
      if (forwardInput) {
        // Moving backwards + Forward input = STRICTLY REVERSE BRAKE
        requestedBrake = 1.0;
      } else if (backwardInput) {
        requestedThrottle = 1.0;
      }
    }

    // -------------------------------------------------------------
    // 2. BRAKING CALCULATION (ZERO-OVERSHOOT) (Phase 3)
    // -------------------------------------------------------------
    const isBraking = requestedBrake > 0;
    if (requestedBrake > 0) {
      const brakeDecel =
        VEHICLE_CONFIG.BRAKE_DECEL * requestedBrake +
        (driftInput ? VEHICLE_CONFIG.HANDBRAKE_DECEL : 0);
      const speedReduction = brakeDecel * dt;

      if (Math.abs(this.speed) <= speedReduction) {
        // Clean snap to 0 KM/H stop - never overshoots into reverse!
        this.speed = 0;
        this.velocity.set(0, 0, 0);
      } else {
        this.speed -= Math.sign(this.speed) * speedReduction;
      }
    }

    // -------------------------------------------------------------
    // 3. ROLLING FRICTION, COAST DRAG & ACCELERATION
    // -------------------------------------------------------------
    if (requestedBrake === 0) {
      if (requestedThrottle === 0) {
        if (absSpeed < VEHICLE_CONFIG.LOW_SPEED_THRESHOLD) {
          const frictionDelta = VEHICLE_CONFIG.CONSTANT_ROLLING_FRICTION * dt;
          if (absSpeed <= frictionDelta || absSpeed < VEHICLE_CONFIG.STATIC_STOP_THRESHOLD) {
            this.speed = 0;
            this.velocity.set(0, 0, 0);
          } else {
            this.speed -= Math.sign(this.speed) * frictionDelta;
          }
        } else {
          const dragDelta = VEHICLE_CONFIG.COAST_DRAG * dt;
          this.speed -= Math.sign(this.speed) * dragDelta;
        }
      } else {
        // Motive engine acceleration (forward or reverse)
        if (this.gearMode === 'D') {
          let accel = VEHICLE_CONFIG.ACCEL_FORCE * surfaceAccelMultiplier;
          if (this.customization.handlingPreset === 'drag') accel *= 1.35;

          if (nitroInput) {
            accel *= 1.6;
          }
          const baseTop =
            this.customization.handlingPreset === 'drag'
              ? VEHICLE_CONFIG.TOP_SPEED_FORWARD * 1.2
              : VEHICLE_CONFIG.TOP_SPEED_FORWARD;
          const topSpeed = nitroInput ? baseTop * 1.18 : baseTop;
          const speedRatio = Math.min(1.0, Math.max(0, this.speed) / topSpeed);
          const effectiveAccel = accel * (1.0 - Math.pow(speedRatio, 1.8));
          this.speed += effectiveAccel * dt;
        } else {
          const revRatio = Math.min(1.0, Math.abs(this.speed) / VEHICLE_CONFIG.TOP_SPEED_REVERSE);
          const effectiveAccel = VEHICLE_CONFIG.REVERSE_ACCEL * surfaceAccelMultiplier * (1.0 - revRatio);
          this.speed -= effectiveAccel * dt;
        }
      }
    }

    // -------------------------------------------------------------
    // 4. HANDBRAKE DRIFTING & LATERAL GRIP (Phase 8)
    // -------------------------------------------------------------
    this.isHandbrake = driftInput;
    const rainFactor = isRain ? 0.65 : 1.0;

    let targetGrip =
      VEHICLE_CONFIG.NORMAL_LATERAL_GRIP * rainFactor * surfaceGripMultiplier;
    if (this.customization.handlingPreset === 'drift') targetGrip *= 0.75;
    if (this.customization.handlingPreset === 'grip') targetGrip *= 1.2;

    if (this.isHandbrake) {
      targetGrip = VEHICLE_CONFIG.DRIFT_LATERAL_GRIP * rainFactor * surfaceGripMultiplier;
    }

    if (this.lateralGrip < targetGrip) {
      this.lateralGrip = Math.min(targetGrip, this.lateralGrip + VEHICLE_CONFIG.GRIP_RECOVERY_RATE * dt);
    } else {
      this.lateralGrip = Math.max(targetGrip, this.lateralGrip - 18.0 * dt);
    }

    // -------------------------------------------------------------
    // 5. STEERING & YAW INTEGRATION (Phase 2 - Prevent Spinning)
    // -------------------------------------------------------------
    let targetSteer = 0;
    if (inputs.left) targetSteer += VEHICLE_CONFIG.MAX_STEER_ANGLE;
    if (inputs.right) targetSteer -= VEHICLE_CONFIG.MAX_STEER_ANGLE;

    const speedDamping =
      1.0 -
      Math.min(
        0.65,
        (absSpeed / VEHICLE_CONFIG.TOP_SPEED_FORWARD) * VEHICLE_CONFIG.HIGH_SPEED_STEER_DAMPING
      );
    targetSteer *= speedDamping;

    const steerRate =
      targetSteer !== 0 ? VEHICLE_CONFIG.STEER_SPEED : VEHICLE_CONFIG.STEER_RETURN_SPEED;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, steerRate * dt);

    if (absSpeed > 0.25) {
      let turnRate = (this.speed / VEHICLE_CONFIG.WHEEL_BASE) * Math.tan(this.steerAngle);
      if (this.isDrifting) {
        turnRate *= VEHICLE_CONFIG.DRIFT_ANGULAR_BOOST;
      }
      this.angularVelocity = turnRate;
      this.heading += this.angularVelocity * dt;
    } else {
      this.angularVelocity = 0;
    }

    // Velocity vector alignment
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);
    const targetVel = new THREE.Vector3(forwardX * this.speed, 0, forwardZ * this.speed);

    const gripAlpha = Math.min(1.0, this.lateralGrip * dt);
    this.velocity.lerp(targetVel, gripAlpha);

    // Slip Angle Calculation
    if (absSpeed > 0.5) {
      const velDir = this.velocity.clone().normalize();
      const carForward = new THREE.Vector3(forwardX, 0, forwardZ);
      const dot = Math.min(1.0, Math.max(-1.0, velDir.dot(carForward)));
      this.slipAngle = Math.acos(dot);
    } else {
      this.slipAngle = 0;
    }

    // Drift Detection & Multiplier
    if (this.slipAngle > VEHICLE_CONFIG.DRIFT_SLIP_THRESHOLD && absSpeed > 5.5) {
      if (!this.isDrifting) {
        this.isDrifting = true;
        this.driftDuration = 0;
      }
      this.driftDuration += dt;
      const points = Math.round(absSpeed * 22 * dt * this.driftCombo);
      this.driftScore += points;
      if (this.driftDuration > 2.0 && this.driftCombo < 4) this.driftCombo = 2;
      if (this.driftDuration > 4.5 && this.driftCombo < 4) this.driftCombo = 3;
      if (this.driftDuration > 7.0 && this.driftCombo < 5) this.driftCombo = 4;
    } else {
      if (this.isDrifting) {
        this.isDrifting = false;
        this.driftCombo = 1;
      }
    }

    // -------------------------------------------------------------
    // 6. POSITION & COLLISION WITH PENETRATION RESOLUTION (Phase 4)
    // -------------------------------------------------------------
    let nextX = this.position.x + this.velocity.x * dt;
    let nextZ = this.position.z + this.velocity.z * dt;

    const carRadius = 1.15;
    let collided = false;

    if (this.collisionCooldown <= 0) {
      // Check building/barrier obstacles
      const allObstacles = [...this.obstacles];
      if (this.trafficManager && typeof this.trafficManager.getCollisionObstacles === 'function') {
        const trafficObs = this.trafficManager.getCollisionObstacles();
        for (const t of trafficObs) {
          allObstacles.push(t);
        }
      }

      for (const obs of allObstacles) {
        if (
          nextX + carRadius > obs.minX &&
          nextX - carRadius < obs.maxX &&
          nextZ + carRadius > obs.minZ &&
          nextZ - carRadius < obs.maxZ
        ) {
          collided = true;

          // Find minimum penetration vector to push vehicle out
          const overlapLeft = nextX + carRadius - obs.minX;
          const overlapRight = obs.maxX - (nextX - carRadius);
          const overlapTop = nextZ + carRadius - obs.minZ;
          const overlapBottom = obs.maxZ - (nextZ - carRadius);

          const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

          if (minOverlap === overlapLeft) {
            nextX = obs.minX - carRadius - 0.05;
            this.velocity.x = -Math.abs(this.velocity.x) * 0.22;
          } else if (minOverlap === overlapRight) {
            nextX = obs.maxX + carRadius + 0.05;
            this.velocity.x = Math.abs(this.velocity.x) * 0.22;
          } else if (minOverlap === overlapTop) {
            nextZ = obs.minZ - carRadius - 0.05;
            this.velocity.z = -Math.abs(this.velocity.z) * 0.22;
          } else {
            nextZ = obs.maxZ + carRadius + 0.05;
            this.velocity.z = Math.abs(this.velocity.z) * 0.22;
          }

          this.speed *= -0.22;
          this.damagePercent = Math.max(12, this.damagePercent - Math.round(absSpeed * 0.32));
          this.collisionCooldown = 0.25;

          // Play sound and trigger camera shake callback (Phase 4 & 6)
          this.soundManager.playCrash();
          if (this.onCollision) {
            this.onCollision();
          }
          break;
        }
      }
    }

    this.position.x = nextX;
    this.position.z = nextZ;

    // Phase 5: Never allow car to fall through the world
    this.position.y = Math.max(0, this.position.y);

    // Mutual controlled vehicle state calculation (Phase 2)
    if (this.collisionCooldown > 0.05) {
      this.activeState = 'collision';
    } else if (this.position.y > 0.45) {
      this.activeState = 'airborne';
    } else if (this.isDrifting) {
      this.activeState = 'drifting';
    } else if (isBraking) {
      this.activeState = 'braking';
    } else if (this.gearMode === 'R' && this.speed < -0.1) {
      this.activeState = 'reverse';
    } else if (requestedThrottle > 0 && this.speed >= 0) {
      this.activeState = 'accelerating';
    } else if (absSpeed > 0.25) {
      this.activeState = 'cruising';
    } else {
      this.activeState = 'idle';
    }

    // Gentle stable body roll on turns and pitch on braking (NO flipping)
    const targetRoll = THREE.MathUtils.clamp(-this.angularVelocity * 0.04, -0.06, 0.06);
    const targetPitch = THREE.MathUtils.clamp((isBraking ? 0.03 : -0.02 * requestedThrottle), -0.04, 0.04);
    this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, dt * 8);
    this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, dt * 8);

    this.group.position.copy(this.position);
    this.group.rotation.set(this.pitchAngle, this.heading, this.rollAngle);

    // Visual updates (wheels, underglow, police strobes, audio, skids)
    this.updateVisuals(dt, isBraking, requestedThrottle > 0, nitroInput, isRain);
  }

  private updateVisuals(dt: number, isBraking: boolean, isAccelerating: boolean, nitroInput: boolean, isRain: boolean) {
    const speedKmh = Math.round(Math.abs(this.speed * 3.6));
    const isReversing = this.gearMode === 'R';

    // 1. Wheel rotation & steering
    this.wheelRotation += (this.speed / VEHICLE_CONFIG.WHEEL_RADIUS) * dt;
    for (let i = 0; i < this.wheelMeshes.length; i++) {
      const wheel = this.wheelMeshes[i];
      if (i < 2) {
        wheel.rotation.set(this.wheelRotation, this.steerAngle, 0);
      } else {
        wheel.rotation.set(this.wheelRotation, 0, 0);
      }
    }

    // 2. Headlights, Brake lights, Reverse lights
    if (isBraking || (this.isHandbrake && Math.abs(this.speed) > 1)) {
      this.brakeLightMat.color.setHex(0xff1111);
    } else {
      this.brakeLightMat.color.setHex(this.headlightsOn ? 0x881111 : 0x220000);
    }

    if (isReversing) {
      this.reverseLightMat.color.setHex(0xffffff);
    } else {
      this.reverseLightMat.color.setHex(0x1a1a1a);
    }

    this.headlightLeftSpot.intensity = this.headlightsOn ? 2.8 : 0;
    this.headlightRightSpot.intensity = this.headlightsOn ? 2.8 : 0;
    this.headlightBulbMat.color.setHex(this.headlightsOn ? 0xffffff : 0x555555);

    // 3. Underglow Rainbow Pulse
    if (this.underglowMat && this.underglowLight) {
      if (this.customization.underglowColor === 'rainbow') {
        this.rainbowTimer += dt * 0.8;
        const color = new THREE.Color().setHSL(this.rainbowTimer % 1, 1.0, 0.5);
        this.underglowMat.color.copy(color);
        this.underglowLight.color.copy(color);
      }
    }

    // 4. Police Roof Strobe Animation (Alternating 8Hz flash)
    if (this.customization.model === 'police' && this.policeStrobeL && this.policeStrobeR && this.policeLightL && this.policeLightR) {
      this.policeTimer += dt * 10;
      const flash = Math.floor(this.policeTimer) % 2 === 0;

      this.policeStrobeL.visible = flash;
      this.policeLightL.intensity = flash ? 3.5 : 0;

      this.policeStrobeR.visible = !flash;
      this.policeLightR.intensity = !flash ? 3.5 : 0;
    }

    // 5. Nitro & High Acceleration / Drift Exhaust Flame Animation (matching reference image.png)
    const flameActive = (isAccelerating && speedKmh > 15) || nitroInput || (this.isDrifting && speedKmh > 10);
    for (let f = 0; f < this.exhaustFlames.length; f++) {
      const flame = this.exhaustFlames[f];
      if (flameActive) {
        const flicker = 0.85 + Math.random() * 0.45;
        const lengthMult = nitroInput ? 2.2 : (this.isDrifting ? 1.65 : 1.25);
        flame.scale.set(flicker, flicker, flicker * lengthMult);
        if (flame.material instanceof THREE.MeshBasicMaterial) {
          // Alternating cyan-blue core and orange flame jets (matching reference image)
          flame.material.color.setHex(f % 2 === 0 ? 0x00d2ff : 0xff7700);
          flame.material.opacity = 0.9 + Math.random() * 0.1;
        }
      } else {
        flame.scale.set(0, 0, 0);
      }
    }

    // 6. Vitals & Cash
    if (isAccelerating) {
      this.fuelPercent = Math.max(12, this.fuelPercent - dt * 0.05);
    }
    if (this.isDrifting) {
      this.cash += Math.round(dt * 18 * this.driftCombo);
    } else if (speedKmh > 15) {
      this.cash += Math.round(dt * 2);
    }

    // 7. Skid Marks & Smoke (Dramatic billowing white drift smoke matching reference image!)
    const shouldSkid =
      (this.isDrifting && Math.abs(this.speed) > 3) ||
      (isBraking && speedKmh > 30) ||
      (this.isHandbrake && speedKmh > 8);

    if (shouldSkid) {
      const rlOffset = new THREE.Vector3(-0.95, 0.05, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.position);
      const rrOffset = new THREE.Vector3(0.95, 0.05, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.position);

      this.skidManager.addSkidMark(rlOffset, rrOffset, this.heading);
      const smokeCount = this.isDrifting ? 3 : 1;
      this.skidManager.emitTireSmoke(rlOffset, smokeCount, isRain);
      this.skidManager.emitTireSmoke(rrOffset, smokeCount, isRain);

      this.soundManager.updateSkid(Math.min(1.0, this.slipAngle * 2 + (isBraking ? 0.4 : 0)));
    } else {
      this.soundManager.updateSkid(0);
    }

    // 8. Audio update
    const rpmNorm = Math.min(1.0, Math.max(0.15, (speedKmh % 45) / 45));
    this.soundManager.updateEngine(speedKmh, rpmNorm, isAccelerating ? 1.0 : 0);
  }

  public getTelemetry(): VehicleTelemetry {
    const speedKmh = Math.round(Math.abs(this.speed * 3.6));

    let gear = 'N';
    if (this.gearMode === 'R' || this.speed < -0.2) {
      gear = 'R';
    } else if (speedKmh === 0) {
      gear = 'P';
    } else if (speedKmh < 32) {
      gear = '1';
    } else if (speedKmh < 65) {
      gear = '2';
    } else if (speedKmh < 105) {
      gear = '3';
    } else if (speedKmh < 150) {
      gear = '4';
    } else if (speedKmh < 195) {
      gear = '5';
    } else {
      gear = '6';
    }

    let state: VehicleState = 'idle';
    if (this.isDrifting) state = 'drifting';
    else if (this.brakeLightMat.color.getHex() === 0xff1111) state = 'braking';
    else if (gear === 'R' && this.speed < -0.1) state = 'reverse';
    else if (this.speed > 0.5) state = 'accelerating';
    else if (speedKmh > 0) state = 'cruising';

    const rpm = Math.min(8500, Math.max(900, Math.round(900 + (speedKmh % 45) * 140)));

    return {
      speedKmh,
      rpm,
      gear,
      state,
      isDrifting: this.isDrifting,
      driftAngle: Math.round(THREE.MathUtils.radToDeg(this.slipAngle)),
      driftScore: this.driftScore,
      driftCombo: this.driftCombo,
      headlightsOn: this.headlightsOn,
      isBraking: this.brakeLightMat.color.getHex() === 0xff1111,
      isReversing: gear === 'R',
      nitroPercent: Math.round(this.nitroAmount),
      fuelPercent: Math.round(this.fuelPercent),
      damagePercent: Math.round(this.damagePercent),
      cash: this.cash,
      absOn: true,
      espOn: true,
      gripPercent: Math.min(100, Math.round((this.lateralGrip / VEHICLE_CONFIG.NORMAL_LATERAL_GRIP) * 100)),
      steerAngle: this.steerAngle,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      heading: this.heading,
      customization: this.customization,
    };
  }
}

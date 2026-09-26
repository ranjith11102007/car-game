import * as THREE from 'three';
import { CITY_CONFIG } from '../constants';
import { TrafficLightManager } from './TrafficLightManager';

export type TrafficType = 'sedan' | 'suv' | 'sports' | 'taxi' | 'truck';

export interface TrafficCar {
  id: number;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  direction: 'north' | 'south' | 'east' | 'west';
  speed: number;
  maxSpeed: number;
  type: TrafficType;
  length: number;
  width: number;
  color: number;
  headlights: THREE.MeshBasicMaterial;
  taillights: THREE.MeshBasicMaterial;
  wheelMeshes: THREE.Object3D[];
  wheelRotation: number;
}

export class TrafficManager {
  public scene: THREE.Scene;
  public cars: TrafficCar[] = [];
  public trafficLightManager: TrafficLightManager | null = null;
  private maxCars = 26;
  private spawnTimer = 0;
  private nextCarId = 1;

  // Shared geometry & materials for high-fidelity traffic vehicles
  private wheelGeo: THREE.CylinderGeometry;
  private rimGeo: THREE.CylinderGeometry;
  private spokeGeo: THREE.BoxGeometry;
  private wheelMat: THREE.MeshStandardMaterial;
  private glassMat: THREE.MeshStandardMaterial;
  private chromeMat: THREE.MeshStandardMaterial;
  private darkTrimMat: THREE.MeshStandardMaterial;
  private shadowMat: THREE.MeshBasicMaterial;

  private carColors = [
    0xd97706, // Taxi amber
    0xdc2626, // Crimson metallic red
    0x1d72b8, // Metallic electric blue
    0x334155, // Gunmetal slate grey
    0xf8fafc, // Pearl white
    0x0f172a, // Obsidian black
    0x059669, // Emerald metallic green
    0x4f46e5, // Indigo blue
    0xea580c, // Sunset orange
  ];

  constructor(scene: THREE.Scene, trafficLightManager?: TrafficLightManager) {
    this.scene = scene;
    this.trafficLightManager = trafficLightManager || null;

    this.wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 18);
    this.wheelGeo.rotateZ(Math.PI / 2);
    this.rimGeo = new THREE.CylinderGeometry(0.23, 0.23, 0.29, 16);
    this.rimGeo.rotateZ(Math.PI / 2);
    this.spokeGeo = new THREE.BoxGeometry(0.3, 0.42, 0.045);

    this.wheelMat = new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.9 });
    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x07101e,
      roughness: 0.06,
      metalness: 0.94,
    });
    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.15,
      metalness: 0.92,
    });
    this.darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.65,
      metalness: 0.35,
    });

    // Shared soft ground shadow texture
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 256;
    const sctx = shadowCanvas.getContext('2d')!;
    const sgrad = sctx.createRadialGradient(64, 128, 18, 64, 128, 112);
    sgrad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    sgrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.36)');
    sgrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    sctx.fillStyle = sgrad;
    sctx.fillRect(0, 0, 128, 256);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    });
  }

  public init(playerPos: THREE.Vector3) {
    // Initial surrounding traffic
    this.spawnCarAt(new THREE.Vector3(playerPos.x - 3.5, 0, playerPos.z - 36), 'north', 0, 'sedan', 0xf8fafc);
    this.spawnCarAt(new THREE.Vector3(playerPos.x - 3.5, 0, playerPos.z - 78), 'north', 0, 'suv', 0x0f172a);
    this.spawnCarAt(new THREE.Vector3(playerPos.x + 6.8, 0, playerPos.z - 22), 'north', 0, 'sports', 0xdc2626);
    this.spawnCarAt(new THREE.Vector3(playerPos.x + 6.8, 0, playerPos.z - 65), 'north', 0, 'taxi', 0xd97706);
    this.spawnCarAt(new THREE.Vector3(playerPos.x - 3.5, 0, playerPos.z + 45), 'south', Math.PI, 'truck', 0x1d72b8);

    for (let i = 0; i < this.maxCars - 5; i++) {
      this.spawnCarRandom(playerPos, 50, 260);
    }
  }

  public spawnCarAt(
    pos: THREE.Vector3,
    direction: 'north' | 'south' | 'east' | 'west',
    heading: number,
    type: TrafficType,
    colorHex: number
  ) {
    const { mesh, hlMat, tlMat, length, width, wheels } = this.createVehicleMesh(type, colorHex);
    mesh.position.copy(pos);
    mesh.rotation.y = heading;
    this.scene.add(mesh);

    const baseSpeed =
      type === 'sports'
        ? 14 + Math.random() * 5
        : type === 'truck'
        ? 9 + Math.random() * 3
        : 11 + Math.random() * 4;

    this.cars.push({
      id: this.nextCarId++,
      mesh,
      pos: pos.clone(),
      direction,
      speed: baseSpeed,
      maxSpeed: baseSpeed,
      type,
      length,
      width,
      color: colorHex,
      headlights: hlMat,
      taillights: tlMat,
      wheelMeshes: wheels,
      wheelRotation: 0,
    });
  }

  /**
   * Builds realistic, sculpted 3D traffic vehicles (Luxury Sedan, SUV, Widebody Sports Coupe, Taxi, Heavy Box Truck)
   */
  private createVehicleMesh(
    type: TrafficType,
    colorHex: number
  ): {
    mesh: THREE.Group;
    hlMat: THREE.MeshBasicMaterial;
    tlMat: THREE.MeshBasicMaterial;
    length: number;
    width: number;
    wheels: THREE.Object3D[];
  } {
    const group = new THREE.Group();
    const wheels: THREE.Object3D[] = [];

    const paintMat = new THREE.MeshStandardMaterial({
      color: type === 'taxi' ? 0xf59e0b : colorHex,
      roughness: 0.16,
      metalness: 0.84,
    });

    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const tlMat = new THREE.MeshBasicMaterial({ color: 0xbb1111 });

    let length = 4.55;
    let width = 1.96;

    if (type === 'suv') {
      length = 4.85;
      width = 2.12;

      // 1. Sculpted Lower SUV Body & Rocker Trim
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.68, length), paintMat);
      body.position.y = 0.62;
      body.castShadow = true;
      group.add(body);

      const rockerTrim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.04, 0.14, length * 0.96), this.darkTrimMat);
      rockerTrim.position.y = 0.34;
      group.add(rockerTrim);

      // Sloped Front Hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.14, 1.45), paintMat);
      hood.position.set(0, 0.96, -1.55);
      hood.rotation.x = -0.05;
      group.add(hood);

      // Greenhouse Cabin & Body-Colored Roof Panel
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.86, 0.56, length * 0.58), this.glassMat);
      cabin.position.set(0, 1.22, 0.18);
      group.add(cabin);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.06, length * 0.54), paintMat);
      roof.position.set(0, 1.52, 0.2);
      group.add(roof);

      // Chrome Roof Rails
      const railGeo = new THREE.BoxGeometry(0.05, 0.06, length * 0.5);
      const railL = new THREE.Mesh(railGeo, this.chromeMat);
      railL.position.set(-width * 0.36, 1.58, 0.2);
      const railR = new THREE.Mesh(railGeo, this.chromeMat);
      railR.position.set(width * 0.36, 1.58, 0.2);
      group.add(railL, railR);

      // Front SUV Chrome Grille & Skid Plate
      const grille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.58, 0.34, 0.08), this.darkTrimMat);
      grille.position.set(0, 0.68, -length * 0.5 - 0.01);
      group.add(grille);

      const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(width * 0.65, 0.12, 0.12), this.chromeMat);
      skidPlate.position.set(0, 0.32, -length * 0.5);
      group.add(skidPlate);

      // Flared Wheel Arches
      this.addTrafficWheelArches(group, width, length * 0.32, 0.46, this.darkTrimMat);
      this.addTrafficSideMirrors(group, width, 1.02, -0.78, paintMat);
    } else if (type === 'sports') {
      length = 4.4;
      width = 2.04;

      // 1. Low-Slung Widebody Sports Coupe Chassis
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.42, length), paintMat);
      body.position.y = 0.42;
      body.castShadow = true;
      group.add(body);

      // Sculpted Aero Hood
      const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.12, 1.55), paintMat);
      hood.position.set(0, 0.58, -1.25);
      hood.rotation.x = -0.07;
      group.add(hood);

      // Fastback Coupe Greenhouse & Roof
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.44, length * 0.46), this.glassMat);
      cabin.position.set(0, 0.82, 0.08);
      group.add(cabin);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.74, 0.05, 1.25), paintMat);
      roof.position.set(0, 1.05, 0.08);
      group.add(roof);

      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.05, 0.88), this.glassMat);
      rearGlass.position.set(0, 0.88, 0.95);
      rearGlass.rotation.x = 0.36;
      group.add(rearGlass);

      // Front Splitter, Side Skirts & Rear GT Wing
      const splitter = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, 0.05, 0.45), this.darkTrimMat);
      splitter.position.set(0, 0.16, -length * 0.48);
      group.add(splitter);

      const wing = new THREE.Mesh(new THREE.BoxGeometry(width * 0.96, 0.05, 0.32), this.darkTrimMat);
      wing.position.set(0, 0.88, length * 0.45);
      group.add(wing);
      const pylonL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.12), this.darkTrimMat);
      pylonL.position.set(-0.46, 0.74, length * 0.44);
      const pylonR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.26, 0.12), this.darkTrimMat);
      pylonR.position.set(0.46, 0.74, length * 0.44);
      group.add(pylonL, pylonR);

      // Widebody Fender Arches & Mirrors
      this.addTrafficWheelArches(group, width, length * 0.31, 0.45, paintMat);
      this.addTrafficSideMirrors(group, width, 0.78, -0.58, paintMat);
    } else if (type === 'truck') {
      length = 6.3;
      width = 2.34;

      // 1. Heavy Commercial Cab
      const cab = new THREE.Mesh(new THREE.BoxGeometry(width * 0.94, 1.25, 2.15), paintMat);
      cab.position.set(0, 0.96, -1.85);
      cab.castShadow = true;
      group.add(cab);

      // Cab Hood & Heavy Chrome Grille
      const cabHood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.75, 0.95), paintMat);
      cabHood.position.set(0, 0.72, -2.55);
      group.add(cabHood);

      const chromeGrille = new THREE.Mesh(new THREE.BoxGeometry(width * 0.68, 0.56, 0.08), this.chromeMat);
      chromeGrille.position.set(0, 0.74, -3.04);
      group.add(chromeGrille);

      const heavyBumper = new THREE.Mesh(new THREE.BoxGeometry(width * 0.98, 0.24, 0.18), this.chromeMat);
      heavyBumper.position.set(0, 0.36, -3.06);
      group.add(heavyBumper);

      // Cab Windshield & Side Windows
      const win = new THREE.Mesh(new THREE.BoxGeometry(width * 0.88, 0.55, 1.18), this.glassMat);
      win.position.set(0, 1.38, -1.65);
      group.add(win);

      // Rear Ribbed Cargo Box with Rear Roll-up Door Frame
      const boxMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.4, metalness: 0.25 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(width * 1.02, 1.95, 3.85), boxMat);
      box.position.set(0, 1.42, 1.15);
      box.castShadow = true;
      group.add(box);

      const rearFrame = new THREE.Mesh(new THREE.BoxGeometry(width * 1.03, 1.96, 0.08), this.chromeMat);
      rearFrame.position.set(0, 1.42, 3.06);
      group.add(rearFrame);
    } else {
      // Executive Sedan & City Taxi
      length = 4.55;
      width = 1.96;

      // 1. Sculpted Sedan Lower Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, 0.48, length), paintMat);
      body.position.y = 0.46;
      body.castShadow = true;
      group.add(body);

      // Sloped Front Hood & Trunk Deck
      const hood = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.12, 1.45), paintMat);
      hood.position.set(0, 0.62, -1.38);
      hood.rotation.x = -0.05;
      group.add(hood);

      const trunk = new THREE.Mesh(new THREE.BoxGeometry(width * 0.85, 0.12, 0.95), paintMat);
      trunk.position.set(0, 0.64, 1.62);
      trunk.rotation.x = 0.03;
      group.add(trunk);

      // Raked Sedan Greenhouse & Body-Colored Roof Panel
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.48, length * 0.48), this.glassMat);
      cabin.position.set(0, 0.88, 0.08);
      group.add(cabin);

      const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.78, 0.05, 1.38), paintMat);
      roof.position.set(0, 1.13, 0.08);
      group.add(roof);

      const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(width * 0.76, 0.05, 0.78), this.glassMat);
      rearGlass.position.set(0, 0.92, 0.98);
      rearGlass.rotation.x = 0.4;
      group.add(rearGlass);

      // Executive Front Grille & Lower Intake
      const grilleFrame = new THREE.Mesh(new THREE.BoxGeometry(width * 0.52, 0.24, 0.06), this.chromeMat);
      grilleFrame.position.set(0, 0.48, -length * 0.5);
      group.add(grilleFrame);

      const grilleCore = new THREE.Mesh(new THREE.BoxGeometry(width * 0.48, 0.2, 0.08), this.darkTrimMat);
      grilleCore.position.set(0, 0.48, -length * 0.5 - 0.01);
      group.add(grilleCore);

      // Wheel Arches & Side Mirrors
      this.addTrafficWheelArches(group, width, length * 0.31, 0.44, paintMat);
      this.addTrafficSideMirrors(group, width, 0.82, -0.62, paintMat);

      if (type === 'taxi') {
        // Illuminated Taxi Roof Sign + Checker Side Stripe
        const signBase = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.26), this.darkTrimMat);
        signBase.position.set(0, 1.17, 0.05);
        group.add(signBase);

        const signGeo = new THREE.BoxGeometry(0.62, 0.16, 0.22);
        const signMat = new THREE.MeshBasicMaterial({ color: 0xfff077 });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, 1.26, 0.05);
        group.add(sign);
      }
    }

    // Soft Ground Shadow under every vehicle
    const shadowGeo = new THREE.PlaneGeometry(width * 1.18, length * 1.08);
    shadowGeo.rotateX(-Math.PI / 2);
    const groundShadow = new THREE.Mesh(shadowGeo, this.shadowMat);
    groundShadow.position.y = 0.02;
    group.add(groundShadow);

    // Headlights (Front: -Z)
    const hlZ = type === 'truck' ? -3.05 : -length * 0.5 - 0.01;
    const hlGeo = new THREE.BoxGeometry(0.34, 0.11, 0.06);
    const hlL = new THREE.Mesh(hlGeo, hlMat);
    hlL.position.set(-width * 0.35, 0.52, hlZ);
    const hlR = new THREE.Mesh(hlGeo, hlMat);
    hlR.position.set(width * 0.35, 0.52, hlZ);
    group.add(hlL, hlR);

    // Taillights & Rear License Plate (Rear: +Z)
    const tlZ = type === 'truck' ? 3.08 : length * 0.5 + 0.01;
    const tlGeo = new THREE.BoxGeometry(0.42, 0.11, 0.06);
    const tlL = new THREE.Mesh(tlGeo, tlMat);
    tlL.position.set(-width * 0.34, 0.56, tlZ);
    const tlR = new THREE.Mesh(tlGeo, tlMat);
    tlR.position.set(width * 0.34, 0.56, tlZ);
    group.add(tlL, tlR);

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    plate.position.set(0, 0.42, tlZ + 0.01);
    group.add(plate);

    // 4 Detailed Multi-Spoke Alloy Wheels
    const wX = width * 0.48;
    const wZ = length * 0.31;
    const wheelY = 0.34;

    const wheelCoords = [
      { x: -wX, z: -wZ },
      { x: wX, z: -wZ },
      { x: -wX, z: wZ },
      { x: wX, z: wZ },
    ];

    for (const wc of wheelCoords) {
      const wGroup = new THREE.Group();
      wGroup.position.set(wc.x, wheelY, wc.z);

      const tire = new THREE.Mesh(this.wheelGeo, this.wheelMat);
      tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(this.rimGeo, this.chromeMat);
      wGroup.add(rim);

      const spoke1 = new THREE.Mesh(this.spokeGeo, this.chromeMat);
      const spoke2 = new THREE.Mesh(this.spokeGeo, this.chromeMat);
      spoke2.rotation.x = Math.PI / 2;
      wGroup.add(spoke1, spoke2);

      wheels.push(wGroup);
      group.add(wGroup);
    }

    return { mesh: group, hlMat, tlMat, length, width, wheels };
  }

  private addTrafficWheelArches(
    group: THREE.Group,
    width: number,
    wZ: number,
    radius: number,
    mat: THREE.Material
  ) {
    const archGeo = new THREE.CylinderGeometry(radius, radius, 0.18, 16);
    archGeo.rotateZ(Math.PI / 2);
    const coords = [
      { x: -width * 0.48, z: -wZ },
      { x: width * 0.48, z: -wZ },
      { x: -width * 0.48, z: wZ },
      { x: width * 0.48, z: wZ },
    ];
    for (const c of coords) {
      const arch = new THREE.Mesh(archGeo, mat);
      arch.position.set(c.x, 0.42, c.z);
      group.add(arch);
    }
  }

  private addTrafficSideMirrors(
    group: THREE.Group,
    width: number,
    yPos: number,
    zPos: number,
    mat: THREE.Material
  ) {
    const mirrorGeo = new THREE.BoxGeometry(0.2, 0.1, 0.12);
    const mL = new THREE.Mesh(mirrorGeo, mat);
    mL.position.set(-width * 0.48, yPos, zPos);
    const mR = new THREE.Mesh(mirrorGeo, mat);
    mR.position.set(width * 0.48, yPos, zPos);
    group.add(mL, mR);
  }

  private spawnCarRandom(playerPos: THREE.Vector3, minDist: number, maxDist: number) {
    const half = CITY_CONFIG.GRID_HALF_EXTENT;
    const step = CITY_CONFIG.BLOCK_SIZE;
    const roadW = CITY_CONFIG.ROAD_WIDTH;

    const isXRoad = Math.random() > 0.5;
    const gridIndex = Math.floor((Math.random() - 0.5) * (half * 2 + 1));
    const laneOffset = (roadW * 0.25) * (Math.random() > 0.5 ? 1 : -1);

    let x = 0;
    let z = 0;
    let direction: 'north' | 'south' | 'east' | 'west' = 'east';
    let heading = 0;

    if (isXRoad) {
      z = gridIndex * step + laneOffset;
      x = playerPos.x + (Math.random() > 0.5 ? 1 : -1) * (minDist + Math.random() * (maxDist - minDist));
      if (laneOffset > 0) {
        direction = 'east';
        heading = -Math.PI / 2;
      } else {
        direction = 'west';
        heading = Math.PI / 2;
      }
    } else {
      x = gridIndex * step + laneOffset;
      z = playerPos.z + (Math.random() > 0.5 ? 1 : -1) * (minDist + Math.random() * (maxDist - minDist));
      if (laneOffset > 0) {
        direction = 'south';
        heading = Math.PI;
      } else {
        direction = 'north';
        heading = 0;
      }
    }

    const pos = new THREE.Vector3(x, 0, z);
    if (pos.distanceTo(playerPos) < minDist) return;

    // Pick random vehicle type
    const types: TrafficType[] = ['sedan', 'sedan', 'suv', 'sports', 'taxi', 'truck'];
    const type = types[Math.floor(Math.random() * types.length)];
    const color = this.carColors[Math.floor(Math.random() * this.carColors.length)];

    this.spawnCarAt(pos, direction, heading, type, color);
  }

  public update(dt: number, playerPos: THREE.Vector3, isNightOrRain: boolean) {
    const cityLimit = CITY_CONFIG.GRID_HALF_EXTENT * CITY_CONFIG.BLOCK_SIZE + 120;

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];

      let targetSpeed = car.maxSpeed;

      // 1. Traffic Light AI (Phase 17)
      if (this.trafficLightManager) {
        const shouldStop = this.trafficLightManager.shouldStopForLight(car.pos.x, car.pos.z, car.direction);
        if (shouldStop) {
          targetSpeed = 0;
        }
      }

      // 2. Yield to Player if approaching
      const distToPlayer = car.pos.distanceTo(playerPos);
      if (distToPlayer < 14) {
        // Compute if player is in front of traffic car
        const toPlayer = playerPos.clone().sub(car.pos);
        let isPlayerAhead = false;
        if (car.direction === 'east' && toPlayer.x > 0 && Math.abs(toPlayer.z) < 4.5) isPlayerAhead = true;
        else if (car.direction === 'west' && toPlayer.x < 0 && Math.abs(toPlayer.z) < 4.5) isPlayerAhead = true;
        else if (car.direction === 'south' && toPlayer.z > 0 && Math.abs(toPlayer.x) < 4.5) isPlayerAhead = true;
        else if (car.direction === 'north' && toPlayer.z < 0 && Math.abs(toPlayer.x) < 4.5) isPlayerAhead = true;

        if (isPlayerAhead) {
          targetSpeed = 0;
        }
      }

      // 3. Avoid rear-ending other traffic vehicles ahead in the same lane
      for (let j = 0; j < this.cars.length; j++) {
        if (i === j) continue;
        const other = this.cars[j];
        if (other.direction === car.direction) {
          const dX = other.pos.x - car.pos.x;
          const dZ = other.pos.z - car.pos.z;

          let isAhead = false;
          let distAhead = 0;

          if (car.direction === 'east' && dX > 0 && Math.abs(dZ) < 3.0) {
            isAhead = true;
            distAhead = dX;
          } else if (car.direction === 'west' && dX < 0 && Math.abs(dZ) < 3.0) {
            isAhead = true;
            distAhead = -dX;
          } else if (car.direction === 'south' && dZ > 0 && Math.abs(dX) < 3.0) {
            isAhead = true;
            distAhead = dZ;
          } else if (car.direction === 'north' && dZ < 0 && Math.abs(dX) < 3.0) {
            isAhead = true;
            distAhead = -dZ;
          }

          if (isAhead && distAhead < 18) {
            targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed * 0.8));
          }
        }
      }

      // Smooth acceleration / deceleration
      const accelRate = targetSpeed < car.speed ? 7.0 : 3.5;
      car.speed = THREE.MathUtils.lerp(car.speed, targetSpeed, dt * accelRate);

      // Move vehicle
      let vx = 0;
      let vz = 0;
      if (car.direction === 'east') vx = car.speed;
      else if (car.direction === 'west') vx = -car.speed;
      else if (car.direction === 'south') vz = car.speed;
      else if (car.direction === 'north') vz = -car.speed;

      car.pos.x += vx * dt;
      car.pos.z += vz * dt;
      car.mesh.position.copy(car.pos);

      // Wheel rotation
      car.wheelRotation += (car.speed / 0.33) * dt;
      for (const w of car.wheelMeshes) {
        w.rotation.x = car.wheelRotation;
      }

      // Headlights & Taillights
      car.headlights.color.setHex(isNightOrRain ? 0xffffff : 0x555555);
      if (car.speed < 1.5 || targetSpeed < car.speed) {
        car.taillights.color.setHex(0xff1111); // bright red brake light
      } else {
        car.taillights.color.setHex(isNightOrRain ? 0x991111 : 0x330000);
      }

      // Despawn if out of bounds or too far from player
      if (distToPlayer > 320 || Math.abs(car.pos.x) > cityLimit || Math.abs(car.pos.z) > cityLimit) {
        this.scene.remove(car.mesh);
        this.cars.splice(i, 1);
        this.spawnCarRandom(playerPos, 80, 220);
      }
    }

    // Replenish traffic population
    this.spawnTimer += dt;
    if (this.spawnTimer > 1.8) {
      this.spawnTimer = 0;
      if (this.cars.length < this.maxCars) {
        this.spawnCarRandom(playerPos, 70, 230);
      }
    }
  }

  /**
   * Returns list of bounding boxes for all active traffic vehicles for player collision
   */
  public getCollisionObstacles() {
    return this.cars.map((c) => ({
      minX: c.pos.x - c.width * 0.5,
      maxX: c.pos.x + c.width * 0.5,
      minZ: c.pos.z - c.length * 0.5,
      maxZ: c.pos.z + c.length * 0.5,
      type: 'traffic' as const,
      carRef: c,
    }));
  }
}

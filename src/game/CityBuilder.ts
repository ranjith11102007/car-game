import * as THREE from 'three';
import { CITY_CONFIG, CITY_LANDMARKS } from '../constants';
import { CityLandmark } from '../types';
import { EnvironmentManager } from './EnvironmentManager';
import { TrafficLightManager } from './TrafficLightManager';

export interface CollisionObstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  type: 'building' | 'barrier' | 'pillar';
}

export interface RoadSegment {
  type: 'x-road' | 'z-road' | 'intersection';
  x: number;
  z: number;
  width: number;
  length: number;
}

export class CityBuilder {
  public scene: THREE.Scene;
  public envManager: EnvironmentManager;
  public trafficLightManager: TrafficLightManager | null = null;
  public obstacles: CollisionObstacle[] = [];
  public roads: RoadSegment[] = [];
  public cityRoot: THREE.Group;

  // Shared geometry & materials for high rendering performance
  private roadMaterial: THREE.MeshStandardMaterial;
  private sidewalkMaterial: THREE.MeshStandardMaterial;
  private whiteLineMaterial: THREE.MeshBasicMaterial;
  private yellowLineMaterial: THREE.MeshBasicMaterial;
  private crosswalkMaterial: THREE.MeshBasicMaterial;
  private curbMaterial: THREE.MeshStandardMaterial;
  private grassMaterial: THREE.MeshStandardMaterial;
  private lampPostMaterial: THREE.MeshStandardMaterial;
  private lampHeadMaterial: THREE.MeshBasicMaterial;
  private barkMaterial: THREE.MeshStandardMaterial;
  private leavesMaterial: THREE.MeshStandardMaterial;
  private windowMaterial: THREE.MeshStandardMaterial;
  private asphaltTexture: THREE.CanvasTexture;
  private lightPoolTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene, envManager: EnvironmentManager, trafficLightManager?: TrafficLightManager) {
    this.scene = scene;
    this.envManager = envManager;
    this.trafficLightManager = trafficLightManager || null;
    this.cityRoot = new THREE.Group();
    this.scene.add(this.cityRoot);

    // Procedural asphalt grain & wetness response
    this.asphaltTexture = this.createAsphaltTexture();
    this.lightPoolTexture = this.createLightPoolTexture();

    // Realistic PBR materials (Bright, sunlit, vibrant palette)
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x48505c, // Sunlit warm grey asphalt
      map: this.asphaltTexture,
      roughnessMap: this.asphaltTexture,
      roughness: 0.72,
      metalness: 0.05,
    });
    this.envManager.roadMaterials.push(this.roadMaterial);

    this.sidewalkMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0d5de, // Luminous light concrete sidewalk
      roughness: 0.82,
      metalness: 0.02,
    });

    this.curbMaterial = new THREE.MeshStandardMaterial({
      color: 0x9ba2ad,
      roughness: 0.85,
    });

    this.grassMaterial = new THREE.MeshStandardMaterial({
      color: 0x588c46, // Fresh, sunny bright lawn green
      roughness: 0.9,
      metalness: 0.0,
    });

    this.whiteLineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.yellowLineMaterial = new THREE.MeshBasicMaterial({ color: 0xffbe1a });
    this.crosswalkMaterial = new THREE.MeshBasicMaterial({ color: 0xf5f5f5 });

    this.lampPostMaterial = new THREE.MeshStandardMaterial({
      color: 0x33373d,
      roughness: 0.5,
      metalness: 0.8,
    });

    this.lampHeadMaterial = new THREE.MeshBasicMaterial({
      color: 0x444444,
    });
    this.envManager.streetLightMaterials.push(this.lampHeadMaterial);

    this.barkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 });
    this.leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2d6328, roughness: 0.8 });

    this.windowMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4856,
      emissive: 0xffe699,
      emissiveIntensity: 0.08,
      roughness: 0.3,
      metalness: 0.6,
    });
    this.envManager.windowMaterials.push(this.windowMaterial);
  }

  public build() {
    this.buildGroundBase();
    this.buildRoadNetwork();
    this.buildBuildingsAndBlocks();
    this.buildBridgesAndOverpasses();
    this.buildDowntownNeonBillboards();
    this.buildStuntRamp();
    this.buildDistantSkyline();
    this.buildRedRockCliffs();
  }

  private buildGroundBase() {
    const totalSize = (CITY_CONFIG.GRID_HALF_EXTENT * 2 + 1) * CITY_CONFIG.BLOCK_SIZE + 200;
    const groundGeo = new THREE.PlaneGeometry(totalSize, totalSize);
    groundGeo.rotateX(-Math.PI / 2);
    const ground = new THREE.Mesh(groundGeo, this.grassMaterial);
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.cityRoot.add(ground);

    // Coastal Ocean Bay along the perimeter horizon (like in reference image!)
    const oceanGeo = new THREE.PlaneGeometry(totalSize * 1.5, 450);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Sparkling azure turquoise ocean
      roughness: 0.08,
      metalness: 0.88,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.position.set(0, -0.2, -(CITY_CONFIG.GRID_HALF_EXTENT * CITY_CONFIG.BLOCK_SIZE + 260));
    this.cityRoot.add(ocean);

    // Sandy beach shoreline strip
    const beachGeo = new THREE.PlaneGeometry(totalSize * 1.5, 30);
    beachGeo.rotateX(-Math.PI / 2);
    const beachMat = new THREE.MeshStandardMaterial({ color: 0xf6d8ae, roughness: 0.85 });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.position.set(0, -0.08, -(CITY_CONFIG.GRID_HALF_EXTENT * CITY_CONFIG.BLOCK_SIZE + 80));
    this.cityRoot.add(beach);
  }

  private buildRoadNetwork() {
    const half = CITY_CONFIG.GRID_HALF_EXTENT;
    const step = CITY_CONFIG.BLOCK_SIZE;
    const roadW = CITY_CONFIG.ROAD_WIDTH;
    const totalSpan = half * 2 * step + step;

    // Build East-West roads (along X)
    for (let i = -half; i <= half; i++) {
      const z = i * step;

      // Road asphalt surface
      const roadGeo = new THREE.PlaneGeometry(totalSpan, roadW);
      roadGeo.rotateX(-Math.PI / 2);
      const roadMesh = new THREE.Mesh(roadGeo, this.roadMaterial);
      roadMesh.position.set(0, 0.01, z);
      roadMesh.receiveShadow = true;
      this.cityRoot.add(roadMesh);

      this.roads.push({
        type: 'x-road',
        x: 0,
        z,
        width: roadW,
        length: totalSpan,
      });

      // Road markings along X
      this.buildRoadMarkingsX(totalSpan, z, roadW);

      // Sidewalks along X
      this.buildSidewalksX(totalSpan, z, roadW);
    }

    // Build North-South roads (along Z)
    for (let i = -half; i <= half; i++) {
      const x = i * step;

      // Road asphalt surface
      const roadGeo = new THREE.PlaneGeometry(roadW, totalSpan);
      roadGeo.rotateX(-Math.PI / 2);
      const roadMesh = new THREE.Mesh(roadGeo, this.roadMaterial);
      roadMesh.position.set(x, 0.01, 0);
      roadMesh.receiveShadow = true;
      this.cityRoot.add(roadMesh);

      this.roads.push({
        type: 'z-road',
        x,
        z: 0,
        width: roadW,
        length: totalSpan,
      });

      // Road markings along Z
      this.buildRoadMarkingsZ(x, totalSpan, roadW);

      // Sidewalks along Z
      this.buildSidewalksZ(x, totalSpan, roadW);
    }

    // Build intersections with crosswalks and traffic lights
    for (let ix = -half; ix <= half; ix++) {
      for (let iz = -half; iz <= half; iz++) {
        const x = ix * step;
        const z = iz * step;
        this.buildIntersectionDetails(x, z, roadW);
      }
    }
  }

  private buildRoadMarkingsX(totalSpan: number, z: number, roadW: number) {
    const markingGroup = new THREE.Group();

    // Double yellow center lines
    const yellowGeo = new THREE.PlaneGeometry(totalSpan, 0.18);
    yellowGeo.rotateX(-Math.PI / 2);

    const yellow1 = new THREE.Mesh(yellowGeo, this.yellowLineMaterial);
    yellow1.position.set(0, 0.02, z - 0.22);
    markingGroup.add(yellow1);

    const yellow2 = new THREE.Mesh(yellowGeo, this.yellowLineMaterial);
    yellow2.position.set(0, 0.02, z + 0.22);
    markingGroup.add(yellow2);

    // Dashed white lane lines
    // Lane 1 divider (+roadW/4) and Lane 2 divider (-roadW/4)
    const dashLength = 3.5;
    const dashGap = 5.0;
    const dashCount = Math.floor(totalSpan / (dashLength + dashGap));

    const singleDashGeo = new THREE.PlaneGeometry(dashLength, 0.16);
    singleDashGeo.rotateX(-Math.PI / 2);

    const dashesMesh = new THREE.InstancedMesh(singleDashGeo, this.whiteLineMaterial, dashCount * 2);
    const dummy = new THREE.Object3D();
    let instIdx = 0;

    const startX = -totalSpan / 2 + dashLength;
    for (let i = 0; i < dashCount; i++) {
      const px = startX + i * (dashLength + dashGap);
      // Skip inside intersections to avoid drawing dashes across intersection centers
      const modX = Math.abs(px % CITY_CONFIG.BLOCK_SIZE);
      if (modX < roadW * 0.65 || modX > CITY_CONFIG.BLOCK_SIZE - roadW * 0.65) continue;

      // Positive side lane divider
      dummy.position.set(px, 0.02, z + roadW * 0.25);
      dummy.updateMatrix();
      dashesMesh.setMatrixAt(instIdx++, dummy.matrix);

      // Negative side lane divider
      dummy.position.set(px, 0.02, z - roadW * 0.25);
      dummy.updateMatrix();
      dashesMesh.setMatrixAt(instIdx++, dummy.matrix);
    }
    dashesMesh.count = instIdx;
    dashesMesh.instanceMatrix.needsUpdate = true;
    markingGroup.add(dashesMesh);

    // Solid white edge lines near curbs
    const edgeGeo = new THREE.PlaneGeometry(totalSpan, 0.2);
    edgeGeo.rotateX(-Math.PI / 2);

    const edgeNorth = new THREE.Mesh(edgeGeo, this.whiteLineMaterial);
    edgeNorth.position.set(0, 0.02, z - roadW * 0.46);
    markingGroup.add(edgeNorth);

    const edgeSouth = new THREE.Mesh(edgeGeo, this.whiteLineMaterial);
    edgeSouth.position.set(0, 0.02, z + roadW * 0.46);
    markingGroup.add(edgeSouth);

    this.cityRoot.add(markingGroup);
  }

  private buildRoadMarkingsZ(x: number, totalSpan: number, roadW: number) {
    const markingGroup = new THREE.Group();

    // Double yellow center lines
    const yellowGeo = new THREE.PlaneGeometry(0.18, totalSpan);
    yellowGeo.rotateX(-Math.PI / 2);

    const yellow1 = new THREE.Mesh(yellowGeo, this.yellowLineMaterial);
    yellow1.position.set(x - 0.22, 0.02, 0);
    markingGroup.add(yellow1);

    const yellow2 = new THREE.Mesh(yellowGeo, this.yellowLineMaterial);
    yellow2.position.set(x + 0.22, 0.02, 0);
    markingGroup.add(yellow2);

    // Dashed white lane lines
    const dashLength = 3.5;
    const dashGap = 5.0;
    const dashCount = Math.floor(totalSpan / (dashLength + dashGap));

    const singleDashGeo = new THREE.PlaneGeometry(0.16, dashLength);
    singleDashGeo.rotateX(-Math.PI / 2);

    const dashesMesh = new THREE.InstancedMesh(singleDashGeo, this.whiteLineMaterial, dashCount * 2);
    const dummy = new THREE.Object3D();
    let instIdx = 0;

    const startZ = -totalSpan / 2 + dashLength;
    for (let i = 0; i < dashCount; i++) {
      const pz = startZ + i * (dashLength + dashGap);
      const modZ = Math.abs(pz % CITY_CONFIG.BLOCK_SIZE);
      if (modZ < roadW * 0.65 || modZ > CITY_CONFIG.BLOCK_SIZE - roadW * 0.65) continue;

      dummy.position.set(x + roadW * 0.25, 0.02, pz);
      dummy.updateMatrix();
      dashesMesh.setMatrixAt(instIdx++, dummy.matrix);

      dummy.position.set(x - roadW * 0.25, 0.02, pz);
      dummy.updateMatrix();
      dashesMesh.setMatrixAt(instIdx++, dummy.matrix);
    }
    dashesMesh.count = instIdx;
    dashesMesh.instanceMatrix.needsUpdate = true;
    markingGroup.add(dashesMesh);

    // Solid white edge lines near curbs
    const edgeGeo = new THREE.PlaneGeometry(0.2, totalSpan);
    edgeGeo.rotateX(-Math.PI / 2);

    const edgeWest = new THREE.Mesh(edgeGeo, this.whiteLineMaterial);
    edgeWest.position.set(x - roadW * 0.46, 0.02, 0);
    markingGroup.add(edgeWest);

    const edgeEast = new THREE.Mesh(edgeGeo, this.whiteLineMaterial);
    edgeEast.position.set(x + roadW * 0.46, 0.02, 0);
    markingGroup.add(edgeEast);

    this.cityRoot.add(markingGroup);
  }

  private buildSidewalksX(totalSpan: number, z: number, roadW: number) {
    const swW = CITY_CONFIG.SIDEWALK_WIDTH;
    const curbH = 0.22;

    const swGeo = new THREE.BoxGeometry(totalSpan, curbH, swW);

    // North sidewalk
    const swNorth = new THREE.Mesh(swGeo, this.sidewalkMaterial);
    swNorth.position.set(0, curbH / 2, z - (roadW / 2 + swW / 2));
    swNorth.receiveShadow = true;
    this.cityRoot.add(swNorth);

    // South sidewalk
    const swSouth = new THREE.Mesh(swGeo, this.sidewalkMaterial);
    swSouth.position.set(0, curbH / 2, z + (roadW / 2 + swW / 2));
    swSouth.receiveShadow = true;
    this.cityRoot.add(swSouth);

    // Street lamps and trees along the sidewalk
    const lampSpacing = CITY_CONFIG.STREET_LAMP_SPACING;
    const count = Math.floor(totalSpan / lampSpacing);
    for (let i = 0; i < count; i++) {
      const px = -totalSpan / 2 + i * lampSpacing + lampSpacing * 0.5;
      const modX = Math.abs(px % CITY_CONFIG.BLOCK_SIZE);
      if (modX < roadW) continue; // Skip in intersections

      // Alternate north/south
      const sideZ = (i % 2 === 0 ? 1 : -1) * (roadW / 2 + swW * 0.5);
      this.buildStreetLamp(px, sideZ, i % 2 === 0 ? 0 : Math.PI);

      if (i % 2 === 0) {
        const treeZ = (i % 2 === 0 ? -1 : 1) * (roadW / 2 + swW * 0.5);
        this.buildPalmTree(px + 8, treeZ);
      } else if (i % 3 === 0) {
        const treeZ = (i % 2 === 0 ? -1 : 1) * (roadW / 2 + swW * 0.5);
        this.buildTree(px + 8, treeZ);
      }
    }
  }

  private buildSidewalksZ(x: number, totalSpan: number, roadW: number) {
    const swW = CITY_CONFIG.SIDEWALK_WIDTH;
    const curbH = 0.22;

    const swGeo = new THREE.BoxGeometry(swW, curbH, totalSpan);

    const swWest = new THREE.Mesh(swGeo, this.sidewalkMaterial);
    swWest.position.set(x - (roadW / 2 + swW / 2), curbH / 2, 0);
    swWest.receiveShadow = true;
    this.cityRoot.add(swWest);

    const swEast = new THREE.Mesh(swGeo, this.sidewalkMaterial);
    swEast.position.set(x + (roadW / 2 + swW / 2), curbH / 2, 0);
    swEast.receiveShadow = true;
    this.cityRoot.add(swEast);
  }

  private buildIntersectionDetails(x: number, z: number, roadW: number) {
    const group = new THREE.Group();

    // 4 Crosswalks (North, South, East, West entry into intersection)
    const stripeW = 0.55;
    const stripeL = 3.6;
    const stripeGap = 0.95;
    const stripeCount = 14;

    const stripeGeo = new THREE.PlaneGeometry(stripeL, stripeW);
    stripeGeo.rotateX(-Math.PI / 2);

    // North & South crosswalks
    for (let side = -1; side <= 1; side += 2) {
      const cz = z + side * (roadW * 0.5 + stripeL * 0.5);
      for (let s = 0; s < stripeCount; s++) {
        const sx = x - (stripeCount * stripeGap) / 2 + s * stripeGap;
        const stripe = new THREE.Mesh(stripeGeo, this.crosswalkMaterial);
        stripe.position.set(sx, 0.025, cz);
        group.add(stripe);
      }
    }

    // East & West crosswalks (rotated 90 deg)
    const stripeGeoRot = new THREE.PlaneGeometry(stripeW, stripeL);
    stripeGeoRot.rotateX(-Math.PI / 2);

    for (let side = -1; side <= 1; side += 2) {
      const cx = x + side * (roadW * 0.5 + stripeL * 0.5);
      for (let s = 0; s < stripeCount; s++) {
        const sz = z - (stripeCount * stripeGap) / 2 + s * stripeGap;
        const stripe = new THREE.Mesh(stripeGeoRot, this.crosswalkMaterial);
        stripe.position.set(cx, 0.025, sz);
        group.add(stripe);
      }
    }

    // Curving yellow intersection turn guide lines (Matching Image 1!)
    const turnPoints: THREE.Vector3[] = [];
    const arcRadius = roadW * 0.38;
    for (let a = 0; a <= 10; a++) {
      const rad = (a / 10) * (Math.PI / 2);
      turnPoints.push(
        new THREE.Vector3(
          x - roadW * 0.45 + Math.sin(rad) * arcRadius,
          0.025,
          z - roadW * 0.45 + Math.cos(rad) * arcRadius
        )
      );
    }
    const turnCurve = new THREE.CatmullRomCurve3(turnPoints);
    const turnGeo = new THREE.TubeGeometry(turnCurve, 10, 0.08, 4, false);
    const turnLine = new THREE.Mesh(turnGeo, this.yellowLineMaterial);
    group.add(turnLine);

    // Traffic light posts at intersection 4 corners
    const cornerOffset = roadW * 0.5 + 2.0;
    this.buildTrafficLight(x + cornerOffset, z + cornerOffset, group, Math.PI, 'ns', x, z);
    this.buildTrafficLight(x - cornerOffset, z - cornerOffset, group, 0, 'ns', x, z);
    this.buildTrafficLight(x - cornerOffset, z + cornerOffset, group, Math.PI / 2, 'ew', x, z);
    this.buildTrafficLight(x + cornerOffset, z - cornerOffset, group, -Math.PI / 2, 'ew', x, z);

    this.cityRoot.add(group);
  }

  private buildTrafficLight(
    posX: number,
    posZ: number,
    parent: THREE.Group,
    rotation: number,
    axis: 'ew' | 'ns',
    interX: number,
    interZ: number
  ) {
    const postGroup = new THREE.Group();
    postGroup.position.set(posX, 0, posZ);
    postGroup.rotation.y = rotation;

    // Vertical pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.14, 5.5, 8);
    const pole = new THREE.Mesh(poleGeo, this.lampPostMaterial);
    pole.position.y = 2.75;
    postGroup.add(pole);

    // Horizontal arm reaching over lane
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.0, 8);
    armGeo.rotateZ(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, this.lampPostMaterial);
    arm.position.set(2.0, 5.2, 0);
    postGroup.add(arm);

    // Traffic signal housing
    const boxGeo = new THREE.BoxGeometry(0.4, 1.2, 0.35);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4 });
    const signalBox = new THREE.Mesh(boxGeo, boxMat);
    signalBox.position.set(3.6, 4.8, 0);
    postGroup.add(signalBox);

    // Red, yellow, green lenses with dynamic materials
    const lensGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0x332200 });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff66 });

    const red = new THREE.Mesh(lensGeo, redMat);
    red.position.set(3.6, 5.15, -0.16);
    postGroup.add(red);

    const yellow = new THREE.Mesh(lensGeo, yellowMat);
    yellow.position.set(3.6, 4.8, -0.16);
    postGroup.add(yellow);

    const green = new THREE.Mesh(lensGeo, greenMat);
    green.position.set(3.6, 4.45, -0.16);
    postGroup.add(green);

    if (this.trafficLightManager) {
      this.trafficLightManager.registerLens(interX, interZ, axis, 'red', redMat);
      this.trafficLightManager.registerLens(interX, interZ, axis, 'yellow', yellowMat);
      this.trafficLightManager.registerLens(interX, interZ, axis, 'green', greenMat);
    }

    parent.add(postGroup);
  }

  private buildStreetLamp(x: number, z: number, rotation: number) {
    const lampGroup = new THREE.Group();
    lampGroup.position.set(x, 0, z);
    lampGroup.rotation.y = rotation;

    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8);
    const pole = new THREE.Mesh(poleGeo, this.lampPostMaterial);
    pole.position.y = 3.75;
    lampGroup.add(pole);

    // Curved arm
    const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.5, 8);
    armGeo.rotateZ(Math.PI / 3);
    const arm = new THREE.Mesh(armGeo, this.lampPostMaterial);
    arm.position.set(0.9, 7.2, 0);
    lampGroup.add(arm);

    // Lamp fixture
    const headGeo = new THREE.ConeGeometry(0.35, 0.4, 8);
    headGeo.rotateX(Math.PI);
    const head = new THREE.Mesh(headGeo, this.lampHeadMaterial);
    head.position.set(1.8, 6.8, 0);
    lampGroup.add(head);

    // Warm street light pool on the road beneath the lamp
    const poolGeo = new THREE.PlaneGeometry(10, 10);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({
      map: this.lightPoolTexture,
      transparent: true,
      opacity: 0.05,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.envManager.lightPoolMaterials.push(poolMat);
    const pool = new THREE.Mesh(poolGeo, poolMat);
    pool.position.set(1.8, 0.022, 0);
    lampGroup.add(pool);

    this.cityRoot.add(lampGroup);
  }

  private buildTree(x: number, z: number) {
    const treeGroup = new THREE.Group();
    treeGroup.position.set(x, 0, z);

    // Trunk
    const trunkH = 2.8 + Math.random() * 0.8;
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, trunkH, 7);
    const trunk = new THREE.Mesh(trunkGeo, this.barkMaterial);
    trunk.position.y = trunkH / 2;
    treeGroup.add(trunk);

    // Foliage (layered geometric spheres for clean modern low-poly urban aesthetic)
    const foliageH = trunkH + 1.2;
    const foliageGeo = new THREE.DodecahedronGeometry(1.6 + Math.random() * 0.4, 1);
    const foliage = new THREE.Mesh(foliageGeo, this.leavesMaterial);
    foliage.position.y = foliageH;
    foliage.castShadow = true;
    treeGroup.add(foliage);

    const foliageTopGeo = new THREE.DodecahedronGeometry(1.1, 1);
    const foliageTop = new THREE.Mesh(foliageTopGeo, this.leavesMaterial);
    foliageTop.position.y = foliageH + 1.2;
    foliageTop.castShadow = true;
    treeGroup.add(foliageTop);

    this.cityRoot.add(treeGroup);
  }

  private buildPalmTree(x: number, z: number) {
    const palmGroup = new THREE.Group();
    palmGroup.position.set(x, 0, z);

    // Tall curved palm trunk (California style from reference)
    const trunkH = 8.5 + Math.random() * 2.2;
    const curvePoints: THREE.Vector3[] = [];
    const segments = 7;
    const leanX = (Math.random() - 0.5) * 1.6;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const py = t * trunkH;
      const px = Math.sin(t * Math.PI * 0.5) * leanX;
      curvePoints.push(new THREE.Vector3(px, py, 0));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    const trunkGeo = new THREE.TubeGeometry(curve, 10, 0.24, 7, false);
    const trunk = new THREE.Mesh(trunkGeo, this.barkMaterial);
    trunk.castShadow = true;
    palmGroup.add(trunk);

    // Radial drooping palm fronds at top
    const crownTop = curvePoints[curvePoints.length - 1];
    const frondCount = 9;
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x3d7e32,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });

    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount) * Math.PI * 2;
      const frondGeo = new THREE.PlaneGeometry(0.7, 3.8, 1, 4);
      const posAttr = frondGeo.attributes.position;
      for (let p = 0; p < posAttr.count; p++) {
        const y = posAttr.getY(p);
        const droop = Math.pow(Math.max(0, y + 1.9) / 3.8, 2) * 1.2;
        posAttr.setZ(p, -droop);
      }
      frondGeo.computeVertexNormals();

      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(crownTop.x, crownTop.y, crownTop.z);
      frond.rotation.set(0, angle, 0);
      frond.rotateX(-Math.PI / 4.2);
      frond.castShadow = true;
      palmGroup.add(frond);
    }

    this.cityRoot.add(palmGroup);
  }

  private buildBuildingsAndBlocks() {
    const half = CITY_CONFIG.GRID_HALF_EXTENT;
    const step = CITY_CONFIG.BLOCK_SIZE;
    const roadW = CITY_CONFIG.ROAD_WIDTH;
    const swW = CITY_CONFIG.SIDEWALK_WIDTH;

    // Usable block interior area
    const usableBlockSize = step - (roadW + swW * 2 + 3);

    // Palette of modern city architectural building materials (Bright, contemporary, sun-reflective)
    const buildingColors = [
      0xf1f5f9, // Luminous white architectural composite
      0xdbeafe, // Sky blue reflective highrise
      0xe2e8f0, // Pearl white concrete
      0xb0bec5, // Light steel brushed aluminium
      0x90caf9, // Azure glass corporate tower
      0xc5cae9, // Periwinkle modern facade
      0xa5d6a7, // Eco-green terrace vertical garden
      0xd7ccc8, // Warm beige travertine stone
      0xb2dfdb, // Mint turquoise architectural glass
    ];

    for (let ix = -half; ix < half; ix++) {
      for (let iz = -half; iz < half; iz++) {
        const blockCenterX = ix * step + step / 2;
        const blockCenterZ = iz * step + step / 2;

        // Skip center block for special plaza / high-speed start area
        const isCenterBlock = ix === 0 && iz === 0;

        if (isCenterBlock) {
          this.buildPlazaBlock(blockCenterX, blockCenterZ, usableBlockSize);
          continue;
        }

        // Modern Terraced Resort Building directly along main boulevard (Matching Image 1!)
        if (ix === 0 && iz === -1) {
          this.buildTerracedResortBuilding(blockCenterX, blockCenterZ, usableBlockSize);
          continue;
        }

        // Corner Gas Station & Diner with Illuminated Canopy (Matching Image 1!)
        if (ix === 1 && iz === -1) {
          this.buildServiceDinerStation(blockCenterX, blockCenterZ);
          continue;
        }

        // Subdivide each block into 2 to 4 distinct buildings
        this.buildBlockBuildings(blockCenterX, blockCenterZ, usableBlockSize, buildingColors);
      }
    }
  }

  private buildPlazaBlock(cx: number, cz: number, size: number) {
    // Elegant civic plaza with parking spots, fountain, and twin corporate towers on sides
    const plazaGeo = new THREE.BoxGeometry(size, 0.3, size);
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, roughness: 0.6 });
    const plaza = new THREE.Mesh(plazaGeo, plazaMat);
    plaza.position.set(cx, 0.15, cz);
    plaza.receiveShadow = true;
    this.cityRoot.add(plaza);

    // Twin towers on the North & South sides of the plaza
    const towerW = size * 0.4;
    const towerD = size * 0.35;
    const towerH = 65;

    for (let side = -1; side <= 1; side += 2) {
      const tz = cz + side * (size * 0.28);
      this.createSkyscraper(cx, tz, towerW, towerD, towerH, 0x2b3848);
    }

    // Plaza fountain in center
    const fountainBase = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6.5, 0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x485868, roughness: 0.4 })
    );
    fountainBase.position.set(cx, 0.4, cz);
    this.cityRoot.add(fountainBase);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 0.1, 16),
      new THREE.MeshStandardMaterial({ color: 0x1f78b4, roughness: 0.1, metalness: 0.8 })
    );
    water.position.set(cx, 0.8, cz);
    this.cityRoot.add(water);

    // Add collision for towers
    for (let side = -1; side <= 1; side += 2) {
      const tz = cz + side * (size * 0.28);
      this.obstacles.push({
        minX: cx - towerW / 2 - 0.5,
        maxX: cx + towerW / 2 + 0.5,
        minZ: tz - towerD / 2 - 0.5,
        maxZ: tz + towerD / 2 + 0.5,
        type: 'building',
      });
    }
  }

  private buildBlockBuildings(cx: number, cz: number, size: number, colors: number[]) {
    // Divide into 4 quadrants or 2 large buildings
    const splitType = (Math.abs(cx * 13 + cz * 7) % 3);

    if (splitType === 0) {
      // 4 quadrant buildings with internal alleyway
      const bSize = size * 0.46;
      const offset = size * 0.25;

      const offsets = [
        [-offset, -offset],
        [offset, -offset],
        [-offset, offset],
        [offset, offset],
      ];

      for (const [ox, oz] of offsets) {
        const bx = cx + ox;
        const bz = cz + oz;
        const height = CITY_CONFIG.BUILDING_HEIGHT_MIN + Math.random() * (CITY_CONFIG.BUILDING_HEIGHT_MAX - CITY_CONFIG.BUILDING_HEIGHT_MIN);
        const color = colors[Math.floor(Math.random() * colors.length)];

        this.createSkyscraper(bx, bz, bSize, bSize, height, color);

        this.obstacles.push({
          minX: bx - bSize / 2 - 0.5,
          maxX: bx + bSize / 2 + 0.5,
          minZ: bz - bSize / 2 - 0.5,
          maxZ: bz + bSize / 2 + 0.5,
          type: 'building',
        });
      }
    } else if (splitType === 1) {
      // 2 long avenue buildings
      const bW = size * 0.94;
      const bD = size * 0.44;
      const offsetZ = size * 0.25;

      for (const oz of [-offsetZ, offsetZ]) {
        const bz = cz + oz;
        const height = CITY_CONFIG.BUILDING_HEIGHT_MIN + Math.random() * 45;
        const color = colors[Math.floor(Math.random() * colors.length)];

        this.createSkyscraper(cx, bz, bW, bD, height, color);

        this.obstacles.push({
          minX: cx - bW / 2 - 0.5,
          maxX: cx + bW / 2 + 0.5,
          minZ: bz - bD / 2 - 0.5,
          maxZ: bz + bD / 2 + 0.5,
          type: 'building',
        });
      }
    } else {
      // 1 major central tower with parking lot and small retail unit
      const towerSize = size * 0.65;
      const height = CITY_CONFIG.BUILDING_HEIGHT_MIN + 25 + Math.random() * (CITY_CONFIG.BUILDING_HEIGHT_MAX - 25);
      const color = colors[Math.floor(Math.random() * colors.length)];

      const bx = cx - size * 0.15;
      const bz = cz - size * 0.15;
      this.createSkyscraper(bx, bz, towerSize, towerSize, height, color);

      this.obstacles.push({
        minX: bx - towerSize / 2 - 0.5,
        maxX: bx + towerSize / 2 + 0.5,
        minZ: bz - towerSize / 2 - 0.5,
        maxZ: bz + towerSize / 2 + 0.5,
        type: 'building',
      });

      // Small parking lot & trees in remaining space
      const parkingX = cx + size * 0.3;
      const parkingZ = cz + size * 0.3;
      this.buildTree(parkingX, parkingZ);
      this.buildTree(parkingX - 10, parkingZ);
    }
  }

  private createSkyscraper(
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
    color: number
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Main tower volume
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.25,
    });

    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = height / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Architectural crown / upper setback
    if (height > 35) {
      const crownH = 5 + Math.random() * 8;
      const crownGeo = new THREE.BoxGeometry(width * 0.75, crownH, depth * 0.75);
      const crown = new THREE.Mesh(crownGeo, bodyMat);
      crown.position.y = height + crownH / 2;
      group.add(crown);

      // Antenna / Spire on tall towers
      if (height > 55) {
        const antennaGeo = new THREE.CylinderGeometry(0.1, 0.25, 12, 6);
        const antennaMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.y = height + crownH + 6;
        group.add(antenna);
      }
    }

    // Windows rows (emissive glass that turns on at night!)
    const windowCols = Math.floor(width / 3.8);
    const windowRows = Math.floor(height / 4.2);

    if (windowCols > 1 && windowRows > 2) {
      const winGeo = new THREE.PlaneGeometry(1.6, 2.2);

      // Windows along North and South facades
      const northSouthMesh = new THREE.InstancedMesh(winGeo, this.windowMaterial, windowCols * windowRows * 2);
      const dummy = new THREE.Object3D();
      let winIdx = 0;

      const colStep = width / (windowCols + 1);
      const rowStep = height / (windowRows + 1);

      for (let r = 1; r <= windowRows; r++) {
        const wy = r * rowStep;
        for (let c = 1; c <= windowCols; c++) {
          const wx = -width / 2 + c * colStep;

          // South face
          dummy.position.set(wx, wy, depth / 2 + 0.05);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          northSouthMesh.setMatrixAt(winIdx++, dummy.matrix);

          // North face
          dummy.position.set(wx, wy, -depth / 2 - 0.05);
          dummy.rotation.set(0, Math.PI, 0);
          dummy.updateMatrix();
          northSouthMesh.setMatrixAt(winIdx++, dummy.matrix);
        }
      }
      northSouthMesh.count = winIdx;
      northSouthMesh.instanceMatrix.needsUpdate = true;
      group.add(northSouthMesh);
    }

    this.cityRoot.add(group);
  }

  private buildBridgesAndOverpasses() {
    // Create an elevated highway overpass running across one of the primary corridors
    const step = CITY_CONFIG.BLOCK_SIZE;
    const overpassZ = step * 1; // 1 block North of center
    const span = step * 5;
    const bridgeW = 16;
    const bridgeH = 8.5; // High clearance for lower traffic

    const overpassGroup = new THREE.Group();

    // Elevated bridge deck
    const deckGeo = new THREE.BoxGeometry(span, 1.2, bridgeW);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x3e4450, roughness: 0.7, metalness: 0.2 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(0, bridgeH, overpassZ);
    overpassGroup.add(deck);

    // Road asphalt on top of bridge
    const bridgeRoadGeo = new THREE.PlaneGeometry(span, bridgeW - 1.5);
    bridgeRoadGeo.rotateX(-Math.PI / 2);
    const bridgeRoad = new THREE.Mesh(bridgeRoadGeo, this.roadMaterial);
    bridgeRoad.position.set(0, bridgeH + 0.62, overpassZ);
    overpassGroup.add(bridgeRoad);

    // Guardrails on both sides of bridge
    const railGeo = new THREE.BoxGeometry(span, 1.4, 0.4);
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8892a0, metalness: 0.7, roughness: 0.3 });

    const railN = new THREE.Mesh(railGeo, railMat);
    railN.position.set(0, bridgeH + 1.2, overpassZ - bridgeW / 2 + 0.2);
    overpassGroup.add(railN);

    const railS = new THREE.Mesh(railGeo, railMat);
    railS.position.set(0, bridgeH + 1.2, overpassZ + bridgeW / 2 - 0.2);
    overpassGroup.add(railS);

    // Support pillars
    const pillarCount = 6;
    const pillarSpacing = span / (pillarCount + 1);
    for (let p = 1; p <= pillarCount; p++) {
      const px = -span / 2 + p * pillarSpacing;

      // Pillars on outer sides so center road lanes stay clear
      for (const side of [-1, 1]) {
        const pz = overpassZ + side * (bridgeW * 0.38);
        const pillarGeo = new THREE.CylinderGeometry(0.8, 0.9, bridgeH, 12);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a6370, roughness: 0.8 });
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(px, bridgeH / 2, pz);
        pillar.castShadow = true;
        overpassGroup.add(pillar);

        this.obstacles.push({
          minX: px - 1.2,
          maxX: px + 1.2,
          minZ: pz - 1.2,
          maxZ: pz + 1.2,
          type: 'pillar',
        });
      }
    }

    this.cityRoot.add(overpassGroup);
  }

  private buildDistantSkyline() {
    // Distant mountain / skyline silhouettes on horizon to give depth
    const skylineGroup = new THREE.Group();
    const distance = 420;
    const count = 32;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const w = 40 + Math.random() * 50;
      const h = 80 + Math.random() * 120;
      const d = 30 + Math.random() * 40;

      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshBasicMaterial({ color: 0x222e42 });
      const tower = new THREE.Mesh(geo, mat);
      tower.position.set(x, h / 2 - 10, z);
      skylineGroup.add(tower);
    }

    this.cityRoot.add(skylineGroup);
  }

  // Modern Luxury Terraced Resort Hotel with White Cantilevered Balconies & Glass Railings (Matching Image 1!)
  private buildTerracedResortBuilding(cx: number, cz: number, size: number) {
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);

    const bW = size * 0.9;
    const bD = size * 0.8;
    const floors = 7;
    const floorH = 4.4;

    const whiteConcreteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Clean crisp white facade
      roughness: 0.45,
      metalness: 0.1,
    });

    const tealGlassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.1,
      metalness: 0.85,
      transparent: true,
      opacity: 0.72,
    });

    for (let f = 0; f < floors; f++) {
      const fy = f * floorH;
      const setback = f * 1.8;
      const curW = bW - setback;
      const curD = bD - setback;

      // Cantilevered White Balcony Slab
      const slabGeo = new THREE.BoxGeometry(curW + 2.2, 0.4, curD + 2.2);
      const slab = new THREE.Mesh(slabGeo, whiteConcreteMat);
      slab.position.set(0, fy + 0.2, 0);
      slab.receiveShadow = true;
      group.add(slab);

      // Glass Balcony Railing with blue tint
      const railGeo = new THREE.BoxGeometry(curW + 2.0, 1.05, curD + 2.0);
      const rail = new THREE.Mesh(railGeo, tealGlassMat);
      rail.position.set(0, fy + 0.8, 0);
      group.add(rail);

      // Room Interior Glass Wall
      const coreGeo = new THREE.BoxGeometry(curW - 1.2, floorH - 0.6, curD - 1.2);
      const core = new THREE.Mesh(coreGeo, tealGlassMat);
      core.position.set(0, fy + floorH / 2, 0);
      group.add(core);
    }

    // Cylindrical corner glass elevator tower
    const towerGeo = new THREE.CylinderGeometry(3.6, 3.6, floors * floorH + 4, 16);
    const tower = new THREE.Mesh(towerGeo, whiteConcreteMat);
    tower.position.set(-bW / 2 + 3.5, (floors * floorH) / 2, -bD / 2 + 3.5);
    group.add(tower);

    this.cityRoot.add(group);

    this.obstacles.push({
      minX: cx - bW / 2 - 0.5,
      maxX: cx + bW / 2 + 0.5,
      minZ: cz - bD / 2 - 0.5,
      maxZ: cz + bD / 2 + 0.5,
      type: 'building',
    });
  }

  // Corner Gas Station & Diner with Retro Illuminated Canopy (Matching Image 1!)
  private buildServiceDinerStation(cx: number, cz: number) {
    const group = new THREE.Group();
    group.position.set(cx, 0, cz);

    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Vibrant teal/blue canopy
      roughness: 0.35,
      metalness: 0.5,
    });

    const trimMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Yellow illuminated trim
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });

    // Large overhanging fuel pump canopy
    const canopyGeo = new THREE.BoxGeometry(32, 1.2, 22);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(-8, 6.2, 0);
    group.add(canopy);

    // Glowing yellow fascia trim
    const trimGeo = new THREE.BoxGeometry(32.4, 0.4, 22.4);
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(-8, 6.2, 0);
    group.add(trim);

    // Support pillars
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const pGeo = new THREE.CylinderGeometry(0.35, 0.35, 6.2, 12);
    const pillarPositions = [
      [-18, 3.1, -6],
      [-18, 3.1, 6],
      [2, 3.1, -6],
      [2, 3.1, 6],
    ];
    for (const [px, py, pz] of pillarPositions) {
      const p = new THREE.Mesh(pGeo, pillarMat);
      p.position.set(px, py, pz);
      group.add(p);
    }

    // Fuel pump islands
    const pumpGeo = new THREE.BoxGeometry(1.4, 2.2, 3.5);
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xdc2626 });
    const pump1 = new THREE.Mesh(pumpGeo, pumpMat);
    pump1.position.set(-8, 1.1, -6);
    group.add(pump1);
    const pump2 = new THREE.Mesh(pumpGeo, pumpMat);
    pump2.position.set(-8, 1.1, 6);
    group.add(pump2);

    // Convenience store / diner building behind canopy
    const storeGeo = new THREE.BoxGeometry(20, 5.5, 24);
    const store = new THREE.Mesh(storeGeo, buildingMat);
    store.position.set(16, 2.75, 0);
    group.add(store);

    // Illuminated store sign
    const signGeo = new THREE.BoxGeometry(12, 2.0, 0.4);
    const signMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(5.8, 4.2, 0);
    group.add(sign);

    this.cityRoot.add(group);

    this.obstacles.push({
      minX: cx + 6,
      maxX: cx + 26,
      minZ: cz - 12,
      maxZ: cz + 12,
      type: 'building',
    });
  }

  // Dramatic Red Rock Canyon Cliffs & Mountains (Matching Image 1!)
  private buildRedRockCliffs() {
    const cliffGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x9c3d23, // Terracotta red canyon rock
      roughness: 0.95,
      metalness: 0.05,
      flatShading: true,
    });

    const brushMat = new THREE.MeshStandardMaterial({ color: 0x3d5c2e, roughness: 0.9 });

    // Cliff wall along the East perimeter (X ~ 480 to 650)
    const cliffCount = 20;
    const startZ = -CITY_CONFIG.GRID_HALF_EXTENT * CITY_CONFIG.BLOCK_SIZE - 60;
    const spanZ = (CITY_CONFIG.GRID_HALF_EXTENT * 2 + 1) * CITY_CONFIG.BLOCK_SIZE + 120;
    const stepZ = spanZ / cliffCount;

    for (let i = 0; i < cliffCount; i++) {
      const cz = startZ + i * stepZ;
      const cx = (CITY_CONFIG.GRID_HALF_EXTENT * CITY_CONFIG.BLOCK_SIZE + 60) + (Math.random() - 0.5) * 40;
      const rockH = 45 + Math.random() * 55;
      const rockW = 60 + Math.random() * 35;
      const rockD = 50 + Math.random() * 25;

      const rockGeo = new THREE.DodecahedronGeometry(rockW * 0.45, 1);
      rockGeo.scale(1.2, rockH / (rockW * 0.45), 1.0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(cx, rockH * 0.45 - 5, cz);
      rock.rotation.y = Math.random() * Math.PI * 2;
      rock.castShadow = true;
      cliffGroup.add(rock);

      // Green desert brush bushes on cliff bases
      if (i % 2 === 0) {
        const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 0), brushMat);
        bush.position.set(cx - 20, 2.5, cz + 5);
        cliffGroup.add(bush);
      }
    }

    this.cityRoot.add(cliffGroup);
  }

  // --- Procedural Graphics & Texture Generators ---

  private createAsphaltTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#262930';
    ctx.fillRect(0, 0, 256, 256);

    const imgData = ctx.getImageData(0, 0, 256, 256);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 26;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    return tex;
  }

  private createLightPoolTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    grad.addColorStop(0, 'rgba(255, 235, 175, 0.7)');
    grad.addColorStop(0.35, 'rgba(255, 215, 130, 0.35)');
    grad.addColorStop(0.7, 'rgba(255, 200, 100, 0.1)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private createNeonBillboardTexture(text: string, sub: string, color: string, accent: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#060912';
    ctx.fillRect(0, 0, 512, 160);

    // Glowing border
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 140);

    // Main brand text
    ctx.font = '900 40px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillText(text, 256, 75);

    // Subtitle
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.fillText(sub, 256, 122);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private buildDowntownNeonBillboards() {
    const billboardData = [
      { text: 'APEX GT HYPERDRIVE', sub: 'WORLD RECORD SPEED', color: '#06b6d4', accent: '#38bdf8', x: 0, y: 35, z: 20, rotY: 0 },
      { text: 'CYBER MATRIX 2099', sub: 'NEURAL DRIVE SYSTEMS', color: '#ec4899', accent: '#a855f7', x: -120, y: 40, z: -100, rotY: Math.PI / 2 },
      { text: 'TURBO OASIS DINER', sub: 'HIGH OCTANE 24/7', color: '#f59e0b', accent: '#ef4444', x: 120, y: 16, z: -105, rotY: 0 },
      { text: 'MARINA BAY CASINO', sub: 'VIP HIGH ROLLER LOUNGE', color: '#10b981', accent: '#fbbf24', x: 0, y: 28, z: -100, rotY: Math.PI },
      { text: 'NEON DRIFT CHAMPIONS', sub: 'TOKYO NIGHT CIRCUITS', color: '#8b5cf6', accent: '#06b6d4', x: -120, y: 30, z: 100, rotY: -Math.PI / 2 },
    ];

    for (const b of billboardData) {
      const tex = this.createNeonBillboardTexture(b.text, b.sub, b.color, b.accent);
      const bMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
      });
      this.envManager.neonMaterials.push(bMat);

      const frameGeo = new THREE.BoxGeometry(22, 7, 0.6);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x11141c, roughness: 0.5, metalness: 0.8 });
      const frame = new THREE.Mesh(frameGeo, frameMat);

      const screenGeo = new THREE.PlaneGeometry(21.4, 6.4);
      const screen = new THREE.Mesh(screenGeo, bMat);
      screen.position.z = 0.32;
      frame.add(screen);

      frame.position.set(b.x, b.y, b.z);
      frame.rotation.y = b.rotY;
      this.cityRoot.add(frame);
    }
  }

  private buildStuntRamp() {
    const rx = -120;
    const rz = 120;

    const rampGroup = new THREE.Group();
    rampGroup.position.set(rx, 0, rz);

    // Inclined launch ramp wedge
    const rampLength = 36;
    const rampWidth = 14;
    const rampHeight = 9.5;

    // Wedge geometry (custom triangle prism)
    const rampShape = new THREE.Shape();
    rampShape.moveTo(0, 0);
    rampShape.lineTo(rampLength, 0);
    rampShape.lineTo(rampLength, rampHeight);
    rampShape.closePath();

    const extrudeSettings = {
      depth: rampWidth,
      bevelEnabled: false,
    };

    const rampGeo = new THREE.ExtrudeGeometry(rampShape, extrudeSettings);
    rampGeo.center();

    // Canvas texture with racing chevrons
    const chevronCanvas = document.createElement('canvas');
    chevronCanvas.width = 128;
    chevronCanvas.height = 128;
    const cctx = chevronCanvas.getContext('2d')!;
    cctx.fillStyle = '#1e293b';
    cctx.fillRect(0, 0, 128, 128);
    cctx.fillStyle = '#eab308';
    cctx.beginPath();
    cctx.moveTo(64, 20);
    cctx.lineTo(110, 80);
    cctx.lineTo(85, 80);
    cctx.lineTo(64, 45);
    cctx.lineTo(43, 80);
    cctx.lineTo(18, 80);
    cctx.closePath();
    cctx.fill();

    const chevronTex = new THREE.CanvasTexture(chevronCanvas);
    chevronTex.wrapS = THREE.RepeatWrapping;
    chevronTex.wrapT = THREE.RepeatWrapping;
    chevronTex.repeat.set(2, 6);

    const rampMat = new THREE.MeshStandardMaterial({
      map: chevronTex,
      roughness: 0.6,
      metalness: 0.2,
    });

    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.rotation.y = -Math.PI / 2;
    rampMesh.position.set(0, rampHeight / 2, 0);
    rampMesh.castShadow = true;
    rampMesh.receiveShadow = true;
    rampGroup.add(rampMesh);

    // Glowing Neon Launch Arch at the lip of the ramp
    const archMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    this.envManager.neonMaterials.push(archMat);

    const postGeo = new THREE.BoxGeometry(0.8, 12, 0.8);
    const leftPost = new THREE.Mesh(postGeo, archMat);
    leftPost.position.set(-rampWidth / 2 - 0.4, 6, -rampLength / 2);
    rampGroup.add(leftPost);

    const rightPost = new THREE.Mesh(postGeo, archMat);
    rightPost.position.set(rampWidth / 2 + 0.4, 6, -rampLength / 2);
    rampGroup.add(rightPost);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(rampWidth + 2, 0.8, 0.8), archMat);
    topBeam.position.set(0, 12, -rampLength / 2);
    rampGroup.add(topBeam);

    this.cityRoot.add(rampGroup);

    // Collision boundaries to channel car up the ramp
    this.obstacles.push({
      minX: rx - rampWidth / 2 - 2,
      maxX: rx - rampWidth / 2 - 0.5,
      minZ: rz - rampLength / 2,
      maxZ: rz + rampLength / 2,
      type: 'barrier',
    });
    this.obstacles.push({
      minX: rx + rampWidth / 2 + 0.5,
      maxX: rx + rampWidth / 2 + 2,
      minZ: rz - rampLength / 2,
      maxZ: rz + rampLength / 2,
      type: 'barrier',
    });
  }

  public getNearbyLandmark(playerX: number, playerZ: number, threshold: number = 75): { landmark: CityLandmark; distance: number } | null {
    let closest: CityLandmark | null = null;
    let minDist = threshold;

    for (const lm of CITY_LANDMARKS) {
      const dx = playerX - lm.position.x;
      const dz = playerZ - lm.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) {
        minDist = dist;
        closest = lm;
      }
    }

    if (closest) {
      return { landmark: closest, distance: Math.round(minDist) };
    }
    return null;
  }
}

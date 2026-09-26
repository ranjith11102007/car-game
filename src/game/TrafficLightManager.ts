import * as THREE from 'three';
import { CITY_CONFIG } from '../constants';

export type LightState = 'green' | 'yellow' | 'red';

export interface IntersectionSignal {
  x: number;
  z: number;
  ewState: LightState;
  nsState: LightState;
  ewRedLenses: THREE.MeshBasicMaterial[];
  ewYellowLenses: THREE.MeshBasicMaterial[];
  ewGreenLenses: THREE.MeshBasicMaterial[];
  nsRedLenses: THREE.MeshBasicMaterial[];
  nsYellowLenses: THREE.MeshBasicMaterial[];
  nsGreenLenses: THREE.MeshBasicMaterial[];
}

export class TrafficLightManager {
  public signals: IntersectionSignal[] = [];
  private cycleTimer: number = 0;
  private readonly greenDuration = 12.0;
  private readonly yellowDuration = 3.0;
  private readonly totalCycle = (12.0 + 3.0) * 2; // 30 seconds full cycle

  public currentEWState: LightState = 'green';
  public currentNSState: LightState = 'red';

  constructor() {
    this.initSignals();
  }

  private initSignals() {
    const half = CITY_CONFIG.GRID_HALF_EXTENT;
    const step = CITY_CONFIG.BLOCK_SIZE;

    for (let ix = -half; ix <= half; ix++) {
      for (let iz = -half; iz <= half; iz++) {
        this.signals.push({
          x: ix * step,
          z: iz * step,
          ewState: 'green',
          nsState: 'red',
          ewRedLenses: [],
          ewYellowLenses: [],
          ewGreenLenses: [],
          nsRedLenses: [],
          nsYellowLenses: [],
          nsGreenLenses: [],
        });
      }
    }
  }

  public registerLens(
    intersectionX: number,
    intersectionZ: number,
    axis: 'ew' | 'ns',
    type: 'red' | 'yellow' | 'green',
    material: THREE.MeshBasicMaterial
  ) {
    const signal = this.signals.find(
      (s) => Math.abs(s.x - intersectionX) < 1 && Math.abs(s.z - intersectionZ) < 1
    );
    if (!signal) return;

    if (axis === 'ew') {
      if (type === 'red') signal.ewRedLenses.push(material);
      else if (type === 'yellow') signal.ewYellowLenses.push(material);
      else signal.ewGreenLenses.push(material);
    } else {
      if (type === 'red') signal.nsRedLenses.push(material);
      else if (type === 'yellow') signal.nsYellowLenses.push(material);
      else signal.nsGreenLenses.push(material);
    }
  }

  public update(dt: number) {
    this.cycleTimer = (this.cycleTimer + dt) % this.totalCycle;

    // Phase 1: EW Green, NS Red (0 to 12s)
    // Phase 2: EW Yellow, NS Red (12 to 15s)
    // Phase 3: EW Red, NS Green (15 to 27s)
    // Phase 4: EW Red, NS Yellow (27 to 30s)
    let ew: LightState = 'green';
    let ns: LightState = 'red';

    if (this.cycleTimer < this.greenDuration) {
      ew = 'green';
      ns = 'red';
    } else if (this.cycleTimer < this.greenDuration + this.yellowDuration) {
      ew = 'yellow';
      ns = 'red';
    } else if (this.cycleTimer < this.greenDuration * 2 + this.yellowDuration) {
      ew = 'red';
      ns = 'green';
    } else {
      ew = 'red';
      ns = 'yellow';
    }

    this.currentEWState = ew;
    this.currentNSState = ns;

    // Update all physical lens materials
    for (const s of this.signals) {
      s.ewState = ew;
      s.nsState = ns;

      // Update EW Lenses
      this.updateLensGroup(s.ewRedLenses, ew === 'red' ? 0xff2222 : 0x330808);
      this.updateLensGroup(s.ewYellowLenses, ew === 'yellow' ? 0xffbb00 : 0x332200);
      this.updateLensGroup(s.ewGreenLenses, ew === 'green' ? 0x00ff66 : 0x002e11);

      // Update NS Lenses
      this.updateLensGroup(s.nsRedLenses, ns === 'red' ? 0xff2222 : 0x330808);
      this.updateLensGroup(s.nsYellowLenses, ns === 'yellow' ? 0xffbb00 : 0x332200);
      this.updateLensGroup(s.nsGreenLenses, ns === 'green' ? 0x00ff66 : 0x002e11);
    }
  }

  private updateLensGroup(materials: THREE.MeshBasicMaterial[], hexColor: number) {
    for (const mat of materials) {
      mat.color.setHex(hexColor);
    }
  }

  /**
   * Checks if traffic vehicle approaching an intersection should stop.
   * If there is an intersection within distance [5m, 22m] ahead and the light is RED or YELLOW, return true.
   */
  public shouldStopForLight(
    x: number,
    z: number,
    direction: 'north' | 'south' | 'east' | 'west'
  ): boolean {
    const step = CITY_CONFIG.BLOCK_SIZE;

    // Find nearest intersection ahead
    let targetX = Math.round(x / step) * step;
    let targetZ = Math.round(z / step) * step;

    let distAhead = 0;
    if (direction === 'east') {
      if (targetX < x) targetX += step;
      distAhead = targetX - x;
      if (distAhead > 4 && distAhead < 24) {
        return this.currentEWState !== 'green';
      }
    } else if (direction === 'west') {
      if (targetX > x) targetX -= step;
      distAhead = x - targetX;
      if (distAhead > 4 && distAhead < 24) {
        return this.currentEWState !== 'green';
      }
    } else if (direction === 'south') {
      if (targetZ < z) targetZ += step;
      distAhead = targetZ - z;
      if (distAhead > 4 && distAhead < 24) {
        return this.currentNSState !== 'green';
      }
    } else if (direction === 'north') {
      if (targetZ > z) targetZ -= step;
      distAhead = z - targetZ;
      if (distAhead > 4 && distAhead < 24) {
        return this.currentNSState !== 'green';
      }
    }

    return false;
  }
}

import * as THREE from 'three';
import { Vehicle } from './Vehicle';
import { SoundManager } from '../audio/SoundManager';

export type MissionType = 'checkpoint_race' | 'drift_challenge' | 'speed_challenge' | 'time_trial';

export interface MissionCheckpoint {
  x: number;
  z: number;
  radius: number;
}

export interface MissionDefinition {
  id: string;
  title: string;
  type: MissionType;
  description: string;
  rewardCash: number;
  timeLimitSec: number;
  targetScore?: number;
  targetSpeedKmh?: number;
  checkpoints?: MissionCheckpoint[];
}

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'downtown_sprint',
    title: 'Downtown Sprint',
    type: 'checkpoint_race',
    description: 'High-speed street race through downtown financial avenues.',
    rewardCash: 1500,
    timeLimitSec: 75,
    checkpoints: [
      { x: 0, z: -80, radius: 14 },
      { x: 0, z: -200, radius: 14 },
      { x: 120, z: -200, radius: 14 },
      { x: 120, z: -80, radius: 14 },
      { x: 120, z: 60, radius: 14 },
      { x: 0, z: 60, radius: 14 },
      { x: 0, z: 0, radius: 14 },
    ],
  },
  {
    id: 'drift_master',
    title: 'Drift King Challenge',
    type: 'drift_challenge',
    description: 'Score 3,500 drift points using handbrake slides through corners.',
    rewardCash: 2000,
    timeLimitSec: 60,
    targetScore: 3500,
  },
  {
    id: 'speed_trap',
    title: 'Avenue Highway Speed Run',
    type: 'speed_challenge',
    description: 'Sustain speeds above 175 km/h along the central expressway.',
    rewardCash: 1800,
    timeLimitSec: 45,
    targetSpeedKmh: 175,
  },
  {
    id: 'coastal_grand_tour',
    title: 'Coastal Grand Tour',
    type: 'checkpoint_race',
    description: 'Long distance scenic sweep from downtown to the coastal shoreline.',
    rewardCash: 3000,
    timeLimitSec: 90,
    checkpoints: [
      { x: 0, z: -100, radius: 14 },
      { x: -120, z: -100, radius: 14 },
      { x: -120, z: -300, radius: 14 },
      { x: 0, z: -360, radius: 14 },
      { x: 120, z: -360, radius: 14 },
      { x: 120, z: -120, radius: 14 },
      { x: 0, z: 0, radius: 14 },
    ],
  },
];

export interface MissionState {
  active: boolean;
  mission: MissionDefinition | null;
  currentCheckpointIdx: number;
  timeRemainingSec: number;
  currentScore: number;
  status: 'idle' | 'running' | 'completed' | 'failed';
  resultMessage: string;
}

export class MissionManager {
  private scene: THREE.Scene;
  private soundManager: SoundManager;

  public state: MissionState = {
    active: false,
    mission: null,
    currentCheckpointIdx: 0,
    timeRemainingSec: 0,
    currentScore: 0,
    status: 'idle',
    resultMessage: '',
  };

  // 3D holographic in-world checkpoint visual
  private checkpointMesh: THREE.Group | null = null;
  private checkpointRing1!: THREE.Mesh;
  private checkpointRing2!: THREE.Mesh;
  private checkpointBeam!: THREE.Mesh;
  private ringMaterial!: THREE.MeshBasicMaterial;
  private beamMaterial!: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, soundManager: SoundManager) {
    this.scene = scene;
    this.soundManager = soundManager;
    this.createCheckpointVisual();
  }

  private createCheckpointVisual() {
    this.checkpointMesh = new THREE.Group();
    this.checkpointMesh.visible = false;

    // Outer spinning neon ring
    const ringGeo1 = new THREE.TorusGeometry(6.5, 0.28, 16, 32);
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });
    this.checkpointRing1 = new THREE.Mesh(ringGeo1, this.ringMaterial);
    this.checkpointRing1.position.y = 4.0;
    this.checkpointMesh.add(this.checkpointRing1);

    // Inner counter-spinning diamond/ring
    const ringGeo2 = new THREE.TorusGeometry(4.2, 0.22, 12, 24);
    this.checkpointRing2 = new THREE.Mesh(ringGeo2, this.ringMaterial);
    this.checkpointRing2.position.y = 4.0;
    this.checkpointMesh.add(this.checkpointRing2);

    // Sky vertical beam
    const beamGeo = new THREE.CylinderGeometry(0.8, 1.6, 90, 16);
    this.beamMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.checkpointBeam = new THREE.Mesh(beamGeo, this.beamMaterial);
    this.checkpointBeam.position.y = 45;
    this.checkpointMesh.add(this.checkpointBeam);

    // Ground target pulse disc
    const discGeo = new THREE.RingGeometry(0.5, 6.5, 32);
    discGeo.rotateX(-Math.PI / 2);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 0.05;
    this.checkpointMesh.add(disc);

    this.scene.add(this.checkpointMesh);
  }

  public startMission(missionId: string) {
    const mission = MISSIONS.find((m) => m.id === missionId);
    if (!mission) return;

    this.state = {
      active: true,
      mission,
      currentCheckpointIdx: 0,
      timeRemainingSec: mission.timeLimitSec,
      currentScore: 0,
      status: 'running',
      resultMessage: '',
    };

    this.updateCheckpointMarker();
  }

  public cancelMission() {
    this.state.active = false;
    this.state.status = 'idle';
    this.state.mission = null;
    if (this.checkpointMesh) {
      this.checkpointMesh.visible = false;
    }
  }

  private updateCheckpointMarker() {
    if (!this.checkpointMesh) return;

    if (!this.state.active || !this.state.mission || this.state.status !== 'running') {
      this.checkpointMesh.visible = false;
      return;
    }

    if (this.state.mission.checkpoints && this.state.mission.checkpoints.length > 0) {
      const cp = this.state.mission.checkpoints[this.state.currentCheckpointIdx];
      if (cp) {
        this.checkpointMesh.position.set(cp.x, 0, cp.z);
        this.checkpointMesh.visible = true;

        // Is finish line? (Gold color for last checkpoint)
        const isFinish = this.state.currentCheckpointIdx === this.state.mission.checkpoints.length - 1;
        const color = isFinish ? 0xffcc00 : 0x00f0ff;
        this.ringMaterial.color.setHex(color);
        this.beamMaterial.color.setHex(color);
      } else {
        this.checkpointMesh.visible = false;
      }
    } else {
      this.checkpointMesh.visible = false;
    }
  }

  public update(dt: number, vehicle: Vehicle): { missionCompleted: boolean; reward: number } {
    let result = { missionCompleted: false, reward: 0 };
    if (!this.state.active || !this.state.mission || this.state.status !== 'running') {
      return result;
    }

    // 1. Time decrement
    this.state.timeRemainingSec = Math.max(0, this.state.timeRemainingSec - dt);
    if (this.state.timeRemainingSec <= 0) {
      this.state.status = 'failed';
      this.state.resultMessage = 'TIME EXPIRED!';
      if (this.checkpointMesh) this.checkpointMesh.visible = false;
      return result;
    }

    // 2. Animate 3D Holographic marker
    if (this.checkpointMesh && this.checkpointMesh.visible) {
      this.checkpointRing1.rotation.z += dt * 1.5;
      this.checkpointRing1.rotation.x += dt * 0.7;
      this.checkpointRing2.rotation.z -= dt * 2.0;
      this.checkpointRing2.rotation.y += dt * 1.1;
    }

    const mission = this.state.mission;

    // 3. Process Mission Types
    if (mission.type === 'checkpoint_race') {
      if (mission.checkpoints && mission.checkpoints.length > 0) {
        const cp = mission.checkpoints[this.state.currentCheckpointIdx];
        const distToCP = Math.hypot(vehicle.position.x - cp.x, vehicle.position.z - cp.z);

        if (distToCP <= cp.radius) {
          // Checkpoint passed!
          this.state.currentCheckpointIdx++;

          if (this.state.currentCheckpointIdx >= mission.checkpoints.length) {
            // Race Complete!
            this.state.status = 'completed';
            this.state.resultMessage = `VICTORY! +$${mission.rewardCash}`;
            vehicle.cash += mission.rewardCash;
            result = { missionCompleted: true, reward: mission.rewardCash };
            if (this.checkpointMesh) this.checkpointMesh.visible = false;
          } else {
            this.updateCheckpointMarker();
          }
        }
      }
    } else if (mission.type === 'drift_challenge') {
      // Accumulate drift points while drifting
      if (vehicle.isDrifting) {
        this.state.currentScore = vehicle.driftScore;
      }
      if (mission.targetScore && this.state.currentScore >= mission.targetScore) {
        this.state.status = 'completed';
        this.state.resultMessage = `DRIFT TARGET REACHED! +$${mission.rewardCash}`;
        vehicle.cash += mission.rewardCash;
        result = { missionCompleted: true, reward: mission.rewardCash };
      }
    } else if (mission.type === 'speed_challenge') {
      const speedKmh = Math.abs(vehicle.speed * 3.6);
      if (speedKmh >= (mission.targetSpeedKmh || 170)) {
        this.state.currentScore += dt * 10;
        if (this.state.currentScore >= 60) {
          // Sustained high speed for 6 seconds
          this.state.status = 'completed';
          this.state.resultMessage = `SPEED TRAP BEATEN! +$${mission.rewardCash}`;
          vehicle.cash += mission.rewardCash;
          result = { missionCompleted: true, reward: mission.rewardCash };
        }
      }
    }

    return result;
  }

  public getCurrentCheckpoint(): MissionCheckpoint | null {
    if (!this.state.active || !this.state.mission || !this.state.mission.checkpoints) return null;
    return this.state.mission.checkpoints[this.state.currentCheckpointIdx] || null;
  }
}

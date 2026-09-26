import * as THREE from 'three';

export type WeatherType = 'sunny' | 'cloudy' | 'sunset' | 'night' | 'rain';

export type CameraView = 'chase' | 'close' | 'hood' | 'top' | 'orbit';

export type VehicleState =
  | 'idle'
  | 'accelerating'
  | 'cruising'
  | 'braking'
  | 'reverse'
  | 'drifting'
  | 'airborne'
  | 'collision';

export type CarModelType = 'hypercar' | 'tuner' | 'muscle' | 'cyber' | 'police';

export interface CarCustomization {
  model: CarModelType;
  primaryColor: string;
  finish: 'metallic' | 'matte' | 'chameleon' | 'chrome';
  secondaryColor: string;
  livery: 'none' | 'stripes' | 'splatter' | 'cyber' | 'police';
  underglowColor: string | 'rainbow' | 'off';
  rimStyle: 'sport' | 'mesh' | 'deepdish' | 'cyber';
  rimColor: string;
  caliperColor: string;
  spoilerStyle: 'high_gt' | 'ducktail' | 'double_wing' | 'none';
  stanceHeight: number; // -0.05 to 0.1
  handlingPreset: 'balanced' | 'drift' | 'grip' | 'drag';
}

export type CityTheme = 'metropolis' | 'cyberpunk' | 'sunset' | 'tokyo' | 'noir';

export interface CityLandmark {
  id: string;
  name: string;
  district: string;
  height: number;
  position: { x: number; y: number; z: number };
  heading: number;
  description: string;
  tagline: string;
  type: 'skyscraper' | 'resort' | 'station' | 'stunt' | 'plaza' | 'coastal';
}

export interface GraphicsSettings {
  preset: 'ultra' | 'high' | 'medium' | 'cyberpunk' | 'retro';
  streetLampPools: boolean;
  underglow: boolean;
  volumetricHeadlights: boolean;
  wetPuddles: boolean;
  buildingGlow: boolean;
  neonBillboards: boolean;
}

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  gear: string;
  state: VehicleState;
  isDrifting: boolean;
  driftAngle: number;
  driftScore: number;
  driftCombo: number;
  headlightsOn: boolean;
  isBraking: boolean;
  isReversing: boolean;
  nitroPercent: number;
  fuelPercent: number;
  damagePercent: number;
  cash: number;
  absOn: boolean;
  espOn: boolean;
  gripPercent: number;
  steerAngle: number;
  position: { x: number; y: number; z: number };
  heading: number; // in radians
  customization?: CarCustomization;
}

export interface WeatherSettings {
  name: string;
  skyColor: number;
  horizonColor: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  ambientColor: number;
  ambientIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  fogColor: number;
  fogDensity: number;
  rainIntensity: number; // 0 to 1
  roadWetness: number;   // 0 to 1
  streetLightsOn: boolean;
  headlightsRequired: boolean;
}

export interface TrafficCarData {
  id: number;
  mesh: THREE.Group;
  laneIndex: number;
  roadSegment: number;
  speed: number;
  targetSpeed: number;
  length: number;
  width: number;
  color: number;
}

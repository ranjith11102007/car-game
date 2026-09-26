import { CarCustomization, CarModelType, CityLandmark, GraphicsSettings, WeatherSettings, WeatherType } from './types';

// City grid constants
export const CITY_CONFIG = {
  BLOCK_SIZE: 120,          // Size of one city block in meters
  ROAD_WIDTH: 22,           // 4 lanes total (2 lanes in each direction)
  SIDEWALK_WIDTH: 3.5,      // Sidewalk width on each side
  GRID_HALF_EXTENT: 4,      // 9x9 city blocks = ~1.1km x 1.1km open city
  BUILDING_HEIGHT_MIN: 18,
  BUILDING_HEIGHT_MAX: 95,
  STREET_LAMP_SPACING: 35,
  TREE_SPACING: 25,
};

// Physics constants calibrated for realistic, responsive, non-flipping vehicle dynamics
export const VEHICLE_CONFIG = {
  // Dimensions
  WIDTH: 2.1,
  LENGTH: 4.6,
  HEIGHT: 1.35,
  WHEEL_BASE: 2.7,
  WHEEL_RADIUS: 0.36,

  // Performance
  ACCEL_FORCE: 16.5,          // m/s^2 forward engine acceleration
  TOP_SPEED_FORWARD: 65,      // ~234 km/h
  TOP_SPEED_REVERSE: 12,      // ~43 km/h
  REVERSE_ACCEL: 8.0,

  // Brakes & Friction (separated from throttle to prevent jitter)
  BRAKE_DECEL: 24.0,              // Controlled linear braking deceleration (m/s^2)
  HANDBRAKE_DECEL: 16.0,          // Handbrake deceleration (m/s^2)
  COAST_DRAG: 1.6,                // High speed aerodynamic drag factor
  LOW_SPEED_THRESHOLD: 1.8,       // Speeds below 1.8 m/s (~6.5 km/h) transition to constant friction
  CONSTANT_ROLLING_FRICTION: 3.8, // Constant friction deceleration (m/s^2) at low speeds to prevent jitter
  STATIC_STOP_THRESHOLD: 0.10,    // Clamps velocity cleanly to 0 m/s below this threshold
  REVERSE_ENGAGE_DELAY: 0.18,     // Standstill buffer before reverse engages when holding brake

  // Steering & Stability
  STEER_SPEED: 4.0,           // How fast steering wheel turns
  STEER_RETURN_SPEED: 6.5,    // How fast steering recenters
  MAX_STEER_ANGLE: 0.58,      // Max front wheel turn in radians (~33 deg)
  HIGH_SPEED_STEER_DAMPING: 0.45, // Steering reduces at top speed to keep car stable

  // Drift & Grip
  NORMAL_LATERAL_GRIP: 14.0,  // High lateral grip for precision road adherence
  DRIFT_LATERAL_GRIP: 2.8,    // Low grip during handbrake/skid
  DRIFT_SLIP_THRESHOLD: 0.18, // Radians slip angle to trigger drift state
  DRIFT_ANGULAR_BOOST: 1.85,  // Slight yaw assistance when drifting into a corner
  GRIP_RECOVERY_RATE: 4.5,    // Smooth recovery back to full grip
};

// "Make Car As..." Model Profiles
export interface CarModelDefinition {
  id: CarModelType;
  name: string;
  tagline: string;
  category: string;
  topSpeedKmh: number;
  accelRating: number;   // 1 to 10
  handlingRating: number;
  driftRating: number;
  drivetrain: 'AWD' | 'RWD' | 'FWD';
  weightKg: number;
  defaultPrimary: string;
  defaultSecondary: string;
  defaultSpoiler: 'high_gt' | 'ducktail' | 'double_wing' | 'none';
  soundProfile: 'exotic_v10' | 'turbo_inline6' | 'v8_supercharged' | 'cyber_electric' | 'v8_pursuit';
  description: string;
}

export const CAR_MODELS: Record<CarModelType, CarModelDefinition> = {
  hypercar: {
    id: 'hypercar',
    name: 'Apex GT Prototype',
    tagline: 'Le Mans Hypercar Aero Benchmark',
    category: 'Hypercar',
    topSpeedKmh: 345,
    accelRating: 9.8,
    handlingRating: 9.5,
    driftRating: 8.2,
    drivetrain: 'AWD',
    weightKg: 1280,
    defaultPrimary: '#10b981',
    defaultSecondary: '#ef4444',
    defaultSpoiler: 'high_gt',
    soundProfile: 'exotic_v10',
    description: 'Ultra-low wedge monocoque with dual carbon diffusers, active aerodynamics, and screaming V10 naturally-aspirated power.',
  },
  tuner: {
    id: 'tuner',
    name: 'Apex GT-R Widebody Drift',
    tagline: 'Twin-Turbo Widebody Drift Spec',
    category: 'JDM Drift Coupe',
    topSpeedKmh: 318,
    accelRating: 9.0,
    handlingRating: 8.8,
    driftRating: 10.0,
    drivetrain: 'AWD',
    weightKg: 1480,
    defaultPrimary: '#1d72b8',
    defaultSecondary: '#111827',
    defaultSpoiler: 'high_gt',
    soundProfile: 'turbo_inline6',
    description: 'Twin-turbo AWD widebody sports coupe with flared arches, GT rear wing, quad circular LED halo taillights, and tuned drift suspension.',
  },
  muscle: {
    id: 'muscle',
    name: 'Viper V8 Muscle',
    tagline: 'Blower Supercharged American Iron',
    category: 'Muscle Car',
    topSpeedKmh: 295,
    accelRating: 9.2,
    handlingRating: 7.2,
    driftRating: 9.0,
    drivetrain: 'RWD',
    weightKg: 1650,
    defaultPrimary: '#ea580c',
    defaultSecondary: '#1e293b',
    defaultSpoiler: 'ducktail',
    soundProfile: 'v8_supercharged',
    description: 'A heavy-breathing supercharger intake protruding high through the hood, dual classic stripes, and earth-shaking low-end torque.',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Racer 2099',
    tagline: 'Futuristic Stealth Polygon EV',
    category: 'Concept EV',
    topSpeedKmh: 360,
    accelRating: 10.0,
    handlingRating: 9.6,
    driftRating: 8.5,
    drivetrain: 'AWD',
    weightKg: 1420,
    defaultPrimary: '#0f172a',
    defaultSecondary: '#06b6d4',
    defaultSpoiler: 'none',
    soundProfile: 'cyber_electric',
    description: 'Angular radar-absorbent bodywork with continuous horizontal LED visor headlights, glowing aerodynamic wheel covers, and instantaneous dual-motor torque.',
  },
  police: {
    id: 'police',
    name: 'Interceptor Pursuit',
    tagline: 'State Highway Tactical Interceptor',
    category: 'Emergency Service',
    topSpeedKmh: 320,
    accelRating: 9.0,
    handlingRating: 8.8,
    driftRating: 7.8,
    drivetrain: 'AWD',
    weightKg: 1780,
    defaultPrimary: '#020617',
    defaultSecondary: '#f8fafc',
    defaultSpoiler: 'ducktail',
    soundProfile: 'v8_pursuit',
    description: 'Enforced heavy push bumper, roof-mounted strobe lightbar with active alternating Red & Blue tactical LEDs, and reinforced chassis.',
  },
};

export const DEFAULT_CAR_CUSTOMIZATION: CarCustomization = {
  model: 'tuner',
  primaryColor: '#1d72b8', // Metallic electric blue from reference image!
  finish: 'metallic',
  secondaryColor: '#111827',
  livery: 'none',
  underglowColor: 'off',
  rimStyle: 'sport',
  rimColor: '#1e293b',
  caliperColor: '#ef4444',
  spoilerStyle: 'high_gt',
  stanceHeight: 0,
  handlingPreset: 'drift',
};

// City Landmarks & Teleport Locations
export const CITY_LANDMARKS: CityLandmark[] = [
  {
    id: 'apex_spire',
    name: 'Apex Horizon Tower',
    district: 'Downtown Financial',
    height: 92,
    position: { x: 0, y: 0.2, z: 45 },
    heading: 0,
    description: 'The tallest architectural monument in the metropolis, featuring illuminated corporate spires and high-speed multi-lane plaza perimeter.',
    tagline: 'Downtown Centerpiece & Grand Boulevard',
    type: 'skyscraper',
  },
  {
    id: 'cyber_matrix',
    name: 'Cyberdyne Matrix Plaza',
    district: 'Tech District',
    height: 78,
    position: { x: -120, y: 0.2, z: -120 },
    heading: Math.PI / 2,
    description: 'Twin high-tech glass towers bathed in vibrant neon blue and cyan illumination with towering LED advertisements.',
    tagline: 'Neon-Drenched Cyber Hub',
    type: 'plaza',
  },
  {
    id: 'sunset_resort',
    name: 'Sunset Terraced Resort',
    district: 'Oceanfront Boulevard',
    height: 48,
    position: { x: 0, y: 0.2, z: -120 },
    heading: Math.PI,
    description: 'Multi-tiered beachfront architecture with cantilevered luxury gardens, infinity pool deck, and coastal avenue view.',
    tagline: 'Coastal Luxury & Oceanfront Sweeper',
    type: 'resort',
  },
  {
    id: 'turbo_diner',
    name: 'Turbo Oasis Diner & Gas',
    district: 'Midtown Crossroads',
    height: 14,
    position: { x: 120, y: 0.2, z: -120 },
    heading: 0,
    description: 'Classic retro-futuristic roadside diner with illuminated fuel canopy, neon signs, and wide paved parking for car meets.',
    tagline: 'Pit Stop & Drift Meet Arena',
    type: 'station',
  },
  {
    id: 'skyline_ramp',
    name: 'Skyline Stunt Jump Ramp',
    district: 'Avenue Highway Corridor',
    height: 22,
    position: { x: -120, y: 0.2, z: 120 },
    heading: 0,
    description: 'Elevated launch ramp setup on a parking pavilion allowing extreme airborne stunts across the city intersection.',
    tagline: 'Extreme High-Altitude Launch Pad',
    type: 'stunt',
  },
  {
    id: 'ocean_promenade',
    name: 'Marina Coastal Overlook',
    district: 'South Bay Shoreline',
    height: 8,
    position: { x: 0, y: 0.2, z: -480 },
    heading: Math.PI,
    description: 'Scenic seaside coastal highway stretching across the edge of the blue ocean bay, fringed by sandy beaches and palm trees.',
    tagline: 'High-Speed Shoreline Cruise',
    type: 'coastal',
  },
];

export const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  preset: 'ultra',
  streetLampPools: true,
  underglow: true,
  volumetricHeadlights: true,
  wetPuddles: true,
  buildingGlow: true,
  neonBillboards: true,
};

// Realistic Weather Presets
export const WEATHER_PRESETS: Record<WeatherType, WeatherSettings> = {
  sunny: {
    name: 'Sunny Day',
    skyColor: 0x1e6fd9,
    horizonColor: 0xa4d4ff,
    sunColor: 0xfff8e8,
    sunIntensity: 1.5,
    sunPosition: [150, 220, 100],
    ambientColor: 0xdceeff,
    ambientIntensity: 0.50,
    hemiSkyColor: 0x8fc4f8,
    hemiGroundColor: 0x5b7055,
    hemiIntensity: 0.40,
    fogColor: 0x94c8f5,
    fogDensity: 0.0012,
    rainIntensity: 0,
    roadWetness: 0,
    streetLightsOn: false,
    headlightsRequired: false,
  },
  cloudy: {
    name: 'Overcast',
    skyColor: 0x76889e,
    horizonColor: 0x9faec0,
    sunColor: 0xe0e7ef,
    sunIntensity: 0.7,
    sunPosition: [100, 180, 80],
    ambientColor: 0x8c9eb5,
    ambientIntensity: 0.55,
    hemiSkyColor: 0x7b8d9f,
    hemiGroundColor: 0x353a3e,
    hemiIntensity: 0.3,
    fogColor: 0x8898a8,
    fogDensity: 0.0035,
    rainIntensity: 0,
    roadWetness: 0.1,
    streetLightsOn: false,
    headlightsRequired: false,
  },
  sunset: {
    name: 'Sunset',
    skyColor: 0xd6532b,
    horizonColor: 0xf5a04e,
    sunColor: 0xff7e33,
    sunIntensity: 1.1,
    sunPosition: [280, 35, 120],
    ambientColor: 0x8a4b41,
    ambientIntensity: 0.38,
    hemiSkyColor: 0xc45d37,
    hemiGroundColor: 0x221a18,
    hemiIntensity: 0.32,
    fogColor: 0xdd7d4d,
    fogDensity: 0.0026,
    rainIntensity: 0,
    roadWetness: 0,
    streetLightsOn: true,
    headlightsRequired: true,
  },
  night: {
    name: 'Night',
    skyColor: 0x0c1424,
    horizonColor: 0x18243b,
    sunColor: 0x9dc5fa,        // Moonlight
    sunIntensity: 0.65,        // Strong moonlight for crisp road & car visibility
    sunPosition: [-80, 160, -100],
    ambientColor: 0x2e4168,    // Atmospheric blue ambient fill
    ambientIntensity: 0.58,    // High visibility at night - never pitch black
    hemiSkyColor: 0x36507c,
    hemiGroundColor: 0x1a2638,
    hemiIntensity: 0.52,
    fogColor: 0x101a2d,
    fogDensity: 0.0020,
    rainIntensity: 0,
    roadWetness: 0,
    streetLightsOn: true,
    headlightsRequired: true,
  },
  rain: {
    name: 'Heavy Rain',
    skyColor: 0x3a4856,
    horizonColor: 0x4f5e6e,
    sunColor: 0x93a3b5,
    sunIntensity: 0.45,
    sunPosition: [80, 140, 60],
    ambientColor: 0x54667a,
    ambientIntensity: 0.45,
    hemiSkyColor: 0x47596a,
    hemiGroundColor: 0x1d242c,
    hemiIntensity: 0.28,
    fogColor: 0x475869,
    fogDensity: 0.0048,
    rainIntensity: 1.0,
    roadWetness: 1.0,
    streetLightsOn: true,
    headlightsRequired: true,
  },
};

/**
 * Apex City Drive 3D
 * Open-world city driving simulator with dynamic weather, day/night cycles, drift physics, and AI traffic.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import {
  CameraView,
  CarCustomization,
  CityLandmark,
  CityTheme,
  GraphicsSettings,
  VehicleTelemetry,
  WeatherType,
} from './types';
import { EnvironmentManager } from './game/EnvironmentManager';
import { CityBuilder } from './game/CityBuilder';
import { Vehicle, VehicleInputs } from './game/Vehicle';
import { SkidManager } from './game/SkidManager';
import { TrafficManager } from './game/TrafficManager';
import { TrafficLightManager } from './game/TrafficLightManager';
import { MissionManager, MissionState } from './game/MissionManager';
import { CameraController } from './game/CameraController';
import { SoundManager } from './audio/SoundManager';
import { HUD } from './components/HUD';
import { SettingsModal } from './components/SettingsModal';
import { BuildingModal } from './components/BuildingModal';
import { CarCustomizerModal } from './components/CarCustomizerModal';
import { MissionsModal } from './components/MissionsModal';
import { PhotoModeView } from './components/PhotoModeView';
import { DEFAULT_CAR_CUSTOMIZATION, DEFAULT_GRAPHICS_SETTINGS } from './constants';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Core Game References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const envManagerRef = useRef<EnvironmentManager | null>(null);
  const cityBuilderRef = useRef<CityBuilder | null>(null);
  const vehicleRef = useRef<Vehicle | null>(null);
  const skidManagerRef = useRef<SkidManager | null>(null);
  const trafficManagerRef = useRef<TrafficManager | null>(null);
  const trafficLightManagerRef = useRef<TrafficLightManager | null>(null);
  const missionManagerRef = useRef<MissionManager | null>(null);
  const soundManagerRef = useRef<SoundManager | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  // Input State Refs (zero closure lag for 60fps responsive controls)
  const inputsRef = useRef<VehicleInputs>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    drift: false,
    nitro: false,
  });

  const touchInputsRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    drift: false,
    nitro: false,
  });

  const [touchState, setTouchState] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
    drift: false,
    nitro: false,
  });

  // UI Reactive States
  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({
    speedKmh: 0,
    rpm: 900,
    gear: 'P',
    state: 'idle',
    isDrifting: false,
    driftAngle: 0,
    driftScore: 0,
    driftCombo: 1,
    headlightsOn: false,
    isBraking: false,
    isReversing: false,
    nitroPercent: 100,
    fuelPercent: 88,
    damagePercent: 100,
    cash: 2000,
    absOn: true,
    espOn: true,
    gripPercent: 100,
    steerAngle: 0,
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
  });

  const [currentWeather, setCurrentWeather] = useState<WeatherType>('sunny');
  const [gameTime, setGameTime] = useState<string>('14:00');
  const [gameTimeHours, setGameTimeHours] = useState<number>(14.0);
  const [cameraView, setCameraView] = useState<CameraView>('chase');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoWeather, setAutoWeather] = useState<boolean>(true);
  const [autoCycleTime, setAutoCycleTime] = useState<boolean>(true);

  // Photo Mode State
  const [isPhotoMode, setIsPhotoMode] = useState<boolean>(false);
  const isPhotoModeRef = useRef<boolean>(false);

  // Modals & Customization States
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isBuildingModalOpen, setIsBuildingModalOpen] = useState<boolean>(false);
  const [isCarCustomizerOpen, setIsCarCustomizerOpen] = useState<boolean>(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState<boolean>(false);
  const [missionState, setMissionState] = useState<MissionState>({
    active: false,
    mission: null,
    currentCheckpointIdx: 0,
    timeRemainingSec: 0,
    currentScore: 0,
    status: 'idle',
    resultMessage: '',
  });

  const [cityTheme, setCityTheme] = useState<CityTheme>('metropolis');
  const [nearbyLandmark, setNearbyLandmark] = useState<{ landmark: CityLandmark; distance: number } | null>(null);
  const [graphicsSettings, setGraphicsSettings] = useState<GraphicsSettings>(DEFAULT_GRAPHICS_SETTINGS);
  const [carCustomization, setCarCustomization] = useState<CarCustomization>(DEFAULT_CAR_CUSTOMIZATION);
  const [neonBillboardsOn, setNeonBillboardsOn] = useState<boolean>(true);
  const [streetLightPoolsOn, setStreetLightPoolsOn] = useState<boolean>(true);

  // Initialize Game World (runs ONCE on mount)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      72,
      container.clientWidth / container.clientHeight,
      0.2,
      900
    );
    camera.position.set(0, 3, 8);
    cameraRef.current = camera;

    const cameraController = new CameraController(camera);
    cameraControllerRef.current = cameraController;

    // 3. Renderer with realistic Tone Mapping & high-res canvas preservation for screenshots
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Natural, balanced daylight exposure
    renderer.setClearColor(0x75bbf5, 1.0); // Natural sky-blue clear color
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // 3b. Post-Processing Pipeline: UnrealBloomPass for subtle cinematic sunlight reflections
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      0.22, // Strength: subtle, tasteful glints on car reflections & headlights without washing out the scene
      0.25, // Radius: tight, crisp specular glow
      0.92  // Threshold: only high-intensity sunlight reflections, chrome speculars & headlights bloom
    );
    composer.addPass(bloomPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    composerRef.current = composer;
    bloomPassRef.current = bloomPass;

    // 4. Sound Manager
    const soundManager = new SoundManager();
    soundManagerRef.current = soundManager;

    // 5. Environment & Weather System
    const envManager = new EnvironmentManager(scene);
    envManagerRef.current = envManager;

    // 6. Traffic Light System (Phase 17)
    const trafficLightManager = new TrafficLightManager();
    trafficLightManagerRef.current = trafficLightManager;

    // 7. City Environment & Road Network
    const cityBuilder = new CityBuilder(scene, envManager, trafficLightManager);
    cityBuilder.build();
    cityBuilderRef.current = cityBuilder;

    // 8. Skid Marks & Tire Smoke System (Phase 9, 10, 11)
    const skidManager = new SkidManager(scene);
    skidManagerRef.current = skidManager;

    // 9. Player Vehicle
    const vehicle = new Vehicle(scene, skidManager, soundManager);
    vehicle.obstacles = cityBuilder.obstacles;
    vehicle.onCollision = () => {
      cameraController.triggerShake(0.35);
    };
    vehicleRef.current = vehicle;

    // Spawn player in center boulevard lane
    vehicle.reset(0, 0, 0);

    // 10. Traffic AI System (Phase 15, 16)
    const trafficManager = new TrafficManager(scene, trafficLightManager);
    trafficManager.init(vehicle.position);
    trafficManagerRef.current = trafficManager;
    vehicle.trafficManager = trafficManager;

    // 11. Racing & Mission Manager (Phase 26, 27)
    const missionManager = new MissionManager(scene, soundManager);
    missionManagerRef.current = missionManager;

    // 12. Desktop Keyboard Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      soundManager.init();
      soundManager.resume();

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputsRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inputsRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inputsRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inputsRef.current.right = true;
          break;
        case 'Space':
          inputsRef.current.drift = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputsRef.current.nitro = true;
          break;
        case 'KeyR':
          if (vehicleRef.current) {
            vehicleRef.current.reset();
          }
          break;
        case 'KeyC':
          if (cameraControllerRef.current) {
            cameraControllerRef.current.nextViewMode();
            setCameraView(cameraControllerRef.current.viewMode);
          }
          break;
        case 'KeyL':
          if (vehicleRef.current) {
            vehicleRef.current.headlightsOn = !vehicleRef.current.headlightsOn;
          }
          break;
        case 'KeyP':
          handleTogglePhotoMode();
          break;
        case 'KeyM':
          setIsMissionsOpen((prev) => !prev);
          break;
        case 'KeyB':
          setIsBuildingModalOpen((prev) => !prev);
          break;
        case 'KeyG':
          setIsCarCustomizerOpen((prev) => !prev);
          break;
        case 'Escape':
          if (isPhotoModeRef.current) {
            handleExitPhotoMode();
          } else {
            setIsSettingsOpen((prev) => !prev);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          inputsRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          inputsRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          inputsRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          inputsRef.current.right = false;
          break;
        case 'Space':
          inputsRef.current.drift = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          inputsRef.current.nitro = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // 13. Window Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      if (composerRef.current) {
        composerRef.current.setSize(width, height);
      }
      if (bloomPassRef.current) {
        bloomPassRef.current.resolution.set(width, height);
      }
    };
    window.addEventListener('resize', handleResize);

    // 14. Main 60 FPS Game Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let hudUpdateCounter = 0;

    const gameLoop = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(gameLoop);

      const deltaMs = currentTime - lastTime;
      lastTime = currentTime;
      const dt = Math.min(deltaMs / 1000, 0.1);

      // PHOTO MODE: Pauses simulation, allows free camera navigation
      if (isPhotoModeRef.current) {
        cameraController.update(dt, vehicle, cityBuilder.obstacles);
        if (composerRef.current) {
          composerRef.current.render();
        } else {
          renderer.render(scene, camera);
        }
        return;
      }

      // Merge keyboard inputs and touch inputs directly from refs (zero lag!)
      const activeInputs: VehicleInputs = {
        forward: inputsRef.current.forward || touchInputsRef.current.forward,
        backward: inputsRef.current.backward || touchInputsRef.current.backward,
        left: inputsRef.current.left || touchInputsRef.current.left,
        right: inputsRef.current.right || touchInputsRef.current.right,
        drift: inputsRef.current.drift || touchInputsRef.current.drift,
        nitro: inputsRef.current.nitro || touchInputsRef.current.nitro,
      };

      const isRain = envManager.rainIntensity > 0.3;

      // Update Vehicle Physics
      vehicle.update(dt, activeInputs, isRain);

      // Auto headlights in dark or rain
      const isDark =
        envManager.currentWeather === 'night' ||
        envManager.currentWeather === 'rain' ||
        envManager.currentWeather === 'sunset';
      if (isDark && !vehicle.headlightsOn) {
        vehicle.headlightsOn = true;
      }

      // Update Environment & Weather
      envManager.update(dt, vehicle.position);

      // Update Traffic Lights (Phase 17)
      trafficLightManager.update(dt);

      // Update Skid Marks & Smoke (Phase 9, 10, 11)
      skidManager.update(dt);

      // Update Traffic (Phase 15, 16)
      trafficManager.update(dt, vehicle.position, isDark);

      // Update Missions (Phase 26, 27)
      missionManager.update(dt, vehicle);

      // Update Camera (Phase 6)
      cameraController.update(dt, vehicle, cityBuilder.obstacles);

      // Render Scene with UnrealBloomPass post-processing
      if (composerRef.current) {
        composerRef.current.render();
      } else {
        renderer.render(scene, camera);
      }

      // Update HUD UI at 20-30Hz
      hudUpdateCounter++;
      if (hudUpdateCounter % 2 === 0) {
        setTelemetry(vehicle.getTelemetry());
        setCurrentWeather(envManager.currentWeather);
        setGameTime(envManager.getFormattedTime());
        setGameTimeHours(envManager.gameTimeHours);
        setMissionState({ ...missionManager.state });
      }

      // Check proximity to landmarks every few frames
      if (hudUpdateCounter % 6 === 0 && cityBuilderRef.current) {
        const found = cityBuilderRef.current.getNearbyLandmark(vehicle.position.x, vehicle.position.z, 65);
        setNearbyLandmark(found);
      }
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (composerRef.current) {
        composerRef.current.dispose();
      }
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Touch controls updater (zero lag, updates ref immediately)
  const handleTouchInput = useCallback(
    (key: 'forward' | 'backward' | 'left' | 'right' | 'drift' | 'nitro', active: boolean) => {
      touchInputsRef.current[key] = active;
      setTouchState((prev) => ({ ...prev, [key]: active }));
      if (soundManagerRef.current) {
        soundManagerRef.current.init();
        soundManagerRef.current.resume();
      }
    },
    []
  );

  // Photo Mode Handlers
  const handleEnterPhotoMode = useCallback(() => {
    isPhotoModeRef.current = true;
    setIsPhotoMode(true);
    if (cameraControllerRef.current && vehicleRef.current) {
      cameraControllerRef.current.enterPhotoMode(vehicleRef.current);
    }
    if (soundManagerRef.current) {
      soundManagerRef.current.updateEngine(0, 0, 0);
      soundManagerRef.current.updateSkid(0);
    }
  }, []);

  const handleExitPhotoMode = useCallback(() => {
    isPhotoModeRef.current = false;
    setIsPhotoMode(false);
    if (cameraControllerRef.current) {
      cameraControllerRef.current.exitPhotoMode();
    }
  }, []);

  const handleTogglePhotoMode = useCallback(() => {
    if (isPhotoModeRef.current) {
      handleExitPhotoMode();
    } else {
      handleEnterPhotoMode();
    }
  }, [handleEnterPhotoMode, handleExitPhotoMode]);

  // Quick Action Handlers
  const handleResetCar = useCallback(() => {
    if (vehicleRef.current) {
      vehicleRef.current.reset();
    }
  }, []);

  const handleCycleCamera = useCallback(() => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.nextViewMode();
      setCameraView(cameraControllerRef.current.viewMode);
    }
  }, []);

  const handleToggleHeadlights = useCallback(() => {
    if (vehicleRef.current) {
      vehicleRef.current.headlightsOn = !vehicleRef.current.headlightsOn;
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    if (soundManagerRef.current) {
      const nextMuted = !isMuted;
      soundManagerRef.current.setMuted(nextMuted);
      setIsMuted(nextMuted);
    }
  }, [isMuted]);

  const handleChangeWeather = useCallback((w: WeatherType) => {
    if (envManagerRef.current) {
      envManagerRef.current.setWeather(w, 2.5);
      setCurrentWeather(w);
    }
  }, []);

  const handleToggleAutoWeather = useCallback(() => {
    if (envManagerRef.current) {
      envManagerRef.current.autoCycleWeather = !autoWeather;
      setAutoWeather(!autoWeather);
    }
  }, [autoWeather]);

  const handleChangeGameTime = useCallback((h: number) => {
    if (envManagerRef.current) {
      envManagerRef.current.gameTimeHours = h;
      setGameTimeHours(h);
      setGameTime(envManagerRef.current.getFormattedTime());
    }
  }, []);

  const handleToggleAutoCycleTime = useCallback(() => {
    if (envManagerRef.current) {
      envManagerRef.current.autoCycleTime = !autoCycleTime;
      setAutoCycleTime(!autoCycleTime);
    }
  }, [autoCycleTime]);

  const handleChangeCamera = useCallback((c: CameraView) => {
    if (cameraControllerRef.current) {
      cameraControllerRef.current.setViewMode(c);
      setCameraView(c);
    }
  }, []);

  // Teleportation to landmarks
  const handleTeleportToLandmark = useCallback((landmark: CityLandmark) => {
    if (vehicleRef.current) {
      vehicleRef.current.reset(landmark.position.x, landmark.position.z, landmark.heading);
      if (soundManagerRef.current) {
        soundManagerRef.current.updateEngine(0, 0.2, 0);
      }
    }
  }, []);

  // Vehicle Customization ("Make Car As...")
  const handleApplyCarCustomization = useCallback((custom: CarCustomization) => {
    if (vehicleRef.current) {
      vehicleRef.current.applyCustomization(custom);
      setCarCustomization(custom);
    }
  }, []);

  // City Theme Changer
  const handleChangeCityTheme = useCallback((theme: CityTheme) => {
    if (envManagerRef.current) {
      envManagerRef.current.setCityTheme(theme);
      setCityTheme(theme);
      setCurrentWeather(envManagerRef.current.currentWeather);
    }
  }, []);

  // Toggle Neon Billboards
  const handleToggleNeonBillboards = useCallback(() => {
    setNeonBillboardsOn((prev) => {
      const next = !prev;
      if (envManagerRef.current) {
        for (const mat of envManagerRef.current.neonMaterials) {
          mat.visible = next;
        }
      }
      return next;
    });
  }, []);

  // Toggle Street Light Pools
  const handleToggleStreetLightPools = useCallback(() => {
    setStreetLightPoolsOn((prev) => {
      const next = !prev;
      if (envManagerRef.current) {
        for (const mat of envManagerRef.current.lightPoolMaterials) {
          mat.visible = next;
        }
      }
      return next;
    });
  }, []);

  // Missions
  const handleStartMission = useCallback((missionId: string) => {
    if (missionManagerRef.current) {
      missionManagerRef.current.startMission(missionId);
      setMissionState({ ...missionManagerRef.current.state });
    }
  }, []);

  const handleCancelMission = useCallback(() => {
    if (missionManagerRef.current) {
      missionManagerRef.current.cancelMission();
      setMissionState({ ...missionManagerRef.current.state });
    }
  }, []);

  // Rev engine soundcheck
  const handleRevEngine = useCallback(() => {
    if (soundManagerRef.current) {
      soundManagerRef.current.init();
      soundManagerRef.current.resume();
      soundManagerRef.current.updateEngine(65, 0.95, 1.0);
      setTimeout(() => {
        if (soundManagerRef.current) {
          soundManagerRef.current.updateEngine(0, 0.2, 0);
        }
      }, 650);
    }
  }, []);

  // Graphics Settings handler
  const handleChangeGraphicsSettings = useCallback((settings: Partial<GraphicsSettings>) => {
    setGraphicsSettings((prev) => {
      const updated = { ...prev, ...settings };
      if (settings.streetLampPools !== undefined && envManagerRef.current) {
        for (const mat of envManagerRef.current.lightPoolMaterials) {
          mat.visible = settings.streetLampPools;
        }
      }
      if (settings.underglow !== undefined && vehicleRef.current) {
        if (vehicleRef.current.underglowMesh) {
          vehicleRef.current.underglowMesh.visible = settings.underglow;
        }
        if (vehicleRef.current.underglowLight) {
          vehicleRef.current.underglowLight.visible = settings.underglow;
        }
      }
      if (settings.preset !== undefined && bloomPassRef.current) {
        bloomPassRef.current.strength =
          settings.preset === 'ultra' ? 0.26 : settings.preset === 'high' ? 0.20 : settings.preset === 'medium' ? 0.14 : 0.18;
      }
      return updated;
    });
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Modern HUD with Hub Controls (Hidden during Photo Mode) */}
      {!isPhotoMode && (
        <HUD
          telemetry={telemetry}
          weather={currentWeather}
          gameTime={gameTime}
          cameraView={cameraView}
          trafficManager={trafficManagerRef.current}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onCycleCamera={handleCycleCamera}
          onResetCar={handleResetCar}
          onToggleHeadlights={handleToggleHeadlights}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenBuildingModal={() => setIsBuildingModalOpen(true)}
          onOpenCarCustomizer={() => setIsCarCustomizerOpen(true)}
          onOpenMissions={() => setIsMissionsOpen(true)}
          onOpenPhotoMode={handleEnterPhotoMode}
          missionState={missionState}
          nearbyLandmark={nearbyLandmark}
          onTouchInput={handleTouchInput}
          touchState={touchState}
        />
      )}

      {/* Photo Mode Cinematic Studio & Free Camera */}
      <PhotoModeView
        isActive={isPhotoMode}
        onExit={handleExitPhotoMode}
        cameraController={cameraControllerRef.current}
        vehicle={vehicleRef.current}
        soundManager={soundManagerRef.current}
        rendererCanvas={rendererRef.current?.domElement || null}
        gameTime={gameTime}
      />

      {/* City Missions & Races Modal */}
      <MissionsModal
        isOpen={isMissionsOpen}
        onClose={() => setIsMissionsOpen(false)}
        missionState={missionState}
        onStartMission={handleStartMission}
        onCancelMission={handleCancelMission}
      />

      {/* Building & City Explorer Modal */}
      <BuildingModal
        isOpen={isBuildingModalOpen}
        onClose={() => setIsBuildingModalOpen(false)}
        playerPos={telemetry.position}
        currentTheme={cityTheme}
        onChangeTheme={handleChangeCityTheme}
        onTeleport={handleTeleportToLandmark}
        neonBillboardsOn={neonBillboardsOn}
        onToggleNeonBillboards={handleToggleNeonBillboards}
        streetLightPoolsOn={streetLightPoolsOn}
        onToggleStreetLightPools={handleToggleStreetLightPools}
      />

      {/* Make Car As... Customizer & Garage Modal */}
      <CarCustomizerModal
        isOpen={isCarCustomizerOpen}
        onClose={() => setIsCarCustomizerOpen(false)}
        customization={carCustomization}
        onApplyCustomization={handleApplyCarCustomization}
        onRevEngine={handleRevEngine}
      />

      {/* Settings / Simulation Controls Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentWeather={currentWeather}
        onChangeWeather={handleChangeWeather}
        autoWeather={autoWeather}
        onToggleAutoWeather={handleToggleAutoWeather}
        gameTimeHours={gameTimeHours}
        onChangeGameTime={handleChangeGameTime}
        autoCycleTime={autoCycleTime}
        onToggleAutoCycleTime={handleToggleAutoCycleTime}
        cameraView={cameraView}
        onChangeCamera={handleChangeCamera}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        onResetCar={handleResetCar}
        onOpenBuildingModal={() => setIsBuildingModalOpen(true)}
        onOpenCarCustomizer={() => setIsCarCustomizerOpen(true)}
        graphicsSettings={graphicsSettings}
        onChangeGraphicsSettings={handleChangeGraphicsSettings}
      />
    </div>
  );
}

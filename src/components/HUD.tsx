import React, { useState, useEffect } from 'react';
import { CameraView, CityLandmark, VehicleTelemetry, WeatherType } from '../types';
import { MiniMap } from './MiniMap';
import { TrafficManager } from '../game/TrafficManager';
import {
  RotateCcw,
  Pause,
  Zap,
  Fuel,
  Car,
  Clock,
  Camera,
  Lightbulb,
  Building2,
  Paintbrush,
  MapPin,
  Flag,
  Trophy,
} from 'lucide-react';
import { MissionState } from '../game/MissionManager';

interface HUDProps {
  telemetry: VehicleTelemetry;
  weather: WeatherType;
  gameTime: string;
  cameraView: CameraView;
  trafficManager: TrafficManager | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onCycleCamera: () => void;
  onResetCar: () => void;
  onToggleHeadlights: () => void;
  onOpenSettings: () => void;
  onOpenBuildingModal: () => void;
  onOpenCarCustomizer: () => void;
  onOpenMissions?: () => void;
  onOpenPhotoMode?: () => void;
  missionState?: MissionState;
  nearbyLandmark?: { landmark: CityLandmark; distance: number } | null;
  // Touch Handlers
  onTouchInput: (key: 'forward' | 'backward' | 'left' | 'right' | 'drift' | 'nitro', active: boolean) => void;
  touchState: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    drift: boolean;
    nitro: boolean;
  };
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  weather,
  gameTime,
  cameraView,
  trafficManager,
  isMuted,
  onToggleMute,
  onCycleCamera,
  onResetCar,
  onToggleHeadlights,
  onOpenSettings,
  onOpenBuildingModal,
  onOpenCarCustomizer,
  onOpenMissions,
  onOpenPhotoMode,
  missionState,
  nearbyLandmark,
  onTouchInput,
  touchState,
}) => {
  // Stopwatch timer (counting up from 00:03:20 like in the screenshot!)
  const [seconds, setSeconds] = useState(200);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const fuelPct = telemetry.fuelPercent ?? 88;
  const damagePct = telemetry.damagePercent ?? 100;
  const cashVal = telemetry.cash ?? 2000;

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden flex flex-col justify-between p-3 sm:p-5">
      {/* ================= TOP BAR ================= */}
      <div className="w-full flex items-start justify-between">
        {/* Top Left: Minimap + Stopwatch + Fuel & Damage Bars (Matching screenshot!) */}
        <div className="flex flex-col gap-2 pointer-events-auto">
          <div className="flex items-start gap-3">
            {/* Circular Radar MiniMap */}
            <MiniMap
              playerX={telemetry.position.x}
              playerZ={telemetry.position.z}
              playerHeading={telemetry.heading}
              trafficManager={trafficManager}
              checkpoints={missionState?.mission?.checkpoints}
              currentCheckpointIdx={missionState?.currentCheckpointIdx}
            />

            {/* Stopwatch Timer Pill (Exact match: ⏱ 00:03:20) */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-sky-400/35 px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-[0_6px_20px_rgba(2,132,199,0.2)]">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-speedo text-xs sm:text-sm font-bold text-white tracking-wider">
                {formatTimer(seconds)}
              </span>
            </div>
          </div>

          {/* FUEL and DAMAGE Status Bars */}
          <div className="flex flex-col gap-1.5 bg-slate-900/80 backdrop-blur-xl border border-sky-400/30 p-2.5 rounded-2xl shadow-[0_8px_25px_rgba(2,132,199,0.2)] w-[165px]">
            {/* FUEL BAR */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-rose-600/90 flex items-center justify-center shrink-0 shadow-sm">
                <Fuel className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-[9px] font-mono font-bold text-sky-100">
                  <span>FUEL</span>
                  <span className="text-[8px] text-sky-300">{fuelPct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden flex gap-0.5 p-[1px]">
                  <div
                    className="h-full bg-emerald-400 rounded-xs transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    style={{ width: `${Math.min(100, fuelPct)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* DAMAGE BAR */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-sky-600/90 flex items-center justify-center shrink-0 shadow-sm">
                <Car className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-[9px] font-mono font-bold text-sky-100">
                  <span>DAMAGE</span>
                  <span className="text-[8px] text-sky-300">{damagePct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden flex gap-0.5 p-[1px]">
                  <div
                    className={`h-full rounded-xs transition-all duration-300 ${
                      damagePct > 50 ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                    }`}
                    style={{ width: `${Math.min(100, damagePct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Center: Active Mission HUD Banner / Proximity Landmark Toast & Drift Combo Toast */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          {/* Active Mission HUD Banner (Phase 26 & 27) */}
          {missionState?.active && missionState.mission && (
            <div className="bg-slate-950/90 backdrop-blur-md px-5 py-2 rounded-2xl border-2 border-sky-400/60 shadow-[0_0_30px_rgba(14,165,233,0.4)] flex flex-col items-center gap-1 animate-pulse">
              <div className="flex items-center gap-2.5">
                <Flag className="w-4 h-4 text-sky-400" />
                <span className="font-speedo text-sm font-bold text-white tracking-wider uppercase">
                  {missionState.mission.title}
                </span>
                <span className="font-mono text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                  ⏱ {Math.ceil(missionState.timeRemainingSec)}s
                </span>
              </div>

              {missionState.mission.checkpoints && (
                <div className="text-xs font-mono font-bold text-sky-300 flex items-center gap-2">
                  <span>
                    CHECKPOINT {(missionState.currentCheckpointIdx ?? 0) + 1} / {missionState.mission.checkpoints.length}
                  </span>
                </div>
              )}

              {missionState.mission.type === 'drift_challenge' && (
                <div className="text-xs font-mono font-bold text-amber-300">
                  DRIFT TARGET: {missionState.currentScore} / {missionState.mission.targetScore} PTS
                </div>
              )}

              {missionState.resultMessage && (
                <div className="text-xs font-bold font-speedo text-emerald-400 animate-bounce">
                  {missionState.resultMessage}
                </div>
              )}
            </div>
          )}

          {nearbyLandmark && !missionState?.active && (
            <button
              onClick={onOpenBuildingModal}
              title="Inspect Landmark [B]"
              className="bg-slate-950/85 hover:bg-slate-900/95 backdrop-blur-md px-4 py-1.5 rounded-full border border-sky-400/40 shadow-xl flex items-center gap-2 group transition-all active:scale-95"
            >
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-speedo text-xs font-bold text-white tracking-wide">
                {nearbyLandmark.landmark.name}
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                ({nearbyLandmark.distance}m)
              </span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono font-bold">
                [B]
              </span>
            </button>
          )}

          {telemetry.isDrifting && (
            <div className="flex flex-col items-center animate-bounce">
              <div className="bg-gradient-to-r from-amber-500/95 to-red-600/95 backdrop-blur-md px-5 py-2 rounded-xl border border-amber-300/50 shadow-[0_0_25px_rgba(245,158,11,0.6)] flex items-center gap-2.5">
                <span className="font-speedo font-bold italic tracking-wider text-xl text-white">
                  DRIFT +{telemetry.driftScore}
                </span>
                {telemetry.driftCombo > 1 && (
                  <span className="bg-white text-amber-700 font-extrabold text-xs px-2 py-0.5 rounded-md shadow">
                    x{telemetry.driftCombo}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-amber-300 mt-1 drop-shadow font-semibold">
                {telemetry.driftAngle}° SLIP ANGLE
              </span>
            </div>
          )}
        </div>

        {/* Top Right: Cash Pill + Hub Buttons + Reset + Pause + Speedometer Badge */}
        <div className="flex flex-col items-end gap-2.5 pointer-events-auto">
          {/* Top Row: Quick Hub Buttons + Cash + Reset + Pause */}
          <div className="flex items-center gap-2">
            {/* Quick Hub: Photo Mode [P] */}
            <button
              onClick={onOpenPhotoMode}
              title="Photo Mode & Cinematic Studio [P]"
              className="px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-emerald-400/50 flex items-center gap-1.5 shadow-[0_4px_16px_rgba(16,185,129,0.25)] active:scale-95 text-xs font-bold font-speedo transition-all"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Photo</span>
              <span className="text-[10px] text-emerald-300 font-mono">[P]</span>
            </button>

            {/* Quick Hub: Missions [M] (Phase 26) */}
            <button
              onClick={onOpenMissions}
              title="City Races & Missions [M]"
              className="px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-sky-400/50 flex items-center gap-1.5 shadow-[0_4px_16px_rgba(14,165,233,0.25)] active:scale-95 text-xs font-bold font-speedo transition-all"
            >
              <Flag className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Missions</span>
              <span className="text-[10px] text-sky-300 font-mono">[M]</span>
            </button>

            {/* Quick Hub: Buildings [B] */}
            <button
              onClick={onOpenBuildingModal}
              title="City Buildings & Architecture [B]"
              className="px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-sky-400/40 flex items-center gap-1.5 shadow-[0_4px_16px_rgba(14,165,233,0.2)] active:scale-95 text-xs font-bold font-speedo transition-all"
            >
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden md:inline">Buildings</span>
              <span className="text-[10px] text-sky-300 font-mono">[B]</span>
            </button>

            {/* Quick Hub: Make Car As... [G] */}
            <button
              onClick={onOpenCarCustomizer}
              title="Make Car As... Customizer [G]"
              className="px-3 py-1.5 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-amber-400/50 flex items-center gap-1.5 shadow-[0_4px_16px_rgba(245,158,11,0.2)] active:scale-95 text-xs font-bold font-speedo transition-all"
            >
              <Paintbrush className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Make Car</span>
              <span className="text-[10px] text-amber-300 font-mono">[G]</span>
            </button>

            {/* Cash Badge (💵 2000) */}
            <div className="bg-slate-900/85 backdrop-blur-xl border border-sky-400/35 px-3.5 py-1.5 rounded-full flex items-center gap-2 shadow-[0_6px_20px_rgba(2,132,199,0.22)]">
              <span className="text-base leading-none">💵</span>
              <span className="font-speedo text-sm sm:text-base font-bold text-white tracking-wide">
                {cashVal.toLocaleString()}
              </span>
            </div>

            {/* Circular Reset Button (↺) */}
            <button
              onClick={onResetCar}
              title="Reset Car [R]"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-sky-400/35 flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(2,132,199,0.22)] active:scale-95"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-sky-300" />
            </button>

            {/* Circular Pause / Settings Button (⏸) */}
            <button
              onClick={onOpenSettings}
              title="Pause / Settings [ESC]"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900/85 hover:bg-slate-800 text-white border border-sky-400/35 flex items-center justify-center transition-all shadow-[0_4px_16px_rgba(2,132,199,0.22)] active:scale-95"
            >
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white" />
            </button>
          </div>

          {/* Speedometer & Gear Badge + RPM Gauge */}
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              <span className="font-speedo text-4xl sm:text-5xl font-black text-white tracking-tight leading-none drop-shadow">
                {telemetry.speedKmh.toString().padStart(3, '0')}
              </span>

              {/* Vertical Blue Gear & Unit Box */}
              <div className="bg-sky-500 text-white rounded-lg px-2 py-1 flex flex-col items-center justify-center shadow-[0_2px_10px_rgba(14,165,233,0.4)] border border-sky-300/40 min-w-[38px]">
                <span className="font-speedo text-base sm:text-lg font-black leading-none">
                  {telemetry.gear === 'P' ? 'P' : telemetry.gear === 'R' ? 'R' : telemetry.gear}
                </span>
                <span className="text-[9px] font-bold tracking-tight text-sky-100 leading-none mt-0.5">
                  KM/H
                </span>
              </div>
            </div>

            {/* Dynamic RPM Tachometer Bar */}
            <div className="w-28 h-1.5 bg-slate-800/90 rounded-full overflow-hidden flex gap-0.5 p-[1px] border border-white/10 shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  telemetry.speedKmh > 180 ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-sky-400 to-emerald-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(12, ((telemetry.speedKmh % 45) / 45) * 100))}%` }}
              />
            </div>
          </div>

          {/* Small Aux Buttons (Camera, Headlights, Sound) */}
          <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
            <button
              onClick={onCycleCamera}
              title="Camera [C]"
              className="p-1.5 rounded-lg bg-slate-950/70 border border-white/10 text-slate-300 hover:text-white"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onToggleHeadlights}
              title="Headlights [L]"
              className={`p-1.5 rounded-lg border text-xs ${
                telemetry.headlightsOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-950/70 border-white/10 text-slate-300'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= RIGHT SIDE: SMARTPHONE FLOATING BUTTON ================= */}
      <div className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 pointer-events-auto">
        <button
          onClick={onOpenSettings}
          title="In-Game Phone [ESC]"
          className="relative group transition-transform active:scale-95"
        >
          {/* Smartphone Silhouette matching screenshot */}
          <div className="w-10 h-18 sm:w-11 sm:h-20 rounded-2xl bg-slate-900 border-2 border-slate-700 shadow-2xl p-1 flex flex-col items-center justify-between rotate-12 group-hover:rotate-0 transition-transform">
            <div className="w-3 h-0.5 bg-slate-600 rounded-full mt-0.5" />
            <div className="w-full flex-1 rounded-lg bg-gradient-to-br from-purple-600 via-indigo-600 to-pink-500 m-0.5 flex flex-col items-center justify-center p-1">
              <div className="grid grid-cols-2 gap-1 opacity-80">
                <div className="w-1.5 h-1.5 rounded-xs bg-white/70" />
                <div className="w-1.5 h-1.5 rounded-xs bg-white/70" />
                <div className="w-1.5 h-1.5 rounded-xs bg-white/70" />
                <div className="w-1.5 h-1.5 rounded-xs bg-white/70" />
              </div>
            </div>
            <div className="w-2 h-2 rounded-full border border-slate-600 mb-0.5" />
          </div>

          {/* Red Notification Bubble */}
          <div className="absolute -top-1.5 -right-1 w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[10px] flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
            !
          </div>
        </button>
      </div>

      {/* ================= BOTTOM BAR ================= */}
      <div className="w-full flex items-end justify-between">
        {/* Bottom Left: Concentric Ribbed Steering Pad (Exact match to screenshot!) */}
        <div className="pointer-events-auto select-none touch-none">
          <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-full border-2 border-white/20 bg-slate-950/60 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.6)] flex items-center justify-between p-2 overflow-hidden">
            {/* Concentric Ribbed Background Texture */}
            <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute inset-6 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute inset-10 rounded-full border border-white/10 pointer-events-none" />
            <div className="absolute inset-14 rounded-full border border-white/10 pointer-events-none" />

            {/* Left Steering Arrow ( « ) */}
            <button
              onPointerDown={() => onTouchInput('left', true)}
              onPointerUp={() => onTouchInput('left', false)}
              onPointerLeave={() => onTouchInput('left', false)}
              onPointerCancel={() => onTouchInput('left', false)}
              className={`w-14 h-24 sm:w-16 sm:h-28 rounded-l-full flex items-center justify-center transition-all ${
                touchState.left
                  ? 'bg-sky-500/40 text-sky-200 scale-95'
                  : 'text-white/80 hover:text-white active:bg-white/10'
              }`}
              title="Steer Left [A / ←]"
            >
              <span className="font-speedo text-3xl sm:text-4xl font-black drop-shadow tracking-tighter">
                «
              </span>
            </button>

            {/* Center Divider Line */}
            <div className="w-[1px] h-16 bg-white/15" />

            {/* Right Steering Arrow ( » ) */}
            <button
              onPointerDown={() => onTouchInput('right', true)}
              onPointerUp={() => onTouchInput('right', false)}
              onPointerLeave={() => onTouchInput('right', false)}
              onPointerCancel={() => onTouchInput('right', false)}
              className={`w-14 h-24 sm:w-16 sm:h-28 rounded-r-full flex items-center justify-center transition-all ${
                touchState.right
                  ? 'bg-sky-500/40 text-sky-200 scale-95'
                  : 'text-white/80 hover:text-white active:bg-white/10'
              }`}
              title="Steer Right [D / →]"
            >
              <span className="font-speedo text-3xl sm:text-4xl font-black drop-shadow tracking-tighter">
                »
              </span>
            </button>
          </div>
        </div>

        {/* Bottom Center: Keyboard hint for desktop */}
        <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-slate-400 bg-slate-950/70 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 shadow-lg">
          <span>[W/S] Gas & Brake</span>
          <span>·</span>
          <span>[A/D] Steer</span>
          <span>·</span>
          <span>[SPACE] Drift</span>
          <span>·</span>
          <span>[SHIFT] Nitro</span>
          <span>·</span>
          <span>[M] Map</span>
          <span>·</span>
          <span>[B] Buildings</span>
          <span>·</span>
          <span>[G] Make Car</span>
        </div>

        {/* Bottom Right: Modern Realistic Pedals (Exact match to screenshot!) */}
        <div className="flex items-end gap-3 pointer-events-auto select-none touch-none">
          {/* Circular Nitro Boost Button (⚡) */}
          <div className="flex flex-col items-center gap-2 mb-1">
            <button
              onPointerDown={() => onTouchInput('nitro', true)}
              onPointerUp={() => onTouchInput('nitro', false)}
              onPointerLeave={() => onTouchInput('nitro', false)}
              onPointerCancel={() => onTouchInput('nitro', false)}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center transition-all shadow-[0_0_20px_rgba(56,189,248,0.5)] active:scale-95 ${
                touchState.nitro || telemetry.nitroPercent < 100
                  ? 'bg-sky-500 border-white text-white shadow-sky-400/80 scale-95'
                  : 'bg-slate-950/80 border-sky-400/80 text-sky-400 hover:bg-slate-900'
              }`}
              title="Nitro Boost [SHIFT]"
            >
              <Zap className="w-6 h-6 fill-current" />
            </button>

            {/* Stylized Handbrake / Drift Lever Button ( > ) */}
            <button
              onPointerDown={() => onTouchInput('drift', true)}
              onPointerUp={() => onTouchInput('drift', false)}
              onPointerLeave={() => onTouchInput('drift', false)}
              onPointerCancel={() => onTouchInput('drift', false)}
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 border-white/20 bg-slate-950/80 flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                touchState.drift
                  ? 'bg-amber-500 border-amber-300 text-slate-950 scale-95 shadow-amber-500/50'
                  : 'text-white hover:bg-slate-900'
              }`}
              title="Handbrake Drift [SPACE]"
            >
              {/* Stylized Parking Brake Lever Icon */}
              <span className="font-speedo text-2xl font-black leading-none drop-shadow">
                &gt;
              </span>
            </button>
          </div>

          {/* Metal Brake Pedal (Wide Rectangular with Horizontal Grooves) */}
          <button
            onPointerDown={() => onTouchInput('backward', true)}
            onPointerUp={() => onTouchInput('backward', false)}
            onPointerLeave={() => onTouchInput('backward', false)}
            onPointerCancel={() => onTouchInput('backward', false)}
            className={`w-18 sm:w-20 h-22 sm:h-24 rounded-2xl border-2 transition-all shadow-2xl flex flex-col items-center justify-center gap-2 p-2 ${
              touchState.backward
                ? 'bg-gradient-to-b from-red-600 to-red-800 border-red-400 scale-95 shadow-red-600/50'
                : 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-slate-400/60 hover:border-slate-300'
            }`}
            title="Brake / Reverse [S / ↓]"
          >
            {/* Horizontal Grip Ribs */}
            <div className="w-10 h-1 rounded-full bg-slate-400/70" />
            <div className="w-10 h-1 rounded-full bg-slate-400/70" />
            <div className="w-10 h-1 rounded-full bg-slate-400/70" />
            <span className="font-speedo text-[9px] font-bold text-slate-300 tracking-widest uppercase">
              BRAKE
            </span>
          </button>

          {/* Metal Gas / Accelerator Pedal (Tall Vertical with Vertical Grooves) */}
          <button
            onPointerDown={() => onTouchInput('forward', true)}
            onPointerUp={() => onTouchInput('forward', false)}
            onPointerLeave={() => onTouchInput('forward', false)}
            onPointerCancel={() => onTouchInput('forward', false)}
            className={`w-14 sm:w-16 h-28 sm:h-32 rounded-2xl border-2 transition-all shadow-2xl flex flex-col items-center justify-between p-2.5 ${
              touchState.forward
                ? 'bg-gradient-to-b from-emerald-600 to-emerald-800 border-emerald-400 scale-95 shadow-emerald-600/50'
                : 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-slate-400/60 hover:border-slate-300'
            }`}
            title="Gas / Accelerate [W / ↑]"
          >
            {/* Vertical Traction Grooves */}
            <div className="w-full flex-1 flex justify-center gap-1.5 my-1">
              <div className="w-1.5 h-full rounded-full bg-slate-400/70" />
              <div className="w-1.5 h-full rounded-full bg-slate-400/70" />
              <div className="w-1.5 h-full rounded-full bg-slate-400/70" />
            </div>
            <span className="font-speedo text-[9px] font-bold text-slate-300 tracking-widest uppercase">
              GAS
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

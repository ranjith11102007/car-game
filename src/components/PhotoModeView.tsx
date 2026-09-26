import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraController } from '../game/CameraController';
import { Vehicle } from '../game/Vehicle';
import { SoundManager } from '../audio/SoundManager';
import {
  Camera,
  Sliders,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  Download,
  Grid,
  Sparkles,
  Maximize2,
  Sun,
  Palette,
  Film,
} from 'lucide-react';

export interface PhotoModeViewProps {
  isActive: boolean;
  onExit: () => void;
  cameraController: CameraController | null;
  vehicle: Vehicle | null;
  soundManager: SoundManager | null;
  rendererCanvas: HTMLCanvasElement | null;
  gameTime: string;
}

export type ColorFilterPreset = 'none' | 'daylight' | 'cinema' | 'chrome' | 'golden' | 'noir' | 'cyber';

export const PhotoModeView: React.FC<PhotoModeViewProps> = ({
  isActive,
  onExit,
  cameraController,
  vehicle,
  soundManager,
  rendererCanvas,
  gameTime,
}) => {
  // UI visibility (Clean Screen mode)
  const [hideUI, setHideUI] = useState(false);
  const [activeTab, setActiveTab] = useState<'lens' | 'filter' | 'frame'>('lens');

  // Lens & DoF settings
  const [fov, setFov] = useState(46);
  const [roll, setRoll] = useState(0);
  const [heightOffset, setHeightOffset] = useState(0.85);
  const [dofAmount, setDofAmount] = useState(35); // 0 to 100%
  const [focusDistance, setFocusDistance] = useState(5.5);

  // Filter & Color Grading
  const [filterPreset, setFilterPreset] = useState<ColorFilterPreset>('daylight');
  const [exposure, setExposure] = useState(1.0);
  const [contrast, setContrast] = useState(1.08);
  const [saturation, setSaturation] = useState(1.15);
  const [vignette, setVignette] = useState(30);

  // Framing
  const [letterbox, setLetterbox] = useState(true);
  const [showGrid, setShowGrid] = useState(false);

  // Capture State & Feedback
  const [shutterFlash, setShutterFlash] = useState(false);
  const [savedThumbnail, setSavedThumbnail] = useState<string | null>(null);

  // Pointer dragging state for orbit & pan
  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Reset Photo Camera
  const handleResetCamera = useCallback(() => {
    if (cameraController && vehicle) {
      cameraController.resetPhotoCamera(vehicle);
      setFov(46);
      setRoll(0);
      setHeightOffset(0.85);
    }
  }, [cameraController, vehicle]);

  // Keyboard shortcut listener (H to hide UI, ESC to exit, Space / Enter to take photo)
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH') {
        setHideUI((prev) => !prev);
      } else if (e.code === 'Escape') {
        if (hideUI) {
          setHideUI(false);
        } else {
          onExit();
        }
      } else if (e.code === 'Space' && !e.repeat) {
        handleCapturePhoto();
      } else if (e.code === 'KeyR' && (e.ctrlKey || e.metaKey)) {
        // let reload pass
      } else if (e.code === 'KeyR') {
        handleResetCamera();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, hideUI, onExit, handleResetCamera]);

  // Pointer event listeners on canvas viewport for free camera movement
  const handlePointerDown = (e: React.PointerEvent) => {
    if (hideUI) {
      setHideUI(false);
      return;
    }
    isDraggingRef.current = true;
    isPanningRef.current = e.button === 2 || e.shiftKey;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !cameraController) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (isPanningRef.current) {
      cameraController.pan(-dx * 0.008, dy * 0.008);
    } else {
      cameraController.orbit(dx * 0.0055, -dy * 0.0055);
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!cameraController) return;
    cameraController.zoom(e.deltaY * 0.006);
  };

  // Sync sliders to cameraController
  const handleFovChange = (val: number) => {
    setFov(val);
    if (cameraController) cameraController.setFov(val);
  };

  const handleRollChange = (val: number) => {
    setRoll(val);
    if (cameraController) cameraController.setRoll(val);
  };

  const handleHeightChange = (val: number) => {
    setHeightOffset(val);
    if (cameraController) cameraController.setHeightOffset(val);
  };

  // Capture Screenshot Routine
  const handleCapturePhoto = () => {
    if (!rendererCanvas) return;

    // 1. Shutter sound
    if (soundManager) {
      soundManager.playShutter();
    }

    // 2. Flash visual effect
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 240);

    // 3. Export high-res PNG from WebGL canvas
    try {
      const dataUrl = rendererCanvas.toDataURL('image/png');
      setSavedThumbnail(dataUrl);

      // Trigger instant browser download
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.download = `ApexCityDrive_${timestamp}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore
    }
  };

  if (!isActive) return null;

  // Filter styles CSS based on selected preset & adjustments
  const getFilterCSS = () => {
    let base = `brightness(${exposure}) contrast(${contrast}) saturate(${saturation})`;
    if (filterPreset === 'noir') {
      base += ' grayscale(100%) contrast(1.3)';
    } else if (filterPreset === 'cinema') {
      base += ' sepia(18%) hue-rotate(-10deg) saturate(1.25)';
    } else if (filterPreset === 'golden') {
      base += ' sepia(35%) saturate(1.4) brightness(1.05)';
    } else if (filterPreset === 'chrome') {
      base += ' contrast(1.22) saturate(1.35)';
    } else if (filterPreset === 'cyber') {
      base += ' hue-rotate(25deg) contrast(1.28) saturate(1.6)';
    }
    return base;
  };

  return (
    <div
      className="fixed inset-0 z-40 select-none overflow-hidden touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 1. Cinematic Filter Overlay Container (Applies Color Grading, Vignette & Depth-of-Field Blur) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-300"
        style={{
          filter: getFilterCSS(),
        }}
      >
        {/* Cinematic Vignette */}
        {vignette > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(circle at center, transparent 45%, rgba(0, 0, 0, ${
                vignette / 100
              }) 100%)`,
            }}
          />
        )}

        {/* Cinematic Depth-of-Field Perimeter Lens Blur */}
        {dofAmount > 0 && (
          <div
            className="absolute inset-0 pointer-events-none backdrop-blur-[2px]"
            style={{
              maskImage: `radial-gradient(ellipse 65% 55% at center, transparent 38%, black 100%)`,
              WebkitMaskImage: `radial-gradient(ellipse 65% 55% at center, transparent 38%, black 100%)`,
              backdropFilter: `blur(${Math.round((dofAmount / 100) * 8)}px)`,
              WebkitBackdropFilter: `blur(${Math.round((dofAmount / 100) * 8)}px)`,
            }}
          />
        )}
      </div>

      {/* 2. Anamorphic Letterbox 2.39:1 Cinema Bars */}
      {letterbox && (
        <>
          <div className="absolute top-0 left-0 right-0 h-10 sm:h-14 bg-black pointer-events-none transition-all duration-300 z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-14 bg-black pointer-events-none transition-all duration-300 z-10" />
        </>
      )}

      {/* 3. Rule-of-Thirds Grid Overlay */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-12">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3 border border-white/20">
            <div className="border-r border-b border-white/15" />
            <div className="border-r border-b border-white/15" />
            <div className="border-b border-white/15" />
            <div className="border-r border-b border-white/15" />
            <div className="border-r border-b border-white/15" />
            <div className="border-b border-white/15" />
            <div className="border-r border-white/15" />
            <div className="border-r border-white/15" />
            <div />
          </div>
        </div>
      )}

      {/* 4. Camera Shutter Flash Animation */}
      {shutterFlash && (
        <div className="absolute inset-0 bg-white pointer-events-none z-50 animate-out fade-out duration-300" />
      )}

      {/* 5. Minimalist Floating Photo Mode UI */}
      {!hideUI && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-6 z-20">
          {/* Top Bar: Title + Hide UI + Reset + Exit */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-3 bg-slate-900/85 backdrop-blur-xl px-4 py-2 rounded-2xl border border-sky-400/35 shadow-[0_8px_30px_rgba(2,132,199,0.22)] pointer-events-auto">
              <Camera className="w-4 h-4 text-sky-400" />
              <span className="font-speedo text-sm font-bold text-white tracking-wider uppercase">
                PHOTO STUDIO
              </span>
              <span className="text-[10px] font-mono text-sky-200 border-l border-sky-400/30 pl-2">
                PAUSED · {gameTime}
              </span>
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Hide UI Button [H] */}
              <button
                onClick={() => setHideUI(true)}
                title="Hide Controls for Clean View [H]"
                className="px-3 py-1.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white border border-sky-400/30 flex items-center gap-1.5 shadow-lg active:scale-95 text-xs font-speedo transition-all"
              >
                <EyeOff className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Clean View</span>
                <span className="text-[10px] text-sky-300 font-mono">[H]</span>
              </button>

              {/* Reset Camera Button [R] */}
              <button
                onClick={handleResetCamera}
                title="Reset Camera [R]"
                className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white border border-sky-400/30 flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <RotateCcw className="w-4 h-4 text-sky-400" />
              </button>

              {/* Exit Photo Mode [ESC] */}
              <button
                onClick={onExit}
                title="Exit Photo Mode [ESC]"
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 shadow-lg active:scale-95 text-xs font-bold font-speedo transition-all border border-rose-400/40"
              >
                <X className="w-4 h-4" />
                <span>Exit</span>
              </button>
            </div>
          </div>

          {/* Center Hint for Clean Screen */}
          <div className="self-center text-center opacity-75 hover:opacity-100 transition-opacity">
            <span className="text-[11px] font-mono text-sky-100 bg-slate-900/75 backdrop-blur-md px-3.5 py-1.2 rounded-full border border-sky-400/30 shadow-lg">
              Drag to Orbit · Right-drag or Shift to Pan · Wheel to Zoom · [H] to Hide UI
            </span>
          </div>

          {/* Bottom Bar: Tabbed Controls Toolbar + Shutter Button */}
          <div className="w-full max-w-3xl mx-auto flex flex-col gap-3 pointer-events-auto">
            {/* Controls Palette Card */}
            <div className="bg-slate-900/85 backdrop-blur-xl rounded-2xl border border-sky-400/30 p-4 shadow-[0_12px_40px_rgba(2,132,199,0.25)] flex flex-col gap-3">
              {/* Tabs Switcher */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab('lens')}
                    className={`px-3 py-1 rounded-lg text-xs font-speedo font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'lens'
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Lens &amp; Focus
                  </button>
                  <button
                    onClick={() => setActiveTab('filter')}
                    className={`px-3 py-1 rounded-lg text-xs font-speedo font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'filter'
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Color Grade
                  </button>
                  <button
                    onClick={() => setActiveTab('frame')}
                    className={`px-3 py-1 rounded-lg text-xs font-speedo font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'frame'
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    Framing
                  </button>
                </div>

                {/* Shutter Capture Button */}
                <button
                  onClick={handleCapturePhoto}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white font-speedo font-black text-xs sm:text-sm tracking-wide shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center gap-2 active:scale-95 transition-all"
                  title="Take Screenshot [SPACE]"
                >
                  <Camera className="w-4 h-4 fill-white" />
                  <span>TAKE PHOTO</span>
                </button>
              </div>

              {/* Tab 1: Lens & Depth of Field */}
              {activeTab === 'lens' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
                  {/* FOV / Focal Length */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                      <span>FOCAL LENGTH / FOV</span>
                      <span className="font-bold text-sky-400">{fov}°</span>
                    </div>
                    <input
                      type="range"
                      min={22}
                      max={85}
                      value={fov}
                      onChange={(e) => handleFovChange(Number(e.target.value))}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Wide 22°</span>
                      <span>Telephoto 85°</span>
                    </div>
                  </div>

                  {/* Depth-of-Field Aperture Blur */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                      <span>DEPTH-OF-FIELD (BLUR)</span>
                      <span className="font-bold text-sky-400">{dofAmount}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={dofAmount}
                      onChange={(e) => setDofAmount(Number(e.target.value))}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>Sharp f/16</span>
                      <span>Cinematic Bokeh f/1.4</span>
                    </div>
                  </div>

                  {/* Camera Tilt / Roll */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                      <span>CAMERA ROLL / TILT</span>
                      <span className="font-bold text-sky-400">{roll}°</span>
                    </div>
                    <input
                      type="range"
                      min={-25}
                      max={25}
                      value={roll}
                      onChange={(e) => handleRollChange(Number(e.target.value))}
                      className="w-full accent-sky-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400">
                      <span>-25° Dutch</span>
                      <span>Level</span>
                      <span>+25°</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Color Grading & Filters */}
              {activeTab === 'filter' && (
                <div className="flex flex-col gap-3 pt-1">
                  {/* Preset Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                    {(
                      [
                        { id: 'none', label: 'Natural' },
                        { id: 'daylight', label: 'Vibrant Sun' },
                        { id: 'cinema', label: 'Teal & Orange' },
                        { id: 'golden', label: 'Golden Hour' },
                        { id: 'chrome', label: 'Kodak Portra' },
                        { id: 'noir', label: 'B&W Noir' },
                        { id: 'cyber', label: 'Cyberpunk' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setFilterPreset(p.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                          filterPreset === p.id
                            ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Sliders for Exposure, Contrast, Vignette */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                        <span>EXPOSURE</span>
                        <span className="font-bold text-amber-400">{exposure.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.6}
                        max={1.6}
                        step={0.05}
                        value={exposure}
                        onChange={(e) => setExposure(Number(e.target.value))}
                        className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                        <span>CONTRAST</span>
                        <span className="font-bold text-amber-400">{contrast.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.8}
                        max={1.4}
                        step={0.04}
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-slate-300 font-mono text-[11px]">
                        <span>VIGNETTE</span>
                        <span className="font-bold text-amber-400">{vignette}%</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={80}
                        value={vignette}
                        onChange={(e) => setVignette(Number(e.target.value))}
                        className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Framing & Cinema Bars */}
              {activeTab === 'frame' && (
                <div className="flex items-center gap-6 pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-mono">
                    <input
                      type="checkbox"
                      checked={letterbox}
                      onChange={(e) => setLetterbox(e.target.checked)}
                      className="w-4 h-4 rounded accent-sky-400 bg-slate-800"
                    />
                    <span>2.39:1 Anamorphic Cinema Bars</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-mono">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="w-4 h-4 rounded accent-sky-400 bg-slate-800"
                    />
                    <span>Rule-of-Thirds Grid</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clean Screen Reminder when UI is hidden */}
      {hideUI && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-30">
          <span className="text-xs font-mono text-white/80 bg-slate-950/70 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 shadow-xl animate-fade-in">
            Clean View Mode · Click or press [H] to restore controls
          </span>
        </div>
      )}

      {/* Captured Photo Toast Thumbnail */}
      {savedThumbnail && (
        <div className="absolute bottom-6 left-6 z-50 pointer-events-auto bg-slate-900 border border-emerald-400/50 p-2.5 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <img
            src={savedThumbnail}
            alt="Captured Screenshot"
            className="w-16 h-10 object-cover rounded-lg border border-white/20"
          />
          <div className="flex flex-col">
            <span className="text-xs font-speedo font-bold text-emerald-400">
              PHOTO CAPTURED!
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Saved to Downloads
            </span>
          </div>
          <button
            onClick={() => setSavedThumbnail(null)}
            className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

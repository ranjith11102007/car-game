import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TrafficManager } from '../game/TrafficManager';
import { CITY_CONFIG } from '../constants';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, Compass, Navigation } from 'lucide-react';

export interface MiniMapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  trafficManager: TrafficManager | null;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  checkpoints?: { x: number; z: number }[];
  currentCheckpointIdx?: number;
}

export const MiniMap: React.FC<MiniMapProps> = ({
  playerX,
  playerZ,
  playerHeading,
  trafficManager,
  className = '',
  isExpanded: controlledExpanded,
  onToggleExpand: controlledToggleExpand,
  checkpoints,
  currentCheckpointIdx = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<'close' | 'medium' | 'city'>('close');
  const [orientMode, setOrientMode] = useState<'track-up' | 'north-up'>('track-up');

  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;
  const toggleExpand = useCallback(() => {
    if (controlledToggleExpand) {
      controlledToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  }, [controlledToggleExpand]);

  // Key shortcut 'M' to toggle map expand
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && !e.repeat) {
        toggleExpand();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleExpand]);

  // Canvas drawing routine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Scale definition based on zoom
    // close: 0.55 px/m (~140m view)
    // medium: 0.28 px/m (~280m view)
    // city: 0.12 px/m (~650m full city view)
    let scale = 0.5;
    if (zoomLevel === 'medium') scale = 0.26;
    if (zoomLevel === 'city') scale = isExpanded ? 0.16 : 0.13;

    // View radius
    const maxRadius = Math.min(width, height) / 2 - (isExpanded ? 16 : 4);

    // 1. Clear background
    ctx.clearRect(0, 0, width, height);

    ctx.save();

    // In compact mode, clip to smooth rounded circle; in expanded modal, clip to rounded rectangle
    ctx.beginPath();
    if (!isExpanded) {
      ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    } else {
      const pad = 12;
      ctx.roundRect(pad, pad, width - pad * 2, height - pad * 2, 24);
    }
    ctx.clip();

    // Map base background (Obsidian dark ground)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Subtle tactical coordinate grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Camera Transform
    ctx.save();
    ctx.translate(centerX, centerY);

    // If track-up mode: rotate world opposite to player heading so player always faces forward (UP)
    if (orientMode === 'track-up') {
      ctx.rotate(playerHeading);
    }

    const step = CITY_CONFIG.BLOCK_SIZE;
    const half = CITY_CONFIG.GRID_HALF_EXTENT;
    const roadW = CITY_CONFIG.ROAD_WIDTH * scale;
    const sidewalkW = CITY_CONFIG.SIDEWALK_WIDTH * scale;
    const totalSpan = (half * 2 + 1) * step * scale;

    // 3. Draw Building Blocks (Footprints)
    ctx.fillStyle = '#161e2e'; // Building block fill
    ctx.strokeStyle = '#233047'; // Building block perimeter
    ctx.lineWidth = 1.2;

    for (let ix = -half; ix < half; ix++) {
      for (let iz = -half; iz < half; iz++) {
        const blockX = (ix * step + step / 2 - playerX) * scale;
        const blockZ = (iz * step + step / 2 - playerZ) * scale;
        const rawBlockSize = step - (CITY_CONFIG.ROAD_WIDTH + CITY_CONFIG.SIDEWALK_WIDTH * 2 + 4);
        const bSize = rawBlockSize * scale;

        // Skip if outside viewport bounds
        if (Math.abs(blockX) > width * 0.75 || Math.abs(blockZ) > height * 0.75) continue;

        // Special center plaza
        if (ix === 0 && iz === 0) {
          // Civic Plaza with central green/park
          ctx.fillStyle = '#142820'; // Soft dark moss
          ctx.strokeStyle = '#274b3d';
          ctx.fillRect(blockX - bSize / 2, blockZ - bSize / 2, bSize, bSize);
          ctx.strokeRect(blockX - bSize / 2, blockZ - bSize / 2, bSize, bSize);

          // Fountain water circle
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(blockX, blockZ, 6 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Reset fill for standard buildings
          ctx.fillStyle = '#161e2e';
          ctx.strokeStyle = '#233047';
        } else {
          // Standard building block
          ctx.fillRect(blockX - bSize / 2, blockZ - bSize / 2, bSize, bSize);
          ctx.strokeRect(blockX - bSize / 2, blockZ - bSize / 2, bSize, bSize);

          // Internal architectural footprint subdivisions
          const subW = bSize * 0.42;
          ctx.fillStyle = '#1c263a';
          ctx.fillRect(blockX - bSize / 2 + 2, blockZ - bSize / 2 + 2, subW, subW);
          ctx.fillRect(blockX + bSize / 2 - subW - 2, blockZ + bSize / 2 - subW - 2, subW, subW);
          ctx.fillStyle = '#161e2e';
        }
      }
    }

    // 4. Draw Sidewalk Curbs
    ctx.fillStyle = '#222b3a';
    for (let i = -half; i <= half; i++) {
      const rz = (i * step - playerZ) * scale;
      if (Math.abs(rz) < height * 0.8) {
        ctx.fillRect(-totalSpan / 2, rz - roadW / 2 - sidewalkW, totalSpan, roadW + sidewalkW * 2);
      }
      const rx = (i * step - playerX) * scale;
      if (Math.abs(rx) < width * 0.8) {
        ctx.fillRect(rx - roadW / 2 - sidewalkW, -totalSpan / 2, roadW + sidewalkW * 2, totalSpan);
      }
    }

    // 5. Draw Road Asphalt Surface
    ctx.fillStyle = '#2d3748'; // Asphalt dark grey

    // East-West Roads
    for (let i = -half; i <= half; i++) {
      const rz = (i * step - playerZ) * scale;
      if (Math.abs(rz) < height * 0.8) {
        ctx.fillRect(-totalSpan / 2, rz - roadW / 2, totalSpan, roadW);
      }
    }

    // North-South Roads
    for (let i = -half; i <= half; i++) {
      const rx = (i * step - playerX) * scale;
      if (Math.abs(rx) < width * 0.8) {
        ctx.fillRect(rx - roadW / 2, -totalSpan / 2, roadW, totalSpan);
      }
    }

    // 6. Elevated Highway Overpass (Bridge Corridor at Z = 120m)
    const overpassZ = (step * 1 - playerZ) * scale;
    const overpassSpan = (step * 5) * scale;
    const overpassW = 16 * scale;
    if (Math.abs(overpassZ) < height * 0.8) {
      // Bridge Deck Shadow & Outline
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(-overpassSpan / 2, overpassZ - overpassW / 2 + 3, overpassSpan, overpassW);

      ctx.fillStyle = '#374151'; // Distinct steel bridge deck
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-overpassSpan / 2, overpassZ - overpassW / 2, overpassSpan, overpassW);
      ctx.strokeRect(-overpassSpan / 2, overpassZ - overpassW / 2, overpassSpan, overpassW);
    }

    // 7. Road Markings (Yellow Double Centerlines & White Dashed Lanes)
    // Double Yellow Centerlines along X roads
    ctx.strokeStyle = '#f59e0b'; // Amber yellow
    ctx.lineWidth = 1.2;
    for (let i = -half; i <= half; i++) {
      const rz = (i * step - playerZ) * scale;
      if (Math.abs(rz) < height * 0.8) {
        ctx.beginPath();
        ctx.moveTo(-totalSpan / 2, rz);
        ctx.lineTo(totalSpan / 2, rz);
        ctx.stroke();
      }
    }

    // Double Yellow Centerlines along Z roads
    for (let i = -half; i <= half; i++) {
      const rx = (i * step - playerX) * scale;
      if (Math.abs(rx) < width * 0.8) {
        ctx.beginPath();
        ctx.moveTo(rx, -totalSpan / 2);
        ctx.lineTo(rx, totalSpan / 2);
        ctx.stroke();
      }
    }

    // Dashed White Lane Lines (drawn when zoomed in close or medium)
    if (zoomLevel !== 'city') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([4 * scale * 2, 4 * scale * 2]);

      for (let i = -half; i <= half; i++) {
        const rz = (i * step - playerZ) * scale;
        if (Math.abs(rz) < height * 0.8) {
          ctx.beginPath();
          ctx.moveTo(-totalSpan / 2, rz - roadW * 0.25);
          ctx.lineTo(totalSpan / 2, rz - roadW * 0.25);
          ctx.moveTo(-totalSpan / 2, rz + roadW * 0.25);
          ctx.lineTo(totalSpan / 2, rz + roadW * 0.25);
          ctx.stroke();
        }

        const rx = (i * step - playerX) * scale;
        if (Math.abs(rx) < width * 0.8) {
          ctx.beginPath();
          ctx.moveTo(rx - roadW * 0.25, -totalSpan / 2);
          ctx.lineTo(rx - roadW * 0.25, totalSpan / 2);
          ctx.moveTo(rx + roadW * 0.25, -totalSpan / 2);
          ctx.lineTo(rx + roadW * 0.25, totalSpan / 2);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]); // Reset dash
    }

    // 7b. Draw Race Checkpoints & Route Line (Phase 25 & 26)
    if (checkpoints && checkpoints.length > 0) {
      // Connecting dashed cyan route line
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6 * scale * 2, 4 * scale * 2]);
      ctx.beginPath();
      for (let c = Math.max(0, currentCheckpointIdx); c < checkpoints.length; c++) {
        const cp = checkpoints[c];
        const cX = (cp.x - playerX) * scale;
        const cZ = (cp.z - playerZ) * scale;
        if (c === Math.max(0, currentCheckpointIdx)) {
          ctx.moveTo(cX, cZ);
        } else {
          ctx.lineTo(cX, cZ);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw checkpoint rings
      for (let c = 0; c < checkpoints.length; c++) {
        if (c < currentCheckpointIdx) continue; // Passed checkpoints
        const cp = checkpoints[c];
        const cX = (cp.x - playerX) * scale;
        const cZ = (cp.z - playerZ) * scale;
        const isCurrent = c === currentCheckpointIdx;
        const isFinish = c === checkpoints.length - 1;

        ctx.save();
        ctx.translate(cX, cZ);

        if (isCurrent) {
          // Pulsing glow for target checkpoint
          ctx.fillStyle = isFinish ? '#ffcc00' : '#00f0ff';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Outer pulse ring
          ctx.beginPath();
          ctx.arc(0, 0, 9.5, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = isFinish ? 'rgba(255, 204, 0, 0.6)' : 'rgba(0, 240, 255, 0.5)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.arc(0, 0, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      ctx.restore();
    }

    // 8. Draw Traffic AI Vehicles
    if (trafficManager && trafficManager.cars.length > 0) {
      for (const car of trafficManager.cars) {
        const carX = (car.pos.x - playerX) * scale;
        const carZ = (car.pos.z - playerZ) * scale;

        // Clip to render zone
        if (Math.abs(carX) > width * 0.6 || Math.abs(carZ) > height * 0.6) continue;

        ctx.save();
        ctx.translate(carX, carZ);

        // Traffic car blip (amber / white with directional indicator)
        ctx.fillStyle = car.color ? `#${car.color.toString(16).padStart(6, '0')}` : '#f59e0b';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    }

    // 9. Draw Player Vehicle Marker in Center
    ctx.save();
    // In track-up, the player marker always points straight UP (0 angle)
    // In north-up, the player marker rotates by playerHeading
    if (orientMode === 'north-up') {
      ctx.rotate(-playerHeading);
    }

    // Subtle radar scan pulse ring around player
    const pulseTime = (Date.now() % 2000) / 2000;
    const pulseRadius = 8 + pulseTime * 18;
    ctx.strokeStyle = `rgba(56, 189, 248, ${0.7 * (1 - pulseTime)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // High-precision aerodynamic player vehicle arrow
    ctx.fillStyle = '#0284c7'; // Electric Cyan
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(0, -11); // Tip
    ctx.lineTo(6.5, 7.5);
    ctx.lineTo(0, 4);
    ctx.lineTo(-6.5, 7.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vehicle headlight cone preview
    const fovAngle = Math.PI / 5;
    const lightDist = 28 * scale;
    const grad = ctx.createRadialGradient(0, -6, 2, 0, -6 - lightDist, lightDist);
    grad.addColorStop(0, 'rgba(253, 224, 71, 0.45)');
    grad.addColorStop(1, 'rgba(253, 224, 71, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.arc(0, -8, lightDist, -Math.PI / 2 - fovAngle, -Math.PI / 2 + fovAngle);
    ctx.closePath();
    ctx.fill();

    ctx.restore(); // Restore player rotation

    ctx.restore(); // Restore camera translation & orientMode rotation

    // 10. Outer Framing & Radar HUD Overlay
    if (!isExpanded) {
      // Compact Radar Glass Rings & Compass Bezel
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Range ticks (crosshairs)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - maxRadius, centerY);
      ctx.lineTo(centerX - maxRadius + 8, centerY);
      ctx.moveTo(centerX + maxRadius - 8, centerY);
      ctx.lineTo(centerX + maxRadius, centerY);
      ctx.moveTo(centerX, centerY - maxRadius);
      ctx.lineTo(centerX, centerY - maxRadius + 8);
      ctx.moveTo(centerX, centerY + maxRadius - 8);
      ctx.lineTo(centerX, centerY + maxRadius);
      ctx.stroke();

      // North Indicator 'N' on Bezel
      // If track-up, North marker rotates around the circle
      // If north-up, North is always at top
      const northAngle = orientMode === 'track-up' ? -playerHeading - Math.PI / 2 : -Math.PI / 2;
      const nx = centerX + Math.cos(northAngle) * (maxRadius - 10);
      const ny = centerY + Math.sin(northAngle) * (maxRadius - 10);

      ctx.fillStyle = '#ef4444'; // Red North
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', nx, ny);
    } else {
      // Expanded Map Cardinal Compass Labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NORTH', width / 2, 28);
      ctx.fillText('SOUTH', width / 2, height - 20);
      ctx.textAlign = 'left';
      ctx.fillText('WEST', 24, height / 2);
      ctx.textAlign = 'right';
      ctx.fillText('EAST', width - 24, height / 2);
    }

    ctx.restore(); // Restore clip
  }, [playerX, playerZ, playerHeading, trafficManager, isExpanded, zoomLevel, orientMode]);

  // Dimensions
  const canvasWidth = isExpanded ? 520 : 160;
  const canvasHeight = isExpanded ? 460 : 160;

  return (
    <>
      {/* 1. Main Corner MiniMap (Always visible in HUD) */}
      <div
        className={`group relative select-none touch-none transition-all duration-300 ${
          isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${className}`}
      >
        <div className="relative rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.65)] backdrop-blur-lg border border-white/15 bg-slate-950/80 p-0.5 overflow-hidden">
          <canvas
            ref={canvasRef}
            width={canvasWidth}
            height={canvasHeight}
            className="w-[155px] h-[155px] sm:w-[165px] sm:h-[165px] rounded-full cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={toggleExpand}
            title="Click to Expand Full City Map [M]"
          />

          {/* Quick HUD Overlay Controls */}
          <div className="absolute bottom-1 right-1 flex items-center gap-1 z-10 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand();
              }}
              className="p-1.5 rounded-full bg-slate-900/90 hover:bg-sky-600 text-slate-300 hover:text-white border border-white/10 transition-colors shadow-md"
              title="Expand City Map [M]"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Toggle Pill */}
          <div className="absolute top-1 left-1 flex items-center gap-0.5 z-10 opacity-75 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setZoomLevel((prev) => (prev === 'close' ? 'medium' : prev === 'medium' ? 'city' : 'close'));
              }}
              className="px-1.5 py-0.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-[9px] font-mono text-sky-400 border border-white/10 shadow-md uppercase tracking-wider"
              title="Cycle Zoom Level"
            >
              {zoomLevel}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Expanded Tactical City Map Overlay Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in pointer-events-auto select-none">
          <div className="relative w-full max-w-2xl bg-slate-900/95 border border-white/15 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-400/20 text-sky-400">
                  <Compass className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="font-speedo text-lg font-bold text-white tracking-wide flex items-center gap-2">
                    City Tactical Radar
                    <span className="text-xs font-mono font-normal text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                      LIVE GPS
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                    <span>
                      POS: {Math.round(playerX)}m X, {Math.round(playerZ)}m Z
                    </span>
                    <span>·</span>
                    <span>HEAD: {Math.round((((playerHeading * 180) / Math.PI + 360) % 360))}°</span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={toggleExpand}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors shadow-lg"
                title="Minimize Map [ESC or M]"
              >
                <Minimize2 className="w-5 h-5" />
              </button>
            </div>

            {/* Tactical Map Canvas */}
            <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-2xl border border-white/10 overflow-hidden shadow-inner flex items-center justify-center">
              <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="w-full h-full object-contain" />

              {/* Map Controls Floating Bar */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-white/10 p-1.5 rounded-xl shadow-lg">
                {/* Zoom In */}
                <button
                  onClick={() => setZoomLevel((prev) => (prev === 'city' ? 'medium' : 'close'))}
                  className={`p-2 rounded-lg transition-colors ${
                    zoomLevel === 'close'
                      ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                  disabled={zoomLevel === 'close'}
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                {/* Zoom Out */}
                <button
                  onClick={() => setZoomLevel((prev) => (prev === 'close' ? 'medium' : 'city'))}
                  className={`p-2 rounded-lg transition-colors ${
                    zoomLevel === 'city'
                      ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                      : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                  }`}
                  disabled={zoomLevel === 'city'}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-white/10" />

                {/* Orientation Toggle */}
                <button
                  onClick={() => setOrientMode((prev) => (prev === 'track-up' ? 'north-up' : 'track-up'))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors ${
                    orientMode === 'track-up'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                  }`}
                  title="Toggle Track-Up / North-Up"
                >
                  <Navigation className={`w-3.5 h-3.5 ${orientMode === 'track-up' ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span className="uppercase text-[11px]">{orientMode}</span>
                </button>
              </div>

              {/* Map Legend */}
              <div className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur-md border border-white/10 px-3 py-2 rounded-xl text-[10px] font-mono text-slate-300 flex flex-col gap-1 shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                  <span>Player Vehicle</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>Traffic AI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1 bg-amber-400 rounded-sm" />
                  <span>Avenues & Roads</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-1.5 bg-gray-500 border border-gray-400 rounded-sm" />
                  <span>Elevated Overpass</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Press [M] or [ESC] to return to driving view</span>
              <button
                onClick={toggleExpand}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors shadow-md text-xs"
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Also export alias Minimap for drop-in backward compatibility
export const Minimap = MiniMap;
export default MiniMap;

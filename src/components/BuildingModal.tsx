import React from 'react';
import { CityLandmark, CityTheme } from '../types';
import { CITY_LANDMARKS } from '../constants';
import {
  X,
  Building2,
  MapPin,
  Sparkles,
  Navigation,
  Compass,
  Zap,
  Waves,
  Coffee,
  Rocket,
  Check,
} from 'lucide-react';

interface BuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerPos: { x: number; y: number; z: number };
  currentTheme: CityTheme;
  onChangeTheme: (theme: CityTheme) => void;
  onTeleport: (landmark: CityLandmark) => void;
  neonBillboardsOn: boolean;
  onToggleNeonBillboards: () => void;
  streetLightPoolsOn: boolean;
  onToggleStreetLightPools: () => void;
}

export const BuildingModal: React.FC<BuildingModalProps> = ({
  isOpen,
  onClose,
  playerPos,
  currentTheme,
  onChangeTheme,
  onTeleport,
  neonBillboardsOn,
  onToggleNeonBillboards,
  streetLightPoolsOn,
  onToggleStreetLightPools,
}) => {
  if (!isOpen) return null;

  const themes: { id: CityTheme; name: string; tag: string; color: string }[] = [
    { id: 'metropolis', name: 'Metropolis', tag: 'Crisp Daylight & Realistic Sky', color: 'from-blue-600 to-sky-500' },
    { id: 'cyberpunk', name: 'Cyberpunk 2077', tag: 'Neon Violet & Cyan Night Glow', color: 'from-purple-600 to-pink-500' },
    { id: 'sunset', name: 'Miami Sunset', tag: 'Golden Hour & Warm Coastal Glow', color: 'from-amber-600 to-rose-500' },
    { id: 'tokyo', name: 'Tokyo Rain Drift', tag: 'Wet Asphalt Puddle Reflections', color: 'from-cyan-600 to-blue-600' },
    { id: 'noir', name: 'Film Noir', tag: 'High-Contrast Moody Monochrome', color: 'from-slate-700 to-slate-900' },
  ];

  const getLandmarkIcon = (type: string) => {
    switch (type) {
      case 'skyscraper':
        return <Building2 className="w-5 h-5 text-sky-400" />;
      case 'plaza':
        return <Zap className="w-5 h-5 text-purple-400" />;
      case 'resort':
        return <Waves className="w-5 h-5 text-emerald-400" />;
      case 'station':
        return <Coffee className="w-5 h-5 text-amber-400" />;
      case 'stunt':
        return <Rocket className="w-5 h-5 text-rose-400" />;
      default:
        return <MapPin className="w-5 h-5 text-sky-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4.5 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white font-speedo">
                City Architecture & Landmarks
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore iconic skyscrapers, launch stunt ramps, and configure metropolis visual themes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: City Themes & Atmosphere Filter */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                City Atmosphere & Lighting Theme
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Active: <span className="text-sky-400 font-bold capitalize">{currentTheme}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {themes.map((t) => {
                const isActive = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onChangeTheme(t.id)}
                    className={`flex flex-col text-left p-3 rounded-2xl border transition-all relative overflow-hidden ${
                      isActive
                        ? 'border-sky-400 bg-slate-800 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                        : 'border-white/10 bg-slate-800/50 hover:bg-slate-800/80 hover:border-white/20'
                    }`}
                  >
                    <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${t.color} mb-2`} />
                    <span className="text-xs font-bold text-white font-speedo">{t.name}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">{t.tag}</span>
                    {isActive && (
                      <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-sky-400 flex items-center justify-center text-slate-950">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Urban Lighting & Billboards Toggles */}
          <div className="bg-slate-950/50 border border-white/10 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-white">Urban Illumination Systems</span>
              <p className="text-[11px] text-slate-400 mt-0.5">Toggle nighttime animated rooftop billboards and street lamp road light pools</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onToggleNeonBillboards}
                className={`text-xs px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
                  neonBillboardsOn
                    ? 'bg-sky-500/20 text-sky-300 border-sky-400/50'
                    : 'bg-slate-800 text-slate-400 border-white/5'
                }`}
              >
                Neon Billboards: {neonBillboardsOn ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={onToggleStreetLightPools}
                className={`text-xs px-3.5 py-1.5 rounded-xl border font-medium transition-all ${
                  streetLightPoolsOn
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                    : 'bg-slate-800 text-slate-400 border-white/5'
                }`}
              >
                Street Light Pools: {streetLightPoolsOn ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Section 3: Landmark Directory & Fast Teleportation */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-sky-400" />
                Iconic Landmarks & Stunt Arenas ({CITY_LANDMARKS.length})
              </span>
              <span className="text-[11px] font-mono text-slate-400">Click to warp vehicle instantly</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {CITY_LANDMARKS.map((lm) => {
                const dx = playerPos.x - lm.position.x;
                const dz = playerPos.z - lm.position.z;
                const distanceMeters = Math.round(Math.sqrt(dx * dx + dz * dz));
                const isNearby = distanceMeters < 50;

                return (
                  <div
                    key={lm.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isNearby
                        ? 'bg-slate-800/90 border-sky-400/80 shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                        : 'bg-slate-800/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-slate-900 border border-white/10 shrink-0">
                            {getLandmarkIcon(lm.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-white font-speedo tracking-wide">
                                {lm.name}
                              </h3>
                              {isNearby && (
                                <span className="bg-sky-400/20 text-sky-300 border border-sky-400/40 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                                  HERE
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {lm.district} · {lm.height}m Tall
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/5">
                          {distanceMeters}m
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                        {lm.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[11px] font-medium text-slate-400 italic">
                        {lm.tagline}
                      </span>
                      <button
                        onClick={() => {
                          onTeleport(lm);
                          onClose();
                        }}
                        className="py-1.5 px-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Teleport</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-3.5 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <span>Pro Tip: Press [B] anytime while driving to open the Building & City Explorer</span>
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

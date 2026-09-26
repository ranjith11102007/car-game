import React, { useState } from 'react';
import { CarCustomization, CarModelType } from '../types';
import { CAR_MODELS } from '../constants';
import {
  X,
  Car,
  Paintbrush,
  Sparkles,
  Zap,
  Gauge,
  Sliders,
  Check,
  Disc,
  Flame,
  Volume2,
  ShieldAlert,
} from 'lucide-react';

interface CarCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customization: CarCustomization;
  onApplyCustomization: (custom: CarCustomization) => void;
  onRevEngine?: () => void;
}

export const CarCustomizerModal: React.FC<CarCustomizerModalProps> = ({
  isOpen,
  onClose,
  customization,
  onApplyCustomization,
  onRevEngine,
}) => {
  const [current, setCurrent] = useState<CarCustomization>({ ...customization });
  const [activeTab, setActiveTab] = useState<'model' | 'paint' | 'aero' | 'tuning'>('model');

  if (!isOpen) return null;

  const colorPalette = [
    { name: 'Emerald', hex: '#10b981' },
    { name: 'Crimson', hex: '#ef4444' },
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Cyan', hex: '#06b6d4' },
    { name: 'Purple', hex: '#a855f7' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Lime', hex: '#84cc16' },
    { name: 'Pink', hex: '#ec4899' },
    { name: 'Stealth Black', hex: '#090d16' },
    { name: 'Pearl White', hex: '#f8fafc' },
    { name: 'Gold', hex: '#eab308' },
    { name: 'Gunmetal', hex: '#475569' },
  ];

  const finishOptions: { id: CarCustomization['finish']; label: string }[] = [
    { id: 'metallic', label: 'Metallic Gloss' },
    { id: 'matte', label: 'Stealth Matte' },
    { id: 'chameleon', label: 'Chameleon' },
    { id: 'chrome', label: 'Chrome Mirror' },
  ];

  const underglowOptions: { id: string; label: string; color: string }[] = [
    { id: 'off', label: 'OFF', color: '#1e293b' },
    { id: '#06b6d4', label: 'Cyber Cyan', color: '#06b6d4' },
    { id: '#a855f7', label: 'Neon Purple', color: '#a855f7' },
    { id: '#ef4444', label: 'Blood Red', color: '#ef4444' },
    { id: '#10b981', label: 'Acid Lime', color: '#10b981' },
    { id: '#f59e0b', label: 'Sunset Gold', color: '#f59e0b' },
    { id: 'rainbow', label: '🌈 Rainbow Pulse', color: 'linear-gradient(90deg, red, yellow, lime, cyan, blue, magenta)' },
  ];

  const spoilerOptions: { id: CarCustomization['spoilerStyle']; label: string }[] = [
    { id: 'high_gt', label: 'High GT Carbon Wing' },
    { id: 'double_wing', label: 'Double-Decker GT' },
    { id: 'ducktail', label: 'Muscle Ducktail' },
    { id: 'none', label: 'Wingless Clean' },
  ];

  const rimColorOptions = ['#e2e8f0', '#0f172a', '#eab308', '#94a3b8', '#b45309'];
  const caliperColorOptions = ['#ef4444', '#eab308', '#06b6d4', '#10b981', '#f8fafc'];

  const tuningOptions: { id: CarCustomization['handlingPreset']; label: string; desc: string }[] = [
    { id: 'balanced', label: 'Balanced Street', desc: 'Calibrated stability, responsive grip, and everyday agility' },
    { id: 'drift', label: 'Drift King Spec', desc: 'Reduced rear grip, extended drift angles, and rapid counter-steer' },
    { id: 'grip', label: 'Track Attack Grip', desc: 'Maximum road adherence, glued cornering, and instant turn-in' },
    { id: 'drag', label: 'Drag Beast Boost', desc: 'Overclocked acceleration and higher terminal velocity' },
  ];

  const handleSelectModel = (modelId: CarModelType) => {
    const def = CAR_MODELS[modelId];
    const updated: CarCustomization = {
      ...current,
      model: modelId,
      primaryColor: def.defaultPrimary,
      secondaryColor: def.defaultSecondary,
      spoilerStyle: def.defaultSpoiler,
    };
    setCurrent(updated);
    onApplyCustomization(updated);
  };

  const handleApply = () => {
    onApplyCustomization(current);
    onClose();
  };

  const activeModelDef = CAR_MODELS[current.model];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4.5 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <Car className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white font-speedo">
                Vehicle Studio: Make Car As...
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Switch car models, customize metallic paint, liveries, neon underglow, and performance handling
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

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/20 px-6 gap-2 pt-2">
          {[
            { id: 'model', label: '1. Choose Model', icon: <Car className="w-4 h-4" /> },
            { id: 'paint', label: '2. Paint & Underglow', icon: <Paintbrush className="w-4 h-4" /> },
            { id: 'aero', label: '3. Aero & Wheels', icon: <Disc className="w-4 h-4" /> },
            { id: 'tuning', label: '4. Performance Tuning', icon: <Sliders className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-speedo text-xs sm:text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'border-sky-400 text-sky-400 bg-white/5 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 rounded-t-xl'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MODEL SELECTOR */}
          {activeTab === 'model' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Select Base Vehicle Archetype ("Make Car As...")
                </span>
                <span className="text-xs font-mono text-sky-400 font-bold">
                  Active: {activeModelDef.name}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {(Object.keys(CAR_MODELS) as CarModelType[]).map((mId) => {
                  const m = CAR_MODELS[mId];
                  const isSelected = current.model === mId;

                  return (
                    <div
                      key={mId}
                      onClick={() => handleSelectModel(mId)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between gap-3 relative ${
                        isSelected
                          ? 'bg-slate-800 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                          : 'bg-slate-800/40 border-white/10 hover:border-white/20 hover:bg-slate-800/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                            {m.category} · {m.drivetrain}
                          </span>
                          {isSelected && (
                            <span className="bg-sky-400 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-white font-speedo mt-1">
                          {m.name}
                        </h3>
                        <p className="text-xs text-sky-300 font-mono mt-0.5">{m.tagline}</p>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          {m.description}
                        </p>
                      </div>

                      {/* Stat Bars */}
                      <div className="space-y-1.5 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                          <span>TOP SPEED</span>
                          <span className="font-bold text-white">{m.topSpeedKmh} KM/H</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${(m.topSpeedKmh / 370) * 100}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                          <span>ACCELERATION</span>
                          <span className="font-bold text-white">{m.accelRating} / 10</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${m.accelRating * 10}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                          <span>DRIFT CAPABILITY</span>
                          <span className="font-bold text-white">{m.driftRating} / 10</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${m.driftRating * 10}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PAINT & UNDERGLOW */}
          {activeTab === 'paint' && (
            <div className="space-y-6">
              {/* Primary Color Palette */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                  Primary Body Paint Color
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {colorPalette.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        const updated = { ...current, primaryColor: c.hex };
                        setCurrent(updated);
                        onApplyCustomization(updated);
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        current.primaryColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-sky-400 bg-slate-800'
                          : 'border-white/10 bg-slate-800/40 hover:bg-slate-800'
                      }`}
                    >
                      <div
                        className="w-5 h-5 rounded-lg border border-white/20 shrink-0 shadow-sm"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-xs text-white truncate font-medium">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paint Finish */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                  Paint Surface Finish
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {finishOptions.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        const updated = { ...current, finish: f.id };
                        setCurrent(updated);
                        onApplyCustomization(updated);
                      }}
                      className={`p-3 rounded-xl border text-center font-speedo text-xs font-bold transition-all ${
                        current.finish === f.id
                          ? 'border-sky-400 bg-sky-500/20 text-sky-300'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Secondary Accent & Livery Color */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                  Secondary Accent & Livery Stripes Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorPalette.slice(0, 8).map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => {
                        const updated = { ...current, secondaryColor: c.hex };
                        setCurrent(updated);
                        onApplyCustomization(updated);
                      }}
                      className={`w-9 h-9 rounded-xl border-2 transition-all flex items-center justify-center ${
                        current.secondaryColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-white/10 opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {current.secondaryColor.toLowerCase() === c.hex.toLowerCase() && (
                        <Check className="w-4 h-4 text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Neon Underglow */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  Ground Projecting Neon Underglow
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {underglowOptions.map((u) => {
                    const isSelected = current.underglowColor === u.id;
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          const updated = { ...current, underglowColor: u.id };
                          setCurrent(updated);
                          onApplyCustomization(updated);
                        }}
                        className={`p-2.5 rounded-xl border text-center text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-sky-400 bg-slate-800 text-white shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                            : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div
                          className="w-full h-2 rounded-full mb-1.5"
                          style={{
                            background: u.color,
                          }}
                        />
                        <span className="truncate block">{u.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AERO & WHEELS */}
          {activeTab === 'aero' && (
            <div className="space-y-6">
              {/* Spoilers & Wings */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                  Rear Downforce Aero & Spoilers
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {spoilerOptions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        const updated = { ...current, spoilerStyle: s.id };
                        setCurrent(updated);
                        onApplyCustomization(updated);
                      }}
                      className={`p-3.5 rounded-xl border text-center font-speedo text-xs font-bold transition-all ${
                        current.spoilerStyle === s.id
                          ? 'border-sky-400 bg-sky-500/20 text-sky-300 shadow-md'
                          : 'border-white/10 bg-slate-800/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rims & Calipers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Rim Finish */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/10">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                    Wheel Rim Finish
                  </label>
                  <div className="flex gap-2">
                    {rimColorOptions.map((col) => (
                      <button
                        key={col}
                        onClick={() => {
                          const updated = { ...current, rimColor: col };
                          setCurrent(updated);
                          onApplyCustomization(updated);
                        }}
                        className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${
                          current.rimColor === col
                            ? 'border-white scale-110 shadow-lg'
                            : 'border-white/20 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: col }}
                      >
                        {current.rimColor === col && <Check className="w-4 h-4 text-sky-400 drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Brake Calipers */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-white/10">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                    Brembo-Style Brake Caliper Color
                  </label>
                  <div className="flex gap-2">
                    {caliperColorOptions.map((col) => (
                      <button
                        key={col}
                        onClick={() => {
                          const updated = { ...current, caliperColor: col };
                          setCurrent(updated);
                          onApplyCustomization(updated);
                        }}
                        className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${
                          current.caliperColor === col
                            ? 'border-white scale-110 shadow-lg'
                            : 'border-white/20 opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: col }}
                      >
                        {current.caliperColor === col && <Check className="w-4 h-4 text-white drop-shadow" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PERFORMANCE TUNING */}
          {activeTab === 'tuning' && (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2.5">
                  Handling & Transmission Physics Calibration
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tuningOptions.map((t) => {
                    const isSelected = current.handlingPreset === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          const updated = { ...current, handlingPreset: t.id };
                          setCurrent(updated);
                          onApplyCustomization(updated);
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-slate-800 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-800/40 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-white font-speedo">{t.label}</h4>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-sky-400 flex items-center justify-center text-slate-950">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sound & Vitals Actions */}
              {onRevEngine && (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white">Engine Acoustics Soundcheck</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">Test real-time synthesized exhaust rumble</p>
                  </div>
                  <button
                    onClick={onRevEngine}
                    className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-2 transition-colors border border-white/10"
                  >
                    <Volume2 className="w-4 h-4 text-sky-400" />
                    <span>Rev Throttle</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-6 py-4 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Model:</span>
            <span className="text-xs font-bold text-white font-speedo">{activeModelDef.name}</span>
            <span className="text-slate-600">·</span>
            <span className="text-xs font-mono text-sky-400 uppercase">{current.handlingPreset}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="py-2.5 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg active:scale-95 font-speedo tracking-wide"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Apply to Car</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { MISSIONS, MissionDefinition, MissionState } from '../game/MissionManager';
import { Flag, Trophy, Timer, Zap, X, Play, RotateCcw } from 'lucide-react';

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionState: MissionState;
  onStartMission: (missionId: string) => void;
  onCancelMission: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  isOpen,
  onClose,
  missionState,
  onStartMission,
  onCancelMission,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/20 rounded-2xl shadow-2xl p-5 sm:p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg">
              <Flag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-speedo text-xl font-bold text-white tracking-wide">
                CITY MISSIONS & RACES
              </h2>
              <p className="text-xs text-slate-400">
                Complete street challenges to earn cash and unlock achievements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Mission Banner if running */}
        {missionState.active && missionState.mission && (
          <div className="mt-4 p-3 rounded-xl bg-sky-950/60 border border-sky-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                  ACTIVE MISSION: {missionState.mission.title}
                </span>
                <div className="text-xs text-slate-200">
                  Time Remaining: <span className="font-mono font-bold text-white">{Math.ceil(missionState.timeRemainingSec)}s</span>
                  {missionState.mission.checkpoints && (
                    <span className="ml-3">
                      Checkpoint: {missionState.currentCheckpointIdx + 1} / {missionState.mission.checkpoints.length}
                    </span>
                  )}
                  {missionState.mission.type === 'drift_challenge' && (
                    <span className="ml-3">
                      Score: {missionState.currentScore} / {missionState.mission.targetScore}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onCancelMission();
              }}
              className="px-3 py-1 rounded-lg bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold font-speedo flex items-center gap-1 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Abandon
            </button>
          </div>
        )}

        {/* Mission Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-4 overflow-y-auto pr-1">
          {MISSIONS.map((m) => {
            const isCurrent = missionState.mission?.id === m.id && missionState.active;

            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-sky-950/40 border-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.3)]'
                    : 'bg-slate-800/70 hover:bg-slate-800 border-white/10 hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md font-bold bg-white/10 text-slate-300">
                      {m.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      +${m.rewardCash.toLocaleString()}
                    </span>
                  </div>

                  <h3 className="font-speedo text-base font-bold text-white">{m.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.description}</p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
                  <div className="flex items-center gap-1.5 text-slate-300 text-xs font-mono">
                    <Timer className="w-3.5 h-3.5 text-slate-400" />
                    <span>{m.timeLimitSec}s</span>
                    {m.targetScore && <span className="ml-1 text-amber-400 font-bold">{m.targetScore} pts</span>}
                    {m.checkpoints && <span className="ml-1 text-sky-400 font-bold">{m.checkpoints.length} CPs</span>}
                  </div>

                  <button
                    onClick={() => {
                      onStartMission(m.id);
                      onClose();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold font-speedo flex items-center gap-1.5 transition-all active:scale-95 ${
                      isCurrent
                        ? 'bg-emerald-600 text-white cursor-default'
                        : 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-md'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {isCurrent ? 'Running' : 'Start'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

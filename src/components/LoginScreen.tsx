import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Eye,
  Lock,
  ArrowRight,
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Delete,
  Target,
  Trophy,
  DollarSign,
  HelpCircle,
} from 'lucide-react';
import { UserRole, ActiveAdminSessionInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { verifyPlayerPin } from '../utils/authHelper';

interface LoginScreenProps {
  onSuccess?: (role: UserRole) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccess }) => {
  const { setRole, loginAsAdmin } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>('player');
  const [pinInput, setPinInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [showHint, setShowHint] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [conflictSession, setConflictSession] = useState<ActiveAdminSessionInfo | null>(null);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setPinInput('');
    setErrorMsg(null);
    setConflictSession(null);
  };

  const handleKeyClick = (val: string) => {
    if (pinInput.length < 8) {
      const next = pinInput + val;
      setPinInput(next);
      setErrorMsg(null);
    }
  };

  const handleDeleteKey = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClearKey = () => {
    setPinInput('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setConflictSession(null);

    if (selectedRole === 'admin') {
      if (!pinInput.trim()) {
        setErrorMsg('Please enter the 4-digit Admin security code.');
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await loginAsAdmin(pinInput, false);
        setIsSubmitting(false);
        if (result.success) {
          setIsSuccess(true);
          setTimeout(() => {
            onSuccess?.('admin');
          }, 400);
        } else if (result.sessionConflict && result.activeSession) {
          setConflictSession(result.activeSession);
        } else {
          setErrorMsg(result.error || 'Incorrect Admin PIN. Please verify code and try again.');
        }
      } catch (err: any) {
        setIsSubmitting(false);
        setErrorMsg('Failed to verify admin login with server.');
      }
      return;
    }

    if (selectedRole === 'player') {
      if (!pinInput.trim()) {
        setErrorMsg('Please enter the 4-digit Player security code.');
        return;
      }
      if (verifyPlayerPin(pinInput)) {
        setIsSuccess(true);
        setTimeout(() => {
          setRole('player');
          onSuccess?.('player');
        }, 400);
      } else {
        setErrorMsg('Incorrect Player PIN. Please verify code and try again.');
      }
      return;
    }
  };

  const handleForceTakeover = async () => {
    if (!pinInput.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await loginAsAdmin(pinInput, true);
      setIsSubmitting(false);
      setConflictSession(null);
      if (result.success) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess?.('admin');
        }, 400);
      } else {
        setErrorMsg(result.error || 'Could not take over admin session.');
      }
    } catch (e) {
      setIsSubmitting(false);
      setErrorMsg('Failed to take over admin session.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 font-sans relative overflow-hidden selection:bg-indigo-600 selection:text-white">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[600px] h-96 sm:h-[600px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Top Header & Branding */}
      <header className="w-full max-w-xl mx-auto text-center pt-4 sm:pt-8 z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-300 text-xs font-black uppercase tracking-widest mb-3 shadow-sm">
          <Target className="w-4 h-4 text-indigo-400" />
          <span>Kaboom Match Center</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Select Access Level
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto font-medium">
          Choose your role to enter the venue scoreboards, league tournaments, and live broadcast system.
        </p>
      </header>

      {/* Main Authentication Card */}
      <main className="w-full max-w-xl mx-auto my-auto py-4 z-10">
        <div className="bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-2xl space-y-6">
          {/* Role Selection Tabs / Cards */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Admin Role Option */}
            <button
              type="button"
              id="role-select-admin"
              onClick={() => handleRoleSelect('admin')}
              className={`p-3 sm:p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-2 cursor-pointer ${
                selectedRole === 'admin'
                  ? 'bg-amber-500/15 border-amber-500/80 text-white ring-2 ring-amber-500/40 shadow-lg shadow-amber-950/40'
                  : 'bg-slate-800/60 border-slate-700/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  selectedRole === 'admin'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                    : 'bg-slate-800 text-amber-400 border border-slate-700'
                }`}
              >
                👑
              </div>
              <div>
                <div className="font-black text-xs sm:text-sm text-white">Admin</div>
                <div className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider mt-0.5">
                  Full Access
                </div>
              </div>
            </button>

            {/* Player Role Option */}
            <button
              type="button"
              id="role-select-player"
              onClick={() => handleRoleSelect('player')}
              className={`p-3 sm:p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-between gap-2 cursor-pointer ${
                selectedRole === 'player'
                  ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-950/40'
                  : 'bg-slate-800/60 border-slate-700/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                  selectedRole === 'player'
                    ? 'bg-indigo-600 text-white font-black shadow-md'
                    : 'bg-slate-800 text-indigo-400 border border-slate-700'
                }`}
              >
                🎯
              </div>
              <div>
                <div className="font-black text-xs sm:text-sm text-white">Player</div>
                <div className="text-[10px] text-indigo-300/90 font-bold uppercase tracking-wider mt-0.5">
                  Play & Score
                </div>
              </div>
            </button>
          </div>

          {/* Role Capability Details Banner */}
          <div className="bg-slate-950/70 rounded-2xl p-3.5 border border-slate-800/90 text-xs">
            {selectedRole === 'admin' && (
              <div className="space-y-1 text-slate-300">
                <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> Admin Capabilities
                </div>
                <p className="text-[11px] text-slate-400">
                  Full administrative venue control: complete match scoring, financial collections & logs, player roster maintenance, league bracket management, and security code resets.
                </p>
              </div>
            )}

            {selectedRole === 'player' && (
              <div className="space-y-1 text-slate-300">
                <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-wider">
                  <User className="w-4 h-4" /> Player Capabilities
                </div>
                <p className="text-[11px] text-slate-400">
                  Match player access: pick matches, select coin toss & player shooting order, score games, send email reports, view finances (read-only), customize caller settings, and play practice games.
                </p>
              </div>
            )}
          </div>

          {/* PIN Input */}
          <form onSubmit={handleSubmit} className="space-y-4">
              {/* PIN Display */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                  <label htmlFor="pin-input-field" className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Enter {selectedRole === 'admin' ? 'Admin' : 'Player'} PIN:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHint(!showHint)}
                    className="text-[10px] text-slate-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{showHint ? 'Hide Default' : 'Default Code'}</span>
                  </button>
                </div>

                {showHint && (
                  <div className="p-2 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-200 flex items-center justify-between animate-fade-in">
                    <span>Initial Default Code:</span>
                    <span className="font-mono font-black text-white px-2 py-0.5 bg-indigo-900/80 rounded border border-indigo-400/40">
                      {selectedRole === 'admin' ? '1950' : '1234'}
                    </span>
                  </div>
                )}

                {/* Masked PIN bubbles / text field */}
                <div className="relative">
                  <input
                    id="pin-input-field"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value.replace(/\D/g, ''));
                      setErrorMsg(null);
                    }}
                    placeholder="••••"
                    className="w-full bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-center text-2xl sm:text-3xl font-mono tracking-[0.5em] py-3 rounded-2xl text-white placeholder:text-slate-700 outline-none transition-all"
                  />
                  {pinInput.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-300 bg-slate-800 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* On-screen Numeric Keypad for tablets/touch */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeyClick(digit)}
                    className="py-3 bg-slate-800/80 hover:bg-slate-750 text-white font-mono font-black text-lg rounded-xl border border-slate-700/80 hover:border-slate-600 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="py-3 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-bold text-xs rounded-xl border border-slate-700/60 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handleKeyClick('0')}
                  className="py-3 bg-slate-800/80 hover:bg-slate-750 text-white font-mono font-black text-lg rounded-xl border border-slate-700/80 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleDeleteKey}
                  className="py-3 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-bold text-xs rounded-xl border border-slate-700/60 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  title="Backspace"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="btn-login-submit"
                className={`w-full py-3.5 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] ${
                  selectedRole === 'admin'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/30'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/30'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Unlock & Enter as {selectedRole === 'admin' ? 'Admin' : 'Player'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>

      {/* MODAL: Active Admin Session Conflict & Takeover Confirmation */}
      {conflictSession && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-2xl shrink-0">
                👑
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Active Admin Session</h3>
                <p className="text-xs text-amber-400 font-semibold">Single Admin Enforcement</p>
              </div>
            </div>

            <div className="p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-white">
                Another administrator is currently signed in on this league system.
              </p>
              <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-700/60 font-mono">
                <div>Device: <span className="text-amber-300">{conflictSession.clientInfo || 'Active Admin Device'}</span></div>
                <div>Session Active: <span className="text-slate-200">{new Date(conflictSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></div>
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                Policy: Only one person can be signed into Admin at any given time to prevent simultaneous prize draws and conflicting updates.
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                id="btn-takeover-admin"
                onClick={handleForceTakeover}
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>{isSubmitting ? 'Taking Over...' : 'Take Over Admin Access'}</span>
              </button>
              <p className="text-[10px] text-center text-slate-400">
                Taking over will safely sign out the other active device into spectator view.
              </p>

              <button
                type="button"
                onClick={() => setConflictSession(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel / Stay as Player or Spectator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="w-full text-center text-xs text-slate-500 py-3 z-10">
        Kaboom Dart Match Center • Secured Role-Based Access Control
      </footer>
    </div>
  );
};

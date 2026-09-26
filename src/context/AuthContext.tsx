import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserRole, AuthContextType, AuthSecurityConfig, AdminLoginResult } from '../types';
import {
  getSessionRole,
  setSessionRole,
  getLocalSecurityPins,
  saveSecurityPins,
  fetchRemoteSecurityPins,
  getStoredAdminSessionId,
  setStoredAdminSessionId,
  attemptAdminLogin,
  sendAdminHeartbeat,
  logoutAdminSession,
  DEFAULT_ADMIN_PIN,
  DEFAULT_PLAYER_PIN,
} from '../utils/authHelper';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole | null>(() => getSessionRole());
  const [pins, setPins] = useState<AuthSecurityConfig>(() => getLocalSecurityPins());
  const [adminSessionId, setAdminSessionId] = useState<string | null>(() => getStoredAdminSessionId());
  const [evictionNotice, setEvictionNotice] = useState<string | null>(null);

  const adminSessionIdRef = useRef<string | null>(adminSessionId);
  adminSessionIdRef.current = adminSessionId;
  const roleRef = useRef<UserRole | null>(role);
  roleRef.current = role;

  // Listen for role and PIN changes across components and storage
  useEffect(() => {
    // Initial fetch from server
    fetchRemoteSecurityPins().then((remotePins) => {
      if (remotePins) setPins(remotePins);
    });

    const handleRoleChanged = (e: any) => {
      const newRole = e.detail?.role ?? getSessionRole();
      setRoleState(newRole);
    };

    const handlePinsUpdated = (e: any) => {
      if (e.detail) {
        setPins(e.detail);
      } else {
        setPins(getLocalSecurityPins());
      }
    };

    // Listen for SSE admin session revoked event
    const handleAdminSessionRevoked = (e: any) => {
      const detail = e.detail || {};
      const currentSess = adminSessionIdRef.current;
      if (roleRef.current === 'admin' && detail.revokedSessionId && detail.revokedSessionId === currentSess) {
        setStoredAdminSessionId(null);
        setAdminSessionId(null);
        setRoleState('player');
        setSessionRole('player');
        setEvictionNotice('Admin Session Ended: Another administrator has signed into Admin. Only one person can be signed into Admin at any given time.');
      }
    };

    window.addEventListener('kaboom_role_changed', handleRoleChanged);
    window.addEventListener('kaboom_pins_updated', handlePinsUpdated);
    window.addEventListener('kaboom_admin_revoked', handleAdminSessionRevoked);
    window.addEventListener('storage', () => {
      setPins(getLocalSecurityPins());
    });

    // Cleanup session on tab/browser close
    const handleBeforeUnload = () => {
      if (roleRef.current === 'admin' && adminSessionIdRef.current) {
        logoutAdminSession(adminSessionIdRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('kaboom_role_changed', handleRoleChanged);
      window.removeEventListener('kaboom_pins_updated', handlePinsUpdated);
      window.removeEventListener('kaboom_admin_revoked', handleAdminSessionRevoked);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Heartbeat loop when signed in as Admin
  useEffect(() => {
    if (role !== 'admin' || !adminSessionId) return;

    const interval = setInterval(async () => {
      const currentSess = adminSessionIdRef.current;
      if (!currentSess || roleRef.current !== 'admin') return;

      const isStillActive = await sendAdminHeartbeat(currentSess);
      if (!isStillActive) {
        // Displaced or expired
        setStoredAdminSessionId(null);
        setAdminSessionId(null);
        setRoleState('player');
        setSessionRole('player');
        setEvictionNotice('Admin Session Closed: Another administrator signed in or the admin lease expired. Only one person can be signed into Admin at a time.');
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [role, adminSessionId]);

  const loginAsAdmin = useCallback(async (pin: string, forceTakeover: boolean = false): Promise<AdminLoginResult> => {
    const result = await attemptAdminLogin(pin, forceTakeover);
    if (result.success && result.sessionId) {
      setAdminSessionId(result.sessionId);
      setRoleState('admin');
      setSessionRole('admin');
      setEvictionNotice(null);
    }
    return result;
  }, []);

  const setRole = useCallback((newRole: UserRole | null) => {
    if (roleRef.current === 'admin' && newRole !== 'admin' && adminSessionIdRef.current) {
      logoutAdminSession(adminSessionIdRef.current);
      setAdminSessionId(null);
    }
    setRoleState(newRole);
    setSessionRole(newRole);
  }, []);

  const logout = useCallback(() => {
    if (roleRef.current === 'admin' && adminSessionIdRef.current) {
      logoutAdminSession(adminSessionIdRef.current);
      setAdminSessionId(null);
    }
    setRoleState(null);
    setSessionRole(null);
  }, []);

  const updateSecurityPins = useCallback(async (newAdminPin: string, newPlayerPin: string) => {
    const success = await saveSecurityPins(newAdminPin, newPlayerPin);
    if (success) {
      setPins(getLocalSecurityPins());
    }
    return success;
  }, []);

  const resetPinsToDefault = useCallback(async () => {
    const success = await saveSecurityPins(DEFAULT_ADMIN_PIN, DEFAULT_PLAYER_PIN);
    if (success) {
      setPins(getLocalSecurityPins());
    }
    return success;
  }, []);

  const isAdmin = role === 'admin';
  const isPlayer = role === 'player';
  const isSpectator = false;

  // Permission flags:
  // Admin: full access to everything.
  // Player: can pick matches, coin toss, player order, scoring, email report; can view finances (read-only); can adjust dark/light & caller settings; can access practice & games.
  const canEditFinance = isAdmin;
  const canScore = isAdmin || isPlayer;
  const canPlayMatches = true;
  const canDelete = isAdmin;

  const value: AuthContextType = {
    role,
    setRole,
    logout,
    isAdmin,
    isPlayer,
    isSpectator,
    canEditFinance,
    canScore,
    canPlayMatches,
    canDelete,
    adminPin: pins.adminPin,
    playerPin: pins.playerPin,
    adminSessionId,
    loginAsAdmin,
    updateSecurityPins,
    resetPinsToDefault,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Eviction Notice Modal if another Admin took over */}
      {evictionNotice && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center text-3xl">
              👑
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">Single Admin Policy Enforced</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {evictionNotice}
              </p>
            </div>
            <div className="p-3 bg-slate-800/80 rounded-xl text-[11px] text-slate-400">
              Only one administrator can be active at any given time to prevent conflicting updates or concurrent draws.
            </div>
            <button
              type="button"
              onClick={() => setEvictionNotice(null)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg transition-all cursor-pointer"
            >
              Continue as Player
            </button>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

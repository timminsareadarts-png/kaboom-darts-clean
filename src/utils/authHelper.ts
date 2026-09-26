import { UserRole, AuthSecurityConfig, AdminLoginResult, ActiveAdminSessionInfo } from '../types';

export const DEFAULT_ADMIN_PIN = '1950';
export const DEFAULT_PLAYER_PIN = '1234';

const STORAGE_KEY_PINS = 'kaboom_security_pins';
const SESSION_KEY_ROLE = 'kaboom_current_role';
const SESSION_KEY_ADMIN_SESS = 'kaboom_admin_session_id';

/**
 * Retrieve current device/browser info label
 */
export function getClientDeviceInfo(): string {
  try {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const browser = navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Safari') ? 'Safari' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Browser';
    return `${isMobile ? 'Mobile/Tablet' : 'Desktop'} (${browser})`;
  } catch (e) {
    return 'Admin Client';
  }
}

/**
 * Admin Session ID persistence
 */
export function getStoredAdminSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY_ADMIN_SESS) || localStorage.getItem(SESSION_KEY_ADMIN_SESS);
  } catch (e) {
    return null;
  }
}

export function setStoredAdminSessionId(sessionId: string | null): void {
  try {
    if (sessionId) {
      sessionStorage.setItem(SESSION_KEY_ADMIN_SESS, sessionId);
      localStorage.setItem(SESSION_KEY_ADMIN_SESS, sessionId);
    } else {
      sessionStorage.removeItem(SESSION_KEY_ADMIN_SESS);
      localStorage.removeItem(SESSION_KEY_ADMIN_SESS);
    }
  } catch (e) {}
}

/**
 * Query active admin session status from server
 */
export async function checkRemoteAdminSession(): Promise<{ active: boolean; session: ActiveAdminSessionInfo | null }> {
  try {
    const res = await fetch('/api/admin/session');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {}
  return { active: false, session: null };
}

/**
 * Attempt to login as Admin on the server with single-session enforcement
 */
export async function attemptAdminLogin(pin: string, forceTakeover: boolean = false): Promise<AdminLoginResult> {
  const clientInfo = getClientDeviceInfo();
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, forceTakeover, clientInfo }),
    });

    const data = await res.json();

    if (res.status === 409 && data.sessionConflict) {
      return {
        success: false,
        sessionConflict: true,
        activeSession: data.activeSession,
        error: data.message || 'Another administrator is currently active. Only one person can be signed into Admin at any given time.',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || 'Incorrect Admin PIN.',
      };
    }

    if (data.success && data.sessionId) {
      setStoredAdminSessionId(data.sessionId);
      return {
        success: true,
        sessionId: data.sessionId,
      };
    }
  } catch (e) {
    // Offline fallback: if network is down, check locally
    const isLocalValid = verifyAdminPin(pin);
    if (isLocalValid) {
      const fallbackId = `admin-local-${Date.now()}`;
      setStoredAdminSessionId(fallbackId);
      return { success: true, sessionId: fallbackId };
    }
    return { success: false, error: 'Network error occurred while authenticating with server.' };
  }

  return { success: false, error: 'Failed to sign in as Administrator.' };
}

/**
 * Send heartbeat to maintain single admin lease
 */
export async function sendAdminHeartbeat(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  try {
    const res = await fetch('/api/admin/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      const data = await res.json();
      return !!data.active;
    }
  } catch (e) {
    // Ignore network glitch on single heartbeat
    return true;
  }
  return false;
}

/**
 * Explicitly release admin session on logout or switch role
 */
export async function logoutAdminSession(sessionId: string | null): Promise<void> {
  if (!sessionId) return;
  setStoredAdminSessionId(null);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/admin/logout', JSON.stringify({ sessionId }));
    } else {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
        keepalive: true,
      }).catch(() => {});
    }
  } catch (e) {}
}

/**
 * Retrieve stored PIN configuration from localStorage with defaults fallback
 */
export function getLocalSecurityPins(): AuthSecurityConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PINS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.adminPin === 'string' && typeof parsed.playerPin === 'string') {
        return {
          adminPin: parsed.adminPin || DEFAULT_ADMIN_PIN,
          playerPin: parsed.playerPin || DEFAULT_PLAYER_PIN,
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (e) {
    console.error('Error reading security pins from localStorage:', e);
  }
  return {
    adminPin: DEFAULT_ADMIN_PIN,
    playerPin: DEFAULT_PLAYER_PIN,
    updatedAt: Date.now(),
  };
}

/**
 * Save PIN configuration locally and broadcast to server
 */
export async function saveSecurityPins(newAdminPin: string, newPlayerPin: string): Promise<boolean> {
  const config: AuthSecurityConfig = {
    adminPin: newAdminPin.trim() || DEFAULT_ADMIN_PIN,
    playerPin: newPlayerPin.trim() || DEFAULT_PLAYER_PIN,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY_PINS, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('kaboom_pins_updated', { detail: config }));
  } catch (e) {
    console.error('Error writing security pins to localStorage:', e);
  }

  // Push to server endpoint
  try {
    const res = await fetch('/api/security-pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    return res.ok;
  } catch (e) {
    // Return true since local update succeeded
    return true;
  }
}

/**
 * Fetch PIN configuration from server if available
 */
export async function fetchRemoteSecurityPins(): Promise<AuthSecurityConfig | null> {
  try {
    const res = await fetch('/api/security-pins');
    if (res.ok) {
      const data = await res.json();
      if (data && data.adminPin && data.playerPin) {
        localStorage.setItem(STORAGE_KEY_PINS, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // Offline or server not yet responding
  }
  return null;
}

/**
 * Get current session role (stored in sessionStorage and localStorage)
 */
export function getSessionRole(): UserRole | null {
  try {
    const s = sessionStorage.getItem(SESSION_KEY_ROLE);
    if (s === 'logged_out') return null;
    if (s === 'admin' || s === 'player') {
      return s as UserRole;
    }
    if (s === 'spectator') return 'player';

    const l = localStorage.getItem('kaboom_user_role');
    if (l === 'logged_out') return null;
    if (l === 'admin' || l === 'player') {
      return l as UserRole;
    }
    if (l === 'spectator') return 'player';
  } catch (e) {}
  return 'player'; // Default to player on initial start
}

/**
 * Set current session role
 */
export function setSessionRole(role: UserRole | null): void {
  try {
    if (role) {
      sessionStorage.setItem(SESSION_KEY_ROLE, role);
      localStorage.setItem('kaboom_user_role', role);
    } else {
      sessionStorage.setItem(SESSION_KEY_ROLE, 'logged_out');
      localStorage.setItem('kaboom_user_role', 'logged_out');
    }
    window.dispatchEvent(new CustomEvent('kaboom_role_changed', { detail: { role } }));
  } catch (e) {}
}

/**
 * Validate Admin PIN
 */
export function verifyAdminPin(inputPin: string): boolean {
  const current = getLocalSecurityPins();
  const cleanInput = inputPin.trim();
  return cleanInput === current.adminPin || cleanInput === DEFAULT_ADMIN_PIN;
}

/**
 * Validate Player PIN
 */
export function verifyPlayerPin(inputPin: string): boolean {
  const current = getLocalSecurityPins();
  const cleanInput = inputPin.trim();
  return cleanInput === current.playerPin || cleanInput === DEFAULT_PLAYER_PIN;
}

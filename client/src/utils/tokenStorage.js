/** Access token in sessionStorage (cleared when tab closes — safer than localStorage). */
const ACCESS_KEY = 'hms_access_token';

export function getAccessToken() {
  try {
    return sessionStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token) {
  try {
    if (token) sessionStorage.setItem(ACCESS_KEY, token);
    else sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    /* private browsing */
  }
}

export function clearAccessToken() {
  setAccessToken(null);
}

/** Decode JWT exp (seconds) without verifying signature — client-side expiry hint only. */
export function getAccessTokenExpiryMs(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

/** Migrate legacy localStorage token from older builds. */
export function migrateLegacyToken() {
  try {
    const legacy = localStorage.getItem('hms_token');
    if (legacy && !getAccessToken()) {
      setAccessToken(legacy);
      localStorage.removeItem('hms_token');
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return getAccessToken();
}

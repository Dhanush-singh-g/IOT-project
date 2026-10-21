import {DATA_MODE, BASE_URL} from './config.js';
let csrfToken = null;
export const csrfHeaders = () => csrfToken ? {'X-CSRF-Token': csrfToken} : {};

async function authRequest(path, body) {
  let response;
  try {
    response = await fetch(BASE_URL + path, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'include',
      signal: AbortSignal.timeout(10000),
      headers: {'Accept':'application/json', ...(body === undefined ? {} : {'Content-Type':'application/json', ...csrfHeaders()})},
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {throw new Error('We could not connect. Please try again.');}
  if (response.status === 401) throw new Error('The email or password is incorrect. Please try again.');
  if (response.status === 429) throw new Error('Too many sign-in attempts. Please wait before trying again.');
  if (!response.ok) throw new Error('Sign-in is unavailable right now. Please try again.');
  if (response.status === 204) return null;
  try {return await response.json();} catch {throw new Error('Your session could not be verified. Please try again.');}
}
function acceptSession(data) {
  if (!data || typeof data.csrfToken !== 'string' || !data.csrfToken) throw new Error('Your session could not be verified. Please try again.');
  const user = data.user;
  if (user && (typeof user.id !== 'string' || !user.id || typeof user.displayName !== 'string' || user.role !== 'PATIENT')) throw new Error('A patient account is required. Please contact your caregiver.');
  csrfToken = data.csrfToken;
  return user || null;
}
export const auth = {
  async session() {
    if (DATA_MODE === 'local') return null;
    // CONNECTION PLACEHOLDER: server returns {user: null | {id, displayName, role:'PATIENT'}, csrfToken}.
    // Anonymous sessions also supply a CSRF token for the login request.
    return acceptSession(await authRequest('/auth/session'));
  },
  async login(email, password) {
    if (DATA_MODE === 'local') throw new Error('Account sign-in is not available here yet. You can continue on this device below.');
    await this.session();
    const user = acceptSession(await authRequest('/auth/login', {email:email.trim(),password}));
    if (!user) throw new Error('Your session could not be verified. Please try again.');
    return user;
  },
  async logout() {
    if (DATA_MODE === 'live') await authRequest('/auth/logout', {});
    csrfToken = null;
  },
};

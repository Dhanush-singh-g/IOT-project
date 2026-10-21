const environment = import.meta.env || {};
export const DATA_MODE = environment.VITE_DATA_MODE === 'live' ? 'live' : 'local';
export const BASE_URL = (environment.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

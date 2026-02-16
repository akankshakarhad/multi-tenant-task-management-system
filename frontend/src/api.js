import axios from 'axios';

const API_BASE = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5000/api'
  : '/api';
  
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network error
    if (!error.response) {
      error.friendlyMessage = 'Network error. Please check your connection.';
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    // Auto-logout on 401 (token expired / invalid)
    if (status === 401) {
      const currentPath = window.location.pathname;
      if (currentPath !== '/' && currentPath !== '/signup') {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }

    // Rate limited
    if (status === 429) {
      error.friendlyMessage = data?.message || 'Too many requests. Please wait and try again.';
    }

    return Promise.reject(error);
  }
);

/**
 * Extract a user-friendly error message from an axios error.
 */
export function getErrorMessage(error) {
  if (error.friendlyMessage) return error.friendlyMessage;
  if (error.response?.data?.errors?.length) return error.response.data.errors[0];
  if (error.response?.data?.message) return error.response.data.message;
  return 'Something went wrong';
}

export default api;

import axios from "axios";
import { logger } from "./utils/logger";

// Get API URL from environment variable, fallback to proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // dacă folosești cookie-uri / sesiuni
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || "10000"), // 10 secunde timeout default
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor pentru request-uri
api.interceptors.request.use(
  (config) => {
    // If data is FormData, remove Content-Type header to let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    // Don't log /auth/me requests (they're called frequently and 401 is normal when not authenticated)
    if (config.url !== '/auth/me') {
      logger.api.log('API Request:', config.method?.toUpperCase(), config.url);
    }
    return config;
  },
  (error) => {
    logger.api.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor pentru răspunsuri
api.interceptors.response.use(
  (response) => {
    // Don't log /auth/me responses (they're called frequently)
    if (response.config?.url !== '/auth/me') {
      logger.api.log('API Response:', response.status, response.config.url);
    }
    return response;
  },
  (error) => {
    // Don't log 401 errors for /auth/me - this is normal when user is not authenticated
    const isAuthMe401 = error.response?.status === 401 && error.config?.url === '/auth/me';
    
    if (!isAuthMe401) {
      logger.api.error('API Response Error:', error);
      if (error.code === 'ECONNABORTED') {
        logger.api.error('Request timeout - serverul nu răspunde');
      } else if (error.code === 'ERR_NETWORK') {
        logger.api.error('Network error - verifică dacă backend-ul rulează');
      } else if (error.response) {
        logger.api.error('Server error:', error.response.status, error.response.data);
      }
    }
    // For /auth/me 401, silently reject (this is expected behavior)
    return Promise.reject(error);
  }
);

export default api;

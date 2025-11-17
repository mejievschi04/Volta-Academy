import axios from "axios";

const api = axios.create({
  baseURL: "/api", // Proxied through Vite to backend
  withCredentials: true, // dacă folosești cookie-uri / sesiuni
  timeout: 10000, // 10 secunde timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Interceptor pentru request-uri
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Interceptor pentru răspunsuri
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - serverul nu răspunde');
    } else if (error.code === 'ERR_NETWORK') {
      console.error('Network error - verifică dacă backend-ul rulează');
    } else if (error.response) {
      console.error('Server error:', error.response.status, error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;

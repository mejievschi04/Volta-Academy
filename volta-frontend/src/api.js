import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api", // endpoint Laravel
  withCredentials: true, // dacă folosești cookie-uri / sesiuni
});

export default api;

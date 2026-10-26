import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const AUTH_ENDPOINTS = ["/api/auth/login", "/api/auth/register"];

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const requestUrl: string = error.config?.url ?? "";
        const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => requestUrl.includes(path));

        if (error.response?.status === 401 && !isAuthEndpoint) {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;

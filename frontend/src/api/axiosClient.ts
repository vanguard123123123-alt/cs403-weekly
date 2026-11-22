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

// Exact text JwtAuthenticationEntryPoint writes when Spring Security rejects a
// request for having no/invalid/expired JWT (see backend JwtAuthenticationEntryPoint.java).
// Other 401s (e.g. InvalidCredentialsException: "Invalid email or password") are not
// token problems and must not force a redirect.
const MISSING_OR_INVALID_TOKEN_MESSAGE = "Missing or invalid authentication token";

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && error.response.data?.message === MISSING_OR_INVALID_TOKEN_MESSAGE) {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default api;

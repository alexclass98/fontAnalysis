import axios from "axios";
import { store } from "../store/index";
import { setError } from "../store/errorSlice";
import { setToken, clearToken, setAccessToken } from "../store/authSlice";

const API = axios.create({
  baseURL: (process.env.REACT_APP_API_URL || "http://localhost:8000") + "/api",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  timeout: 120000,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const refreshTokenApi = async (refresh) => {
  try {
    const response = await axios.post(
      (process.env.REACT_APP_API_URL || "http://localhost:8000") +
        "/api/token/refresh/",
      { refresh },
      { headers: { "Content-Type": "application/json" } }
    );
    return response.data;
  } catch (error) {
    console.error("Refresh token API error:", error);
    store.dispatch(clearToken());
    throw error;
  }
};

API.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.token;
    const isRegisterRequest = config.url === "/users/register/";
    if (token && !isRegisterRequest) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response ? error.response.status : null;
    const refreshToken = store.getState().auth.refreshToken;

    if (status === 401 && refreshToken && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = "Bearer " + token;
            return API(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const tokenData = await refreshTokenApi(refreshToken);
        const newAccessToken = tokenData.access;
        store.dispatch(setAccessToken(newAccessToken));
        API.defaults.headers.common["Authorization"] =
          "Bearer " + newAccessToken;
        originalRequest.headers["Authorization"] = "Bearer " + newAccessToken;
        processQueue(null, newAccessToken);
        return API(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        store.dispatch(clearToken());
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const errorMessage =
      error.response?.data?.detail ||
      error.response?.data?.error ||
      (typeof error.response?.data === "string" ? error.response.data : null) ||
      (typeof error.response?.data === "object"
        ? JSON.stringify(error.response.data)
        : null) ||
      error.message ||
      "Произошла неизвестная ошибка";

    if (
      !(
        status === 401 &&
        (originalRequest.url.includes("/users/login/") ||
          originalRequest.url.includes("/token/refresh/"))
      )
    ) {
      store.dispatch(setError(errorMessage));
    }
    return Promise.reject(error);
  }
);

export const register = async (userData) => {
  const response = await API.post("/users/register/", userData);
  return response.data;
};

export const login = async (credentials) => {
  const response = await API.post("/users/login/", credentials);
  store.dispatch(
    setToken({
      access: response.data.access,
      refresh: response.data.refresh,
      isAdmin: response.data.is_admin,
      user: response.data.user,
    })
  );
  return response.data;
};

export const getUsers = async () => {
  const response = await API.get("/users/");
  return response.data;
};

export const getGraphData = async (nlpParams) => {
  console.log("API.JS: getGraphData, отправка параметров:", nlpParams);
  const response = await API.get("/graph/", {
    params: nlpParams,
  });
  return response.data;
};

export const deleteUser = async (userId) => {
  const response = await API.delete(`/users/${userId}/`);
  return response.data;
};

export const getRandomCipher = async (variationConfig) => {
  const response = await API.post("/ciphers/random/", variationConfig);
  return response.data;
};

export const saveStudy = async (studyDataArray) => {
  const response = await API.post("/studies/", studyDataArray);
  return response.data;
};

export const findAssociationsByReaction = async (searchPayload) => {
  console.log(
    "API.JS: findAssociationsByReaction, отправка тела POST:",
    JSON.stringify(searchPayload, null, 2)
  );
  const response = await API.post("/associations/search/", searchPayload);
  return response.data;
};

export const analyzeNLPText = async (textPayload) => {
  const response = await API.post("/nlp/analyze-text/", textPayload);
  return response.data;
};

export const analyzeAllAssociationsNLP = async (page = 1, pageSize = 5) => {
  const response = await API.get("/nlp/analyze-all-associations/", {
    params: {
      page: page,
      page_size: pageSize,
    },
  });
  return response.data;
};

export const getAllAssociationsForNLP = async () => {
  const response = await API.get("/nlp/all-associations-full/");
  return response.data;
};

export const getFilteredAssociationsForNLP = async (params) => {
  const response = await API.get("/nlp/filtered-associations/", { params });
  return response.data;
};

export const getFastGroupedAssociations = async (params) => {
  const response = await API.get("/nlp/fast-grouped/", { params });
  return response.data;
};

export default API;

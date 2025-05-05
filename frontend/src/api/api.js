import axios from "axios";
import store from "../store/index";
import { setError } from "../store/errorSlice";
import {setToken} from "../store/authSlice";

const API = axios.create({
    baseURL: "http://127.0.0.1:8000/api",
    withCredentials: true,
});

// Интерсепторы для работы с токеном
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Глобальная обработка ошибок
API.interceptors.response.use(
    (response) => response,
    (error) => {
        const errorMessage =
            error.response?.data?.message || "Что-то пошло не так";
        store.dispatch(setError(errorMessage));
        return Promise.reject(error);
    }
);

export const register = async (data) => {
    try {
        const response = await API.post("/register/", data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const login = async (data) => {
    try {
        const response = await API.post("/login/", data);

        store.dispatch(setToken({
            token: response.data.access,
            isAdmin: response.data.is_admin
        }));

        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getDashboard = async () => {
    try {
        const response = await API.get("/dashboard/");
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getRandomCipher = async () => {
    try {
        const response = await API.get("/random-cipher");
        return response.data;
    } catch (error) {
        throw error;
    }
};

// Сохранение реакции пользователя на шрифт
export const saveStudy = async (data) => {
    try {
        const response = await API.post("/save-study", {
            cipher_id: data.cipher_id,
            reaction_description: data.reaction_description,
        });
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const saveAssociation = async (data) => {
    try {
        const response = await API.post("/save-association/", data);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const getUsers = async () => {
    try {
        const response = await API.get('users/');
        return response.data;
    } catch (error) {
        throw new Error('Не удалось загрузить пользователей');
    }
};

export const getGraphData = async () => {
    try {
        const response = await API.get('/graph-data/');
        return response.data;
    } catch (error) {
        throw new Error('Не удалось получить данные графа');
    }
};

export const deleteUser = async (userId) => {
    try {
        const response = await API.delete(`user/${userId}/`);
        return response.data;
    } catch (error) {
        throw new Error('Не удалось удалить пользователя');
    }
};



export default API;

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    token: localStorage.getItem("token") || null,
    isAdmin: localStorage.getItem("is_admin") || false,
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setToken(state, action) {
            const { access, is_admin } = action.payload;
            state.token = access;
            state.isAdmin = is_admin;
            localStorage.setItem("token", access);
            localStorage.setItem("is_admin", is_admin);
        },
        clearToken(state) {
            state.token = null;
            state.isAdmin = false;
            localStorage.removeItem("token");
            localStorage.removeItem("is_admin");
        },
    },
});

export const { setToken, clearToken } = authSlice.actions;

export default authSlice.reducer;

import { createSlice } from "@reduxjs/toolkit";
import { jwtDecode } from "jwt-decode";

const getInitialState = () => {
  const token = localStorage.getItem("access_token");
  let isAdmin = localStorage.getItem("is_admin") === "true";
  let user = null;
  const refreshToken = localStorage.getItem("refresh_token");

  if (token) {
    try {
      const decodedToken = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      if (decodedToken.exp > currentTime) {
        isAdmin = decodedToken.is_admin || false;
        user = {
          id: decodedToken.user_id,
          username: decodedToken.username,
          is_admin: isAdmin,
        };
        localStorage.setItem("is_admin", isAdmin.toString());
      } else {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("is_admin");
        return { token: null, refreshToken: null, isAdmin: false, user: null };
      }
    } catch (error) {
      console.error("Failed to decode token:", error);
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("is_admin");
      return { token: null, refreshToken: null, isAdmin: false, user: null };
    }
  } else {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("is_admin");
  }

  return { token, refreshToken, isAdmin, user };
};

const initialState = getInitialState();

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action) {
      const { access, refresh, is_admin, user: userData } = action.payload;
      state.token = access;
      state.refreshToken = refresh;
      state.isAdmin = is_admin || false;
      state.user = userData || null;
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      localStorage.setItem("is_admin", state.isAdmin.toString());
    },
    clearToken(state) {
      state.token = null;
      state.refreshToken = null;
      state.isAdmin = false;
      state.user = null;
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("is_admin");
    },
    setAccessToken(state, action) {
      state.token = action.payload;
      localStorage.setItem("access_token", action.payload);
      try {
        const decodedToken = jwtDecode(action.payload);
        state.isAdmin = decodedToken.is_admin || false;
        state.user = {
          id: decodedToken.user_id,
          username: decodedToken.username,
          is_admin: state.isAdmin,
        };
        localStorage.setItem("is_admin", state.isAdmin.toString());
      } catch (error) {
        console.error("Failed to decode new access token:", error);
        authSlice.caseReducers.clearToken(state);
      }
    },
  },
});

export const { setToken, clearToken, setAccessToken } = authSlice.actions;

export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAdmin = (state) => state.auth.isAdmin;
export const selectToken = (state) => state.auth.token;
export const selectRefreshToken = (state) => state.auth.refreshToken;

export default authSlice.reducer;

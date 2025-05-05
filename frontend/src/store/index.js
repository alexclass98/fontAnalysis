import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import errorReducer from "./errorSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    error: errorReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: process.env.NODE_ENV !== "production",
});

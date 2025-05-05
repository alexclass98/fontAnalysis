import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import { useSelector } from "react-redux";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import ErrorSnackbar from "./utils/ErrorSnackbar";
import Test from "./components/Test";
import GraphPage from "./components/GraphPage";

const theme = createTheme({
    palette: {
        primary: {
            main: "#1976d2",
        },
        secondary: {
            main: "#ff4081",
        },
        background: {
            default: "#f5f5f5",
        },
    },
});

const App = () => {
    
    const token = useSelector((state) => state.auth.token);

    return (
        <>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                <ErrorSnackbar />
                <Routes>
                    <Route
                        path="/"
                        element={token ? <Dashboard /> : <Navigate to="/login" />}
                    />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/test" element={token ? <Test /> : <Navigate to="/login" />} />
                    <Route
                        path="/graph"
                        element={token ? <GraphPage /> : <Navigate to="/login" />}
                    />
                </Routes>
            </ThemeProvider>
        </>
    );
};

export default App;

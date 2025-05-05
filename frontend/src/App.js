import React from "react";
import { Routes, Route, Navigate, BrowserRouter } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import { useSelector } from "react-redux";
import Login from "./components/Login";
import Register from "./components/Register";
import HomePage from "./components/HomePage";
import AdminDashboard from "./components/AdminDashboard";
import Header from "./components/Header";
import ErrorSnackbar from "./utils/ErrorSnackbar";
import FontTest from "./components/FontTest";
import GraphPage from "./components/GraphPage";
import { selectToken, selectIsAdmin } from "./store/authSlice";

const theme = createTheme({
  palette: {
    primary: { main: "#3f51b5" },
    secondary: { main: "#f50057" },
    background: { default: "#f4f6f8", paper: "#ffffff" },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 300,
      fontSize: "6rem",
      lineHeight: 1.167,
      letterSpacing: "-0.01562em",
    },
    h2: {
      fontWeight: 300,
      fontSize: "3.75rem",
      lineHeight: 1.2,
      letterSpacing: "-0.00833em",
    },
    h3: {
      fontWeight: 400,
      fontSize: "3rem",
      lineHeight: 1.167,
      letterSpacing: "0em",
    },
    h4: {
      fontWeight: 400,
      fontSize: "2.125rem",
      lineHeight: 1.235,
      letterSpacing: "0.00735em",
    },
    h5: {
      fontWeight: 400,
      fontSize: "1.5rem",
      lineHeight: 1.334,
      letterSpacing: "0em",
    },
    h6: {
      fontWeight: 500,
      fontSize: "1.25rem",
      lineHeight: 1.6,
      letterSpacing: "0.0075em",
    },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar: {
      styleOverrides: { root: { backgroundColor: "#ffffff", color: "#333" } },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 20 },
        containedPrimary: {
          "&:hover": { backgroundColor: "#303f9f", boxShadow: "none" },
        },
        containedSecondary: {
          "&:hover": { backgroundColor: "#c51162", boxShadow: "none" },
        },
        outlined: { borderRadius: 20 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
        elevation1: { boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.1)" },
        elevation3: { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.08)" },
      },
    },
    MuiTextField: { defaultProps: { variant: "outlined" } },
    MuiChip: { styleOverrides: { root: { borderRadius: 16 } } },
  },
});

const ProtectedRoute = ({ children }) => {
  const token = useSelector(selectToken);
  return token ? children : <Navigate to="/login" replace />;
};
const AdminRoute = ({ children }) => {
  const token = useSelector(selectToken);
  const isAdmin = useSelector(selectIsAdmin);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return isAdmin ? children : <Navigate to="/" replace />;
};
const PublicRoute = ({ children }) => {
  const token = useSelector(selectToken);
  return !token ? children : <Navigate to="/" replace />;
};

const App = () => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Header />
      <ErrorSnackbar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <PublicRoute>
                {" "}
                <Login />{" "}
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                {" "}
                <Register />{" "}
              </PublicRoute>
            }
          />
          <Route
            path="/test"
            element={
              <ProtectedRoute>
                {" "}
                <FontTest />{" "}
              </ProtectedRoute>
            }
          />
          <Route
            path="/graph"
            element={
              <ProtectedRoute>
                {" "}
                <GraphPage />{" "}
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                {" "}
                <AdminDashboard />{" "}
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </ThemeProvider>
  );
};

export default App;

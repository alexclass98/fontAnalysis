import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useLocation, Link as RouterLink } from "react-router-dom";
import {
  Container,
  Typography,
  Paper,
  Button,
  Box,
  Divider,
  Snackbar,
  Alert,
} from "@mui/material";
import { selectCurrentUser } from "../store/authSlice";

const HomePage = () => {
  const currentUser = useSelector(selectCurrentUser);
  const location = useLocation();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("success");

  useEffect(() => {
    // Проверяем наличие сообщений в state при загрузке страницы
    if (location.state?.successMessage) {
      setSnackbarMessage(location.state.successMessage);
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
      // Очищаем state, чтобы сообщение не показывалось снова при обновлении
      window.history.replaceState({}, document.title);
    } else if (location.state?.infoMessage) {
      setSnackbarMessage(location.state.infoMessage);
      setSnackbarSeverity("info");
      setSnackbarOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 4 }, textAlign: "center" }}>
        <Typography
          variant="h2"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: "primary.main",
            fontSize: { xs: "2rem", md: "3rem" },
          }}
        >
          Исследование шрифтовых ассоциаций
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography
          variant="h5"
          component="p"
          color="text.secondary"
          sx={{ mt: 2, mb: 1 }}
        >
          Магистерская работа
        </Typography>
        <Typography variant="body1" gutterBottom sx={{ fontSize: "1.1rem" }}>
          {" "}
          Студент: <strong>Балабанов Алексей</strong>{" "}
        </Typography>
        <Typography variant="body1" gutterBottom sx={{ fontSize: "1.1rem" }}>
          {" "}
          Научный руководитель:{" "}
          <strong>к.т.н. Филиппович Анна Юрьевна</strong>{" "}
        </Typography>
        <Typography variant="body1" sx={{ fontSize: "1.1rem", mb: 4 }}>
          {" "}
          Университет: <strong>МГТУ им. Н.Э. Баумана</strong>{" "}
        </Typography>
        <Box sx={{ mt: 4 }}>
          {currentUser ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              component={RouterLink}
              to="/test"
              sx={{ px: 5, py: 1.5 }}
            >
              {" "}
              Начать исследование{" "}
            </Button>
          ) : (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              {" "}
              <Button
                variant="contained"
                color="primary"
                size="large"
                component={RouterLink}
                to="/login"
                sx={{ px: 4, py: 1 }}
              >
                {" "}
                Войти{" "}
              </Button>{" "}
              <Button
                variant="outlined"
                color="primary"
                size="large"
                component={RouterLink}
                to="/register"
                sx={{ px: 4, py: 1 }}
              >
                {" "}
                Зарегистрироваться{" "}
              </Button>{" "}
            </Box>
          )}
        </Box>
      </Paper>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
          variant="filled"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default HomePage;

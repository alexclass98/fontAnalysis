import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Container,
} from "@mui/material";
import { login } from "../api/api";
import { useDispatch } from "react-redux";
import { setError } from "../store/errorSlice";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    dispatch(setError(null));

    try {
      await login({ username, password });
      navigate("/");
    } catch (error) {
      console.error("Ошибка авторизации:", error);
      const errorMsg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        "Ошибка входа. Проверьте логин и пароль.";
      setLoginError(errorMsg);
      dispatch(setError(errorMsg));
    }
  };

  const handleRegisterNavigate = () => {
    navigate("/register");
  };

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          mt: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h4" gutterBottom>
          Вход
        </Typography>
        {loginError && (
          <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
            {loginError}
          </Alert>
        )}
        <Box
          component="form"
          onSubmit={handleLogin}
          sx={{ mt: 1, width: "100%" }}
        >
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Имя пользователя или Email"
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Пароль"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Войти
          </Button>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2">
              Нет аккаунта?{" "}
              <Button onClick={handleRegisterNavigate} size="small">
                Зарегистрироваться
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;

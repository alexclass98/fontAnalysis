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
import { register, login } from "../api/api";
import { useDispatch } from "react-redux";
import { setError } from "../store/errorSlice";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [registerError, setRegisterError] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError(null);
    dispatch(setError(null));

    try {
      await register({
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      });

      await login({ username, password });
      navigate("/");
    } catch (error) {
      console.error("Ошибка регистрации:", error);
      let errorMessages = "Ошибка регистрации.";
      if (error.response && error.response.data) {
        const errors = error.response.data;
        errorMessages = Object.entries(errors)
          .map(
            ([field, messages]) =>
              `${field}: ${
                Array.isArray(messages) ? messages.join(", ") : messages
              }`
          )
          .join("\n");
      }
      setRegisterError(errorMessages);
      dispatch(setError(errorMessages));
    }
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
          Регистрация
        </Typography>
        {registerError && (
          <Alert
            severity="error"
            sx={{ width: "100%", mb: 2, whiteSpace: "pre-wrap" }}
          >
            {registerError}
          </Alert>
        )}
        <Box
          component="form"
          onSubmit={handleRegister}
          sx={{ mt: 1, width: "100%" }}
        >
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label="Имя пользователя (логин)"
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
            id="email"
            label="Email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Пароль (мин. 8 символов)"
            type="password"
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            margin="normal"
            fullWidth
            id="firstName"
            label="Имя"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <TextField
            margin="normal"
            fullWidth
            id="lastName"
            label="Фамилия"
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
          >
            Зарегистрироваться
          </Button>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2">
              Уже есть аккаунт?{" "}
              <Button onClick={() => navigate("/login")} size="small">
                Войти
              </Button>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
};

export default Register;

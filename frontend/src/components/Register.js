import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Container,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Grid,
} from "@mui/material";
import { register, login } from "../api/api";
import { useDispatch } from "react-redux";
import { setError } from "../store/errorSlice";

const genderOptions = [
  { value: "", label: "Не выбрано" },
  { value: "MALE", label: "Мужской" },
  { value: "FEMALE", label: "Женский" },
  { value: "OTHER", label: "Другой" },
  { value: "PNS", label: "Предпочитаю не указывать" },
];

const educationOptions = [
  { value: "", label: "Не выбрано" },
  { value: "SECONDARY", label: "Среднее" },
  { value: "VOCATIONAL", label: "Среднее специальное" },
  { value: "INCOMPLETE_HIGHER", label: "Незаконченное высшее" },
  { value: "BACHELOR", label: "Бакалавр" },
  { value: "MASTER", label: "Магистр" },
  { value: "SPECIALIST", label: "Специалитет" },
  { value: "PHD", label: "Кандидат/Доктор наук (PhD)" },
  { value: "OTHER_EDU", label: "Другое" },
  { value: "PNS_EDU", label: "Предпочитаю не указывать" },
];

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [registerError, setRegisterError] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError(null);
    dispatch(setError(null));

    const payload = {
      username,
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      gender: gender || null,
      age: age ? parseInt(age, 10) : null,
      education_level: educationLevel || null,
      specialty: specialty || null,
    };

    try {
      await register(payload);
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
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: { xs: 3, sm: 4 },
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h5" gutterBottom>
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
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                margin="dense"
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
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
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
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
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
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                fullWidth
                id="firstName"
                label="Имя"
                name="firstName"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                fullWidth
                id="lastName"
                label="Фамилия"
                name="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth margin="dense">
                <InputLabel id="gender-label">Пол</InputLabel>
                <Select
                  labelId="gender-label"
                  id="gender"
                  value={gender}
                  label="Пол"
                  onChange={(e) => setGender(e.target.value)}
                >
                  {genderOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                margin="dense"
                fullWidth
                id="age"
                label="Возраст"
                name="age"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth margin="dense">
                <InputLabel id="education-label">
                  Уровень образования
                </InputLabel>
                <Select
                  labelId="education-label"
                  id="educationLevel"
                  value={educationLevel}
                  label="Уровень образования"
                  onChange={(e) => setEducationLevel(e.target.value)}
                >
                  {educationOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                margin="dense"
                fullWidth
                id="specialty"
                label="Специальность/Направление обучения"
                name="specialty"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
              />
            </Grid>
          </Grid>

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

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Typography, Box } from "@mui/material";
import { register, login } from "../api/api";
import { useDispatch } from "react-redux";
import { setToken } from "../store/authSlice";

const Register = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            await register({ username, password });
            const response = await login({ username, password });

            dispatch(setToken(response));
            navigate("/");
        } catch (error) {
            console.error("Ошибка регистрации", error);
        }
    };

    return (
        <Box sx={{ width: 300, margin: "auto", textAlign: "center", mt: 5 }}>
            <Typography variant="h4" gutterBottom>
                Регистрация
            </Typography>
            <form onSubmit={handleRegister}>
                <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    margin="normal"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <TextField
                    label="Пароль"
                    type="password"
                    fullWidth
                    margin="normal"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }}>
                    Зарегистрироваться
                </Button>
            </form>
            <Typography variant="body2" sx={{ mt: 2 }}>
                Уже есть аккаунт?{" "}
                <Button onClick={() => navigate("/login")} size="small">
                    Войти
                </Button>
            </Typography>
        </Box>
    );
};

export default Register;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TextField, Button, Typography, Box } from "@mui/material";
import { login } from "../api/api";
import { useDispatch } from "react-redux";
import { setToken } from "../store/authSlice";

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // Запускаем профилирование при загрузке компонента
    useEffect(() => {
        const startTime = performance.now();

        return () => {
            const endTime = performance.now();
            console.log(`Login component mounted in ${endTime - startTime} ms`);
        };
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();

        const navigationStart = performance.now();
        try {
            const response = await login({ username, password });
            dispatch(setToken(response));

            const apiCallEnd = performance.now();
            console.log(`API call completed in ${apiCallEnd - navigationStart} ms`);

            navigate("/");
            const navigationEnd = performance.now();
            console.log(`Navigation to "/" completed in ${navigationEnd - apiCallEnd} ms`);
        } catch (error) {
            console.error("Ошибка авторизации", error);
        }
    };

    const handleRegisterNavigate = () => {
        const navigationStart = performance.now();

        navigate("/register");

        const navigationEnd = performance.now();
        console.log(`Navigation to "/register" completed in ${navigationEnd - navigationStart} ms`);
    };

    return (
        <Box sx={{ width: 300, margin: "auto", textAlign: "center", mt: 5 }}>
            <Typography variant="h4" gutterBottom>
                Вход
            </Typography>
            <form onSubmit={handleLogin}>
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
                    Войти
                </Button>
            </form>
            <Typography variant="body2" sx={{ mt: 2 }}>
                Нет аккаунта?{" "}
                <Button onClick={handleRegisterNavigate} size="small">
                    Зарегистрироваться
                </Button>
            </Typography>
        </Box>
    );
};

export default Login;

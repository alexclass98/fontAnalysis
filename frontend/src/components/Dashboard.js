import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Typography, Box, Container, Paper } from "@mui/material";
import { clearToken } from "../store/authSlice";
import { useNavigate } from "react-router-dom";
import { saveAssociation, deleteUser, getUsers } from "../api/api"; // Ваши API методы
import { setError } from "../store/errorSlice";
import UserSearch from "./admin/UserSearch"; // Компонент для поиска пользователей
import UserTable from "./admin/UserTable"; // Компонент для отображения таблицы пользователей
import FontSearch from "./user/FontSearch"; // Компонент для поиска шрифта
import SnackbarAlert from "./user/Snackbar"; // Компонент для Snackbar

const Dashboard = () => {
    const [reaction, setReaction] = useState(""); // Состояние для реакции
    const [loading, setLoading] = useState(false); // Состояние загрузки
    const [associationMessage, setAssociationMessage] = useState(""); // Сообщение Snackbar
    const [fontName, setFontName] = useState(""); // Название шрифта
    const [openSnackbar, setOpenSnackbar] = useState(false); // Открытие Snackbar
    const [users, setUsers] = useState([]); // Состояние для списка пользователей
    const [search, setSearch] = useState(""); // Для поиска по таблице
    const [loadingUsers, setLoadingUsers] = useState(false); // Загрузка списка пользователей
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isAdmin } = useSelector((state) => state.auth); // Получаем isAdmin из Redux

    // Функция для получения списка пользователей
    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await getUsers();
            setUsers(response); // Сохраняем пользователей в состояние
        } catch (error) {
            dispatch(setError("Не удалось загрузить пользователей"));
        } finally {
            setLoadingUsers(false);
        }
    };

    // Функция для удаления пользователя
    const handleDeleteUser = async (userId) => {
        try {
            await deleteUser(userId); // Удаление пользователя через API
            setUsers(users.filter((user) => user.id !== userId)); // Убираем удаленного пользователя из списка
        } catch (error) {
            dispatch(setError("Не удалось удалить пользователя"));
        }
    };

    // Функция для поиска шрифта
    const handleSearchFont = async () => {
        if (!reaction.trim()) {
            dispatch(setError("Введите реакцию для поиска"));
            return;
        }

        setLoading(true);

        try {
            const response = await saveAssociation({ reaction_description: reaction });

            setAssociationMessage(response.message); // Ответ от сервера с успешным сообщением
            setFontName(response.font_name); // Устанавливаем название шрифта
            setOpenSnackbar(true); // Открыть Snackbar
            setLoading(false); // Завершаем загрузку
        } catch (error) {
            setLoading(false);
            setFontName(""); // Очищаем название шрифта при ошибке
            dispatch(setError("Не удалось найти шрифт для реакции"));
        }
    };

    // Обработчик выхода
    const handleLogout = () => {
        dispatch(clearToken()); // Удаляем токен из стора и localStorage
        navigate("/login"); // Перенаправляем на логин
    };

    // Закрытие Snackbar
    const handleCloseSnackbar = () => {
        setOpenSnackbar(false);
    };

    // Получаем список пользователей при загрузке страницы, если пользователь админ
    useEffect(() => {
        if (isAdmin) {
            fetchUsers();
        }
    }, [isAdmin]);

    return (
        <Container maxWidth="lg">
            <Paper elevation={3} sx={{ padding: 4, marginTop: 4 }}>
                <Typography variant="h4" gutterBottom align="center">
                    Добро пожаловать на главную страницу!
                </Typography>

                <FontSearch reaction={reaction} setReaction={setReaction} onSearchFont={handleSearchFont} loading={loading} />

                {fontName && (
                    <Typography variant="body1" sx={{ mb: 2, padding: 1, backgroundColor: "#f4f4f4", borderRadius: "4px", textAlign: "center", fontStyle: "italic" }}>
                        Подходящий шрифт: {fontName}
                    </Typography>
                )}

                <Box sx={{ display: "flex", gap:'10px', justifyContent: "space-between" }}>
                    <Button variant="outlined"  color="primary" onClick={() => navigate("/test")} sx={{ width: "100%" }} >
                        Пройти исследование
                    </Button>
                    <Button
                        variant="contained"
                        color=""
                        onClick={() => navigate("/graph")} variant="outlined" sx={{ width: "100%" }}
                    >
                        Показать граф реакций
                    </Button>
                    <Button variant="outlined" color="error" onClick={handleLogout} sx={{ width: "100%" }}>
                        Выйти
                    </Button>
                </Box>

                {isAdmin && (
                    <Box sx={{ marginTop: 4 }}>
                        <UserSearch search={search} onSearchChange={(e) => setSearch(e.target.value)} />
                        <UserTable users={users} onDeleteUser={handleDeleteUser} loading={loadingUsers} search={search} />
                    </Box>
                )}

                <SnackbarAlert open={openSnackbar} message={associationMessage} onClose={handleCloseSnackbar} />
            </Paper>
        </Container>
    );
};

export default Dashboard;

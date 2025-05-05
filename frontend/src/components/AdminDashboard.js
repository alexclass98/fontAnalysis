import React, { useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { Typography, Box, Container, Paper } from "@mui/material";
import { deleteUser, getUsers } from "../api/api";
import { setError } from "../store/errorSlice"; // Если нужен для ошибок
import UserSearch from "./admin/UserSearch";
import UserTable from "./admin/UserTable";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const dispatch = useDispatch();

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const response = await getUsers();
      setUsers(response);
    } catch (error) {
      console.error("Failed to fetch users", error);
      // Ошибка уже обработана интерсептором, сообщение в errorSlice
    } finally {
      setLoadingUsers(false);
    }
  }, []); // Нет зависимостей, т.к. dispatch стабилен

  const handleDeleteUser = async (userId) => {
    // Опционально: добавить диалог подтверждения
    try {
      await deleteUser(userId);
      // Обновляем список пользователей после успешного удаления
      setUsers((currentUsers) =>
        currentUsers.filter((user) => user.id !== userId)
      );
    } catch (error) {
      console.error("Failed to delete user", error);
      // Ошибка уже обработана интерсептором
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ padding: { xs: 2, md: 4 } }}>
        <Typography variant="h4" gutterBottom align="center" sx={{ mb: 3 }}>
          Управление пользователями
        </Typography>
        <Box sx={{ mb: 2 }}>
          <UserSearch
            search={searchUser}
            onSearchChange={(e) => setSearchUser(e.target.value)}
          />
        </Box>
        <UserTable
          users={users}
          onDeleteUser={handleDeleteUser}
          loading={loadingUsers}
          search={searchUser}
        />
      </Paper>
    </Container>
  );
};

export default AdminDashboard;

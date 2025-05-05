import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Button,
  Typography,
  Box,
  Container,
  Paper,
  Alert,
  Divider,
} from "@mui/material";
import { clearToken } from "../store/authSlice";
import { useNavigate } from "react-router-dom";
import { deleteUser, getUsers, findFontByReaction } from "../api/api";
import { setError, clearError } from "../store/errorSlice";
import UserSearch from "./admin/UserSearch";
import UserTable from "./admin/UserTable";
import FontSearch from "./user/FontSearch";

const Dashboard = () => {
  const [reaction, setReaction] = useState("");
  const [loadingFontSearch, setLoadingFontSearch] = useState(false);
  const [foundAssociation, setFoundAssociation] = useState(null);
  const [users, setUsers] = useState([]);
  const [searchUser, setSearchUser] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchError, setSearchError] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAdmin } = useSelector((state) => state.auth);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const r = await getUsers();
      setUsers(r);
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoadingUsers(false);
    }
  };
  const handleDeleteUser = async (userId) => {
    try {
      await deleteUser(userId);
      setUsers((cu) => cu.filter((u) => u.id !== userId));
    } catch (e) {
      console.error("Failed to delete user", e);
    }
  };
  const handleSearchFont = async () => {
    if (!reaction.trim()) {
      setSearchError("Введите текст реакции.");
      setFoundAssociation(null);
      return;
    }
    setSearchError("");
    dispatch(clearError());
    setLoadingFontSearch(true);
    setFoundAssociation(null);
    try {
      const response = await findFontByReaction(reaction.trim());
      if (response.variation_details) {
        setFoundAssociation(response.variation_details);
      } else {
        setSearchError("Не удалось получить детали вариации.");
      }
    } catch (error) {
      console.error("Font search error:", error);
      const eMsg =
        error.response?.data?.error ||
        "Ассоциация для данной реакции не найдена.";
      setSearchError(eMsg);
    } finally {
      setLoadingFontSearch(false);
    }
  };
  const handleLogout = () => {
    dispatch(clearToken());
    navigate("/login");
  };
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
    return () => {
      dispatch(clearError());
    };
  }, [isAdmin, dispatch]);

  const formatVariationDetails = (details) => {
    if (!details) return null;
    // Используем отображаемые значения из сериализатора
    const style =
      details.font_style_display !== "Прямой" ? details.font_style_display : "";
    return `${details.cipher_name} ${details.font_weight_display} ${style} (Spacing: ${details.letter_spacing}, Size: ${details.font_size}pt, Leading: ${details.line_height})`
      .replace(/\s+/g, " ")
      .trim();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ padding: { xs: 2, md: 4 } }}>
        <Typography variant="h4" gutterBottom align="center">
          {" "}
          Добро пожаловать!{" "}
        </Typography>
        <Box sx={{ mb: 4, p: 3, border: "1px solid #eee", borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            Найти вариацию шрифта по реакции
          </Typography>
          <FontSearch
            reaction={reaction}
            setReaction={setReaction}
            onSearchFont={handleSearchFont}
            loading={loadingFontSearch}
          />
          {searchError && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {searchError}
            </Alert>
          )}
          {foundAssociation && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
              {" "}
              <Typography
                variant="body1"
                sx={{ fontStyle: "italic", fontWeight: "medium" }}
              >
                {" "}
                Найденная вариация:{" "}
              </Typography>{" "}
              <Typography variant="body2" sx={{ mt: 1 }}>
                {" "}
                {formatVariationDetails(foundAssociation)}{" "}
              </Typography>{" "}
            </Box>
          )}
        </Box>
        <Divider sx={{ my: 4 }} />
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "center",
            flexWrap: "wrap",
            mb: 4,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate("/test")}
            sx={{ minWidth: "180px" }}
          >
            {" "}
            Пройти исследование{" "}
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => navigate("/graph")}
            sx={{ minWidth: "180px" }}
          >
            {" "}
            Показать граф реакций{" "}
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleLogout}
            sx={{ minWidth: "180px" }}
          >
            {" "}
            Выйти{" "}
          </Button>
        </Box>
        {isAdmin && (
          <>
            {" "}
            <Divider sx={{ my: 4 }} />{" "}
            <Box sx={{ marginTop: 4 }}>
              {" "}
              <Typography variant="h5" gutterBottom>
                Управление пользователями
              </Typography>{" "}
              <UserSearch
                search={searchUser}
                onSearchChange={(e) => setSearchUser(e.target.value)}
              />{" "}
              <UserTable
                users={users}
                onDeleteUser={handleDeleteUser}
                loading={loadingUsers}
                search={searchUser}
              />{" "}
            </Box>{" "}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default Dashboard;

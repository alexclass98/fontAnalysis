import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import ScienceIcon from "@mui/icons-material/Science";
import AutoGraphIcon from "@mui/icons-material/AutoGraph";
import HomeIcon from "@mui/icons-material/Home";
import AnalyticsIcon from '@mui/icons-material/Analytics'; // Новая иконка
import {
  clearToken,
  selectCurrentUser,
  selectIsAdmin,
} from "../store/authSlice";

const Header = () => {
  const currentUser = useSelector(selectCurrentUser);
  const isAdmin = useSelector(selectIsAdmin);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(clearToken());
    navigate("/login");
  };

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, fontWeight: "bold" }}
        >
          Шрифтовые Ассоциации
        </Typography>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            color="inherit"
            component={RouterLink}
            to="/"
            startIcon={<HomeIcon />}
          >
            Главная
          </Button>
          {currentUser && (
            <>
              <Button
                color="inherit"
                component={RouterLink}
                to="/test"
                startIcon={<ScienceIcon />}
              >
                Тест
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/graph"
                startIcon={<AutoGraphIcon />}
              >
                Граф
              </Button>
              <Button
                color="inherit"
                component={RouterLink}
                to="/nlp-analysis"
                startIcon={<AnalyticsIcon />}
              >
                NLP Анализ
              </Button>
            </>
          )}
          {currentUser && isAdmin && (
            <Button
              color="inherit"
              component={RouterLink}
              to="/admin"
              startIcon={<AdminPanelSettingsIcon />}
            >
              Админ
            </Button>
          )}
        </Box>

        <Box
          sx={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {currentUser ? (
            <>
              <Typography sx={{ display: { xs: "none", sm: "block" } }}>
                {currentUser.username}
              </Typography>
              <Tooltip title="Выйти">
                <IconButton color="inherit" onClick={handleLogout}>
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/login">
                Вход
              </Button>
              <Button color="inherit" component={RouterLink} to="/register">
                Регистрация
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
import React, { useState, useEffect, useCallback, useRef } from "react";
import { getRandomCipher, saveStudy } from "../api/api";
import { useSelector, useDispatch } from "react-redux";
import { setError, clearError } from "../store/errorSlice";
import { selectCurrentUser, clearToken } from "../store/authSlice";
import {
  Box,
  Typography,
  TextField,
  Paper,
  Container,
  LinearProgress,
  FormGroup,
  FormControlLabel,
  Checkbox,
  useTheme,
  Grid,
  IconButton,
  Divider,
  CircularProgress,
  Chip,
  Alert,
  Button,
  Tooltip,
} from "@mui/material";
import { useNavigate, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingButton } from "@mui/lab";
import HourglassBottom from "@mui/icons-material/HourglassBottom";
import Logout from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import AddCircleOutline from "@mui/icons-material/AddCircleOutline";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

const MAX_QUESTIONS = 20;
const defaultVariationConfig = {
  vary_weight: true,
  vary_style: true,
  vary_spacing: true,
  vary_size: true,
  vary_leading: true,
};

const FontTest = () => {
  const [currentVariation, setCurrentVariation] = useState(null);
  const [reaction, setReaction] = useState("");
  const [timeLeft, setTimeLeft] = useState(3600);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [studyResults, setStudyResults] = useState([]);
  const [testFinishedMessage, setTestFinishedMessage] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [variationConfig, setVariationConfig] = useState(
    defaultVariationConfig
  );
  const [customTexts, setCustomTexts] = useState([]);
  const [newText, setNewText] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const currentUser = useSelector(selectCurrentUser);
  const questionTimerRef = useRef(null);
  const isMounted = useRef(true);

  // --- Логика Жизненного Цикла и Запросов (без изменений) ---
  useEffect(() => {
    isMounted.current = true;
    dispatch(clearError());
    return () => {
      isMounted.current = false;
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [dispatch]);

  const fetchCipherWithTimeout = useCallback(
    async (config) => {
      if (!isMounted.current || isLoading) return;
      setIsLoading(true);
      setCurrentVariation(null);
      setQuestionTimeLeft(60);
      dispatch(clearError());
      try {
        const data = await getRandomCipher(config);
        if (isMounted.current) {
          if (data.all_seen) {
            setTestFinishedMessage(
              data.message || "Вы прошли все доступные вариации!"
            );
            setCurrentQuestion(MAX_QUESTIONS + 1);
          } else {
            setCurrentVariation(data);
            setTestFinishedMessage(null);
          }
        }
      } catch (error) {
        if (!isMounted.current) return;
        console.error("Font fetch error:", error);
        if (error.response?.status === 404) {
          setTestFinishedMessage("Шрифты не найдены.");
          setCurrentQuestion(MAX_QUESTIONS + 1);
        }
      } finally {
        if (isMounted.current) setIsLoading(false);
      }
    },
    [dispatch, isLoading]
  );

  useEffect(() => {
    if (
      currentUser &&
      currentQuestion === 1 &&
      !currentVariation &&
      !testFinishedMessage
    ) {
      fetchCipherWithTimeout(variationConfig);
    }
  }, [
    currentUser,
    currentQuestion,
    currentVariation,
    testFinishedMessage,
    fetchCipherWithTimeout,
    variationConfig,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isMounted.current) {
        clearInterval(timer);
        return;
      }
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let intervalId = null;
    if (
      currentVariation &&
      currentQuestion <= MAX_QUESTIONS &&
      !isLoading &&
      !testFinishedMessage
    ) {
      intervalId = setInterval(() => {
        if (!isMounted.current) {
          clearInterval(intervalId);
          return;
        }
        setQuestionTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            handleNextQuestion();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
      questionTimerRef.current = intervalId;
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [currentQuestion, currentVariation, isLoading, testFinishedMessage]); // Убрали handleNextQuestion

  const finishTestAndSave = useCallback(async () => {
    if (isSaving || !isMounted.current) return;
    setIsSaving(true);
    dispatch(clearError());
    let finalMessage = testFinishedMessage;
    if (studyResults.length === 0) {
      navigate("/", {
        state: {
          infoMessage:
            finalMessage || "Исследование завершено, но ответов не было дано.",
        },
      });
      setIsSaving(false);
      return;
    }
    try {
      const response = await saveStudy(studyResults);
      finalMessage =
        response.message ||
        finalMessage ||
        "Исследование успешно завершено и сохранено!";
      if (isMounted.current) {
        navigate("/", { state: { successMessage: finalMessage } });
      }
    } catch (error) {
      console.error("Failed to save study results:", error);
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  }, [studyResults, navigate, dispatch, isSaving, testFinishedMessage]);

  useEffect(() => {
    if (timeLeft === 0 && currentQuestion <= MAX_QUESTIONS && !isSaving) {
      dispatch(setError("Общее время тестирования истекло!"));
      finishTestAndSave();
    }
  }, [timeLeft, finishTestAndSave, dispatch, currentQuestion, isSaving]);

  useEffect(() => {
    if ((currentQuestion > MAX_QUESTIONS || testFinishedMessage) && !isSaving) {
      finishTestAndSave();
    }
  }, [currentQuestion, finishTestAndSave, isSaving, testFinishedMessage]);

  const handleNextQuestion = useCallback(
    (skipSave = false) => {
      if (!isMounted.current || isLoading) return;
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
        questionTimerRef.current = null;
      }
      if (!skipSave && currentVariation) {
        const currentReaction = reaction.trim() || "[skipped]";
        setStudyResults((prev) => [
          ...prev,
          {
            cipher_id: currentVariation.cipher_id,
            reaction_description: currentReaction,
            font_weight: currentVariation.font_weight,
            font_style: currentVariation.font_style,
            letter_spacing: currentVariation.letter_spacing,
            font_size: currentVariation.font_size,
            line_height: currentVariation.line_height,
          },
        ]);
      }
      setReaction("");
      setCustomTexts([]);
      setNewText("");
      if (currentQuestion < MAX_QUESTIONS && !testFinishedMessage) {
        if (isMounted.current) {
          setCurrentQuestion((prev) => prev + 1);
          fetchCipherWithTimeout(variationConfig);
        }
      } else if (!testFinishedMessage) {
        if (isMounted.current) {
          setCurrentQuestion((prev) => prev + 1);
        }
      }
    },
    [
      reaction,
      currentVariation,
      currentQuestion,
      isLoading,
      testFinishedMessage,
      fetchCipherWithTimeout,
      variationConfig,
    ]
  );

  // --- Функции Обработки Взаимодействия ---
  const handleVariationChange = (event) => {
    setVariationConfig({
      ...variationConfig,
      [event.target.name]: event.target.checked,
    });
  };
  const handleLogout = () => {
    dispatch(clearToken());
    navigate("/login");
  };
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const handleAddCustomText = () => {
    if (newText.trim() && customTexts.length < 5) {
      setCustomTexts((prev) => [...prev, newText.trim()]);
      setNewText("");
    }
  };
  // Новая функция для удаления кастомного текста
  const handleDeleteCustomText = (indexToDelete) => {
    setCustomTexts((prev) =>
      prev.filter((_, index) => index !== indexToDelete)
    );
  };

  // --- Рендеринг Заглушек ---
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (testFinishedMessage && !isSaving) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: "center" }}>
        {" "}
        <Paper elevation={3} sx={{ p: 4 }}>
          {" "}
          <Typography variant="h5" gutterBottom>
            Тестирование завершено!
          </Typography>{" "}
          <Typography variant="body1" sx={{ my: 2 }}>
            {testFinishedMessage}
          </Typography>{" "}
          <Button variant="contained" onClick={() => navigate("/")}>
            На главную
          </Button>{" "}
        </Paper>{" "}
      </Container>
    );
  }
  if (
    isSaving ||
    (currentQuestion > MAX_QUESTIONS && !isSaving && !testFinishedMessage)
  ) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: "center" }}>
        {" "}
        <Paper elevation={3} sx={{ p: 4 }}>
          {" "}
          <Typography variant="h5" gutterBottom>
            {" "}
            {isSaving ? "Сохранение..." : "Завершение..."}{" "}
          </Typography>{" "}
          <CircularProgress sx={{ my: 2 }} />{" "}
          {!isSaving && <Typography>Подготовка...</Typography>}{" "}
        </Paper>{" "}
      </Container>
    );
  }

  // --- Стили и Данные для Отображения ---
  const textStyles = currentVariation
    ? {
        fontFamily: currentVariation.result || "sans-serif",
        fontWeight: currentVariation.font_weight || 400,
        fontStyle: currentVariation.font_style || "normal",
        letterSpacing: `${currentVariation.letter_spacing || 0}px`,
        fontSize: `${currentVariation.font_size || 16}pt`,
        lineHeight: currentVariation.line_height || 1.5,
        transition: "all 0.3s ease-out",
        wordBreak: "break-word", // Добавили перенос слов
      }
    : {};
  const variationDisplayName = currentVariation
    ? `${currentVariation.result} ${currentVariation.font_weight} ${
        currentVariation.font_style !== "normal"
          ? currentVariation.font_style
          : ""
      } LS:${currentVariation.letter_spacing} SZ:${
        currentVariation.font_size
      } LH:${currentVariation.line_height}`
        .replace(/\s+/g, " ")
        .trim()
    : "Загрузка...";

  // --- Основной Рендеринг Компонента ---
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {" "}
      {/* Уменьшили вертикальный отступ */}
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography
          variant="h2"
          component="h1"
          sx={{
            fontWeight: 700,
            color: "primary.main",
            fontSize: { xs: "1.6rem", sm: "2rem", md: "2.2rem" },
          }}
        >
          {" "}
          Тестирование шрифтов{" "}
        </Typography>
        <Tooltip title="Настройки вариаций">
          <IconButton onClick={() => setShowSettings(!showSettings)}>
            <SettingsIcon color={showSettings ? "primary" : "action"} />
          </IconButton>
        </Tooltip>
      </Box>
      <AnimatePresence>
        {" "}
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {" "}
            <Paper sx={{ p: 1.5, mb: 2, bgcolor: "grey.50" }} elevation={0}>
              {" "}
              <Typography variant="caption" display="block" gutterBottom>
                Варьировать:
              </Typography>{" "}
              <FormGroup row sx={{ flexWrap: "wrap", gap: 0.5 }}>
                {" "}
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={variationConfig.vary_weight}
                      onChange={handleVariationChange}
                      name="vary_weight"
                    />
                  }
                  label="Начертание"
                />{" "}
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={variationConfig.vary_style}
                      onChange={handleVariationChange}
                      name="vary_style"
                    />
                  }
                  label="Стиль"
                />{" "}
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={variationConfig.vary_spacing}
                      onChange={handleVariationChange}
                      name="vary_spacing"
                    />
                  }
                  label="Трекинг"
                />{" "}
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={variationConfig.vary_size}
                      onChange={handleVariationChange}
                      name="vary_size"
                    />
                  }
                  label="Размер"
                />{" "}
                <FormControlLabel
                  sx={{ mr: 1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={variationConfig.vary_leading}
                      onChange={handleVariationChange}
                      name="vary_leading"
                    />
                  }
                  label="Интерлиньяж"
                />{" "}
              </FormGroup>{" "}
            </Paper>{" "}
          </motion.div>
        )}{" "}
      </AnimatePresence>
      <Paper elevation={1} sx={{ p: 1.5, mb: 2 }}>
        {" "}
        {/* Уменьшили паддинг */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography variant="subtitle1" component="div">
            {" "}
            Вопрос {Math.min(currentQuestion, MAX_QUESTIONS)}/{MAX_QUESTIONS}{" "}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {" "}
            <Chip
              icon={<HourglassBottom />}
              label={`${formatTime(questionTimeLeft)} / ${formatTime(
                timeLeft
              )}`}
              variant="outlined"
              size="small"
            />{" "}
            <Typography
              variant="caption"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {currentUser?.username}
            </Typography>{" "}
            <IconButton
              onClick={handleLogout}
              title="Выйти"
              color="inherit"
              size="small"
            >
              <Logout />
            </IconButton>{" "}
          </Box>
        </Box>
        <LinearProgress
          variant="determinate"
          value={((currentQuestion - 1) / MAX_QUESTIONS) * 100}
          sx={{ mt: 1 }}
        />
      </Paper>
      <Grid container spacing={2}>
        {" "}
        {/* Уменьшили spacing */}
        <Grid item xs={12} md={5} lg={4}>
          {/* Левая панель с удалением */}
          <Paper
            elevation={3}
            sx={{
              p: 2,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="h6" sx={{ fontSize: "1.1rem", mb: 1 }}>
              Примеры текста
            </Typography>
            <Divider sx={{ mb: 1.5 }} />
            <Box
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                mb: 1.5,
                maxHeight: { xs: "25vh", md: "none" },
              }}
            >
              {" "}
              {/* Ограничение высоты и прокрутка */}
              {currentVariation && !isLoading && (
                <>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
                  >
                    Стандартные:
                  </Typography>
                  {[
                    "Быстрая коричневая лиса...",
                    "Съешь ещё этих мягких...",
                    "The quick brown fox...",
                  ].map((text, i) => (
                    <Typography
                      key={`preset-${i}`}
                      sx={{ ...textStyles, fontSize: "11pt", mb: 1, p: 0.5 }}
                    >
                      {text}
                    </Typography>
                  ))}
                  <Divider sx={{ my: 1.5 }} />
                  {customTexts.length > 0 && (
                    <>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          display: "block",
                          mb: 0.5,
                        }}
                      >
                        Ваши:
                      </Typography>
                      {customTexts.map((text, i) => (
                        <Box
                          key={`custom-${i}`}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            mb: 0.5,
                            bgcolor: "grey.100",
                            borderRadius: 1,
                          }}
                        >
                          <Typography
                            sx={{
                              ...textStyles,
                              fontSize: "11pt",
                              p: 0.5,
                              flexGrow: 1,
                            }}
                          >
                            {" "}
                            {text}{" "}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteCustomText(i)}
                            aria-label="Удалить пример"
                          >
                            <DeleteOutline fontSize="inherit" />
                          </IconButton>
                        </Box>
                      ))}
                      <Divider sx={{ my: 1.5 }} />
                    </>
                  )}
                </>
              )}
              {isLoading && (
                <Box sx={{ display: "flex", justifyContent: "center", pt: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
              {!currentVariation &&
                !isLoading &&
                currentQuestion <= MAX_QUESTIONS && (
                  <Typography variant="body2">Ожидание вариации...</Typography>
                )}
            </Box>
            {currentVariation && !isLoading && (
              <Box
                sx={{
                  mt: "auto",
                  pt: 1.5,
                  borderTop: "1px solid",
                  borderColor: "divider",
                }}
              >
                {" "}
                <Box sx={{ display: "flex", gap: 1 }}>
                  {" "}
                  <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    label="Свой текст"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyPress={(e) =>
                      e.key === "Enter" && handleAddCustomText()
                    }
                  />{" "}
                  <IconButton
                    color="primary"
                    onClick={handleAddCustomText}
                    disabled={!newText.trim() || customTexts.length >= 5}
                    aria-label="Добавить текст"
                  >
                    {" "}
                    <AddCircleOutline />{" "}
                  </IconButton>{" "}
                </Box>{" "}
                <Typography
                  variant="caption"
                  display="block"
                  sx={{ textAlign: "right", mt: 0.5 }}
                >
                  {" "}
                  {customTexts.length}/5{" "}
                </Typography>{" "}
              </Box>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={7} lg={8}>
          {/* Правая панель */}
          <AnimatePresence mode="wait">
            <motion.div
              key={
                currentVariation?.cipher_id +
                  JSON.stringify(currentVariation) || currentQuestion
              }
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Paper
                elevation={6}
                sx={{
                  p: { xs: 2, sm: 3 },
                  borderRadius: 2,
                  minHeight: { xs: 350, md: 400 },
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                {" "}
                {/* Уменьшили паддинг и gap */}
                {isLoading ? (
                  <Box
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CircularProgress size={50} />
                  </Box>
                ) : currentVariation ? (
                  <>
                    <Box
                      sx={{
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1.5,
                      }}
                    >
                      {" "}
                      {/* Уменьшили gap */}
                      <Typography
                        variant="h4"
                        sx={{
                          ...textStyles,
                          fontSize: {
                            xs: "1.8rem",
                            sm: "2.2rem",
                            md: "2.5rem",
                          },
                          textAlign: "center",
                        }}
                      >
                        {" "}
                        {/* Адаптивный размер */}
                        Этот текст написан вариацией шрифта
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary", textAlign: "center" }}
                      >
                        ({variationDisplayName})
                      </Typography>
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Опишите ваши впечатления"
                        variant="outlined"
                        value={reaction}
                        onChange={(e) => setReaction(e.target.value)}
                        sx={{
                          "& .MuiOutlinedInput-root": { borderRadius: 2 },
                          mt: 1,
                        }}
                        placeholder="Оставьте поле пустым, чтобы пропустить вопрос"
                      />{" "}
                      {/* Уменьшили minRows */}
                    </Box>
                    <LoadingButton
                      variant="contained"
                      size="large"
                      fullWidth
                      onClick={() => handleNextQuestion()}
                      loading={isSaving}
                      disabled={isLoading || isSaving}
                      sx={{ py: 1.2, borderRadius: 5, fontSize: "1rem" }}
                    >
                      {" "}
                      {/* Уменьшили паддинг и размер шрифта */}
                      {currentQuestion < MAX_QUESTIONS
                        ? reaction.trim()
                          ? "Ответить и продолжить"
                          : "Пропустить"
                        : "Завершить"}
                    </LoadingButton>{" "}
                  </>
                ) : (
                  <Box
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {" "}
                    <Typography variant="h6" color="text.secondary">
                      Ожидание загрузки вариации...
                    </Typography>{" "}
                    <CircularProgress size={30} sx={{ mt: 1 }} />{" "}
                  </Box>
                )}
              </Paper>
            </motion.div>
          </AnimatePresence>
        </Grid>
      </Grid>
    </Container>
  );
};

export default FontTest;

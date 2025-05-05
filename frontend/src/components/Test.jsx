import React, { useState, useEffect, useCallback } from "react";
import { getRandomCipher, saveStudy } from "../api/api";
import { useDispatch } from "react-redux";
import { setError } from "../store/errorSlice";
import {
    Box,
    Typography,
    TextField,
    Paper,
    Container,
    LinearProgress,
    useTheme,
    Grid,
    IconButton,
    Divider,
    CircularProgress,
    Chip,
    Alert
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LoadingButton } from "@mui/lab";
import HourglassBottom from "@mui/icons-material/HourglassBottom";
import Logout from "@mui/icons-material/Logout";
import AddCircleOutline from "@mui/icons-material/AddCircleOutline";

const MAX_QUESTIONS = 100;

const FontTest = () => {
    const [cipher, setCipher] = useState(null);
    const [reaction, setReaction] = useState("");
    const [timeLeft, setTimeLeft] = useState(3600);
    const [questionTimeLeft, setQuestionTimeLeft] = useState(60);
    const [fontTimeout, setFontTimeout] = useState(60);
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuestion, setCurrentQuestion] = useState(1);
    const [customTexts, setCustomTexts] = useState([]);
    const [newText, setNewText] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const theme = useTheme();

    const fetchCipherWithTimeout = useCallback(async () => {
        setIsLoading(true);
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 60000)
            );

            const data = await Promise.race([
                getRandomCipher(),
                timeoutPromise
            ]);

            setCipher(data);
            setFontTimeout(60);
            setQuestionTimeLeft(60);
        } catch (error) {
            if (error.message === "Timeout") {
                dispatch(setError("Шрифт не загружен вовремя, пробуем следующий"));
                setFontTimeout(prev => prev - 1);
                if (fontTimeout > 0) {
                    fetchCipherWithTimeout();
                }
            } else {
                dispatch(setError("Не удалось загрузить шрифт"));
            }
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, fontTimeout]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const questionTimer = setInterval(() => {
            setQuestionTimeLeft(prev => {
                if (prev <= 1) {
                    handleNextQuestion();
                    return 60;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(questionTimer);
    }, [currentQuestion]);

    useEffect(() => {
        if (timeLeft === 0) {
            navigate("/timeout");
        }
    }, [timeLeft, navigate]);

    useEffect(() => {
        if (currentQuestion > MAX_QUESTIONS) {
            navigate("/", { state: { message: "Исследование завершено! Спасибо за участие!" } });
        }
    }, [currentQuestion, navigate]);

    useEffect(() => {
        fetchCipherWithTimeout();
    }, [fetchCipherWithTimeout]);

    const handleNextQuestion = async () => {
        try {
            if (reaction.trim()) {
                await saveStudy({
                    user_id: 1,
                    cipher_id: cipher.id,
                    reaction_description: reaction,
                });
            }
            setReaction("");
            setCurrentQuestion(prev => prev + 1);
            fetchCipherWithTimeout();
        } catch (error) {
            dispatch(setError("Не удалось сохранить исследование"));
        }
    };

    const handleAddCustomText = () => {
        if (newText.trim() && customTexts.length < 5) {
            setCustomTexts(prev => [...prev, newText]);
            setNewText("");
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Заголовок и статус-бар */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h2" component="h1" sx={{
                    fontWeight: 700,
                    color: theme.palette.primary.main,
                    textAlign: 'center',
                    mb: 2
                }}>
                    Тестирование шрифтов
                </Typography>

                <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6">
                            Вопрос {currentQuestion} из {MAX_QUESTIONS}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <HourglassBottom />
                            <Typography variant="body1">
                                {formatTime(questionTimeLeft)} / {formatTime(timeLeft)}
                            </Typography>

                            <IconButton
                                onClick={() => navigate("/")}
                                color="inherit"
                            >
                                <Logout />
                            </IconButton>
                        </Box>
                    </Box>

                    <LinearProgress
                        variant="determinate"
                        value={(currentQuestion / MAX_QUESTIONS) * 100}
                        sx={{ mt: 1 }}
                    />
                </Paper>
            </Box>

            <Grid container spacing={4}>
                {/* Боковая панель с примерами текста */}
                <Grid item xs={12} md={4}>
                    <Paper elevation={6} sx={{ p: 3, height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Примеры текста
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <Box sx={{ mb: 3 }}>
                            {["Быстрая коричневая лиса...", "Съешь ещё этих мягких...", "The quick brown fox..."].map((text, i) => (
                                <Chip
                                    key={i}
                                    label={text}
                                    sx={{
                                        fontFamily: cipher?.font,
                                        m: 0.5,
                                        cursor: 'pointer',
                                        '&:hover': { transform: 'scale(1.05)' }
                                    }}
                                    onClick={() => setNewText(text)}
                                />
                            ))}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Добавьте свой текст"
                                value={newText}
                                onChange={(e) => setNewText(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomText()}
                            />

                            <IconButton
                                color="primary"
                                onClick={handleAddCustomText}
                                disabled={!newText.trim() || customTexts.length >= 5}
                            >
                                <AddCircleOutline />
                            </IconButton>
                        </Box>

                        <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
                            {customTexts.map((text, i) => (
                                <Typography
                                    key={i}
                                    sx={{
                                        fontFamily: cipher?.font,
                                        mb: 1,
                                        p: 1,
                                        borderRadius: 1,
                                        bgcolor: theme.palette.grey[100],
                                        cursor: 'pointer',
                                        '&:hover': {
                                            bgcolor: theme.palette.grey[200]
                                        }
                                    }}
                                    onClick={() => setNewText(text)}
                                >
                                    {text}
                                </Typography>
                            ))}
                        </Box>
                    </Paper>
                </Grid>

                {/* Основной блок с тестированием */}
                <Grid item xs={12} md={8}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={cipher?.id || 'loading'}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Paper elevation={6} sx={{
                                p: 4,
                                borderRadius: 4,
                                background: theme.palette.background.paper,
                                minHeight: 400,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3
                            }}>
                                {isLoading ? (
                                    <Box sx={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexDirection: 'column',
                                        gap: 2
                                    }}>
                                        <CircularProgress size={60} />
                                        <Typography variant="body1">
                                            Поиск следующего шрифта... ({fontTimeout}s)
                                        </Typography>
                                        <LinearProgress
                                            variant="determinate"
                                            value={(60 - fontTimeout) * (100 / 60)}
                                            sx={{ width: '50%' }}
                                        />
                                    </Box>
                                ) : (
                                    <>
                                        <Box sx={{
                                            flex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: 3
                                        }}>
                                            <Typography
                                                variant="h4"
                                                sx={{
                                                    fontFamily: cipher?.font,
                                                    fontSize: '2.5rem',
                                                    textAlign: 'center',
                                                    transition: 'font-family 0.3s ease'
                                                }}
                                            >
                                                "Этот текст написан шрифтом {cipher?.font}"
                                            </Typography>

                                            <TextField
                                                fullWidth
                                                multiline
                                                minRows={4}
                                                label="Опишите ваши впечатления"
                                                variant="outlined"
                                                value={reaction}
                                                onChange={(e) => setReaction(e.target.value)}
                                                sx={{
                                                    fontFamily: cipher?.font,
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: 3,
                                                        transition: 'all 0.3s ease'
                                                    }
                                                }}
                                            />
                                        </Box>

                                        <LoadingButton
                                            variant="contained"
                                            size="large"
                                            fullWidth
                                            onClick={handleNextQuestion}
                                            loading={isLoading}
                                            loadingIndicator="Сохранение..."
                                            sx={{
                                                py: 1.5,
                                                borderRadius: 3,
                                                fontSize: '1.1rem',
                                                textTransform: 'none'
                                            }}
                                        >
                                            {questionTimeLeft > 0 ? 'Ответить и продолжить' : 'Время вышло! Продолжить'}
                                        </LoadingButton>
                                    </>
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
import React, { useEffect, useState, useRef } from 'react';
import { getGraphData } from '../api/api';
import { useDispatch } from 'react-redux';
import { setError } from '../store/errorSlice';
import { Box, Typography, CircularProgress, Paper, Container } from '@mui/material';
import { Network } from 'vis-network/standalone/umd/vis-network.min';
import 'vis-network/styles/vis-network.css';

const GraphPage = () => {
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();
    const visJsRef = useRef(null);
    const networkInstanceRef = useRef(null);
    // Состояние для хранения размеров контейнера
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    // Эффект для отслеживания размера контейнера
    useEffect(() => {
        // Функция для обновления размеров
        const updateSize = () => {
            if (visJsRef.current) {
                setContainerSize({
                    width: visJsRef.current.offsetWidth,
                    height: visJsRef.current.offsetHeight,
                });
            }
        };

        // Устанавливаем начальный размер после монтирования и когда loading станет false
        if (!loading && visJsRef.current) {
            updateSize();
        }

        // Добавляем слушатель изменения размера окна, чтобы обновлять граф при ресайзе
        window.addEventListener('resize', updateSize);

        // Очистка слушателя при размонтировании
        return () => window.removeEventListener('resize', updateSize);

    }, [loading]); // Зависимость от loading, чтобы получить размер после скрытия лоадера


    useEffect(() => {
        const fetchGraphData = async () => {
            try {
                setLoading(true);
                const response = await getGraphData();
                const processedData = processData(response);
                setGraphData(processedData);
            } catch (error) {
                console.error("Graph data fetch error:", error);
                dispatch(setError('Не удалось загрузить данные для графа'));
                setGraphData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchGraphData();

        return () => {
            if (networkInstanceRef.current) {
                networkInstanceRef.current.destroy();
                networkInstanceRef.current = null;
            }
        };
    }, [dispatch]);

    const processData = (data) => {
        const nodesMap = new Map();
        const nodeDegrees = new Map();
        const linkCountMap = new Map(); // Карта для подсчета уникальных связей (source -> target)

        // Шаг 1: Создаем узлы и считаем частоту связей
        data.forEach((item) => {
            const sourceId = item.name;
            const targetId = item.description;

            // Добавляем/обновляем узлы
            if (!nodesMap.has(sourceId)) {
                nodesMap.set(sourceId, { id: sourceId, label: sourceId, group: 1 });
                nodeDegrees.set(sourceId, 0);
            }
            if (!nodesMap.has(targetId)) {
                nodesMap.set(targetId, { id: targetId, label: targetId, group: 2 });
                nodeDegrees.set(targetId, 0);
            }

            // Увеличиваем степень узлов
            nodeDegrees.set(sourceId, nodeDegrees.get(sourceId) + 1);
            nodeDegrees.set(targetId, nodeDegrees.get(targetId) + 1);

            // Считаем уникальные связи
            const linkKey = `${sourceId}--->${targetId}`; // Уникальный ключ для связи
            linkCountMap.set(linkKey, (linkCountMap.get(linkKey) || 0) + 1);
        });

        // Шаг 2: Формируем массив узлов с размером на основе степени
        const nodes = Array.from(nodesMap.values()).map(node => ({
            ...node,
            value: 1 + (nodeDegrees.get(node.id) || 0), // Базовый размер + степень
            // Добавляем title для тултипа при наведении
            title: `Узел: ${node.label}<br>Связей: ${nodeDegrees.get(node.id) || 0}`
        }));

        // Шаг 3: Формируем массив ребер с количеством связей в метке
        const links = Array.from(linkCountMap.entries()).map(([linkKey, count]) => {
            const [from, to] = linkKey.split('--->');
            return {
                from,
                to,
                label: String(count), // Метка с количеством связей
                value: count,         // Значение для возможного масштабирования толщины ребра
                // Добавляем title для тултипа при наведении на ребро
                title: `Связь: ${from} - ${to}<br>Количество: ${count}`
            };
        });

        return { nodes, links };
    };

    // useEffect для инициализации и обновления графа vis-network
    useEffect(() => {
        // Инициализируем граф только если есть данные, контейнер отрисован,
        // и его размеры определены (больше 0)
        if (graphData && visJsRef.current && !loading && containerSize.width > 0 && containerSize.height > 0) {
            if (networkInstanceRef.current) {
                networkInstanceRef.current.destroy();
                networkInstanceRef.current = null;
            }

            const data = {
                nodes: graphData.nodes,
                edges: graphData.links,
            };

            const options = {
                // Передаем явные размеры контейнера
                width: `${containerSize.width}px`,
                height: `${containerSize.height}px`,
                nodes: {
                    shape: 'dot',
                    scaling: {
                        min: 10,
                        max: 50,
                        label: { enabled: true, min: 10, max: 25 }
                    },
                    font: { size: 12, face: 'Arial' },
                    borderWidth: 1,
                },
                edges: {
                    // Настройки для отображения метки (количества связей)
                    font: {
                        color: '#555555', // Цвет текста метки
                        size: 10,       // Размер шрифта метки
                        strokeWidth: 0, // Без обводки текста
                        align: 'middle', // Выравнивание по центру ребра
                    },
                    // Масштабирование толщины ребра на основе value (количества связей)
                    scaling:{
                        min: 1,
                        max: 8,
                        label: { enabled: false } // Отключаем масштабирование текста метки, управляем им через font.size
                    },
                    width: 1, // Базовая толщина, будет масштабироваться
                    smooth: {
                        enabled: true,
                        type: "continuous",
                        roundness: 0.5
                    },
                    color: {
                        color: '#cccccc', // Цвет ребра
                        highlight: '#aeaeae',
                        hover: '#848484',
                        inherit: false // Не наследовать цвет от узлов
                    },
                    arrows: { to: { enabled: false } } // Отключаем стрелки, если не нужны
                },
                physics: {
                    enabled: true,
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {
                        gravitationalConstant: -40, // Можно немного увеличить отталкивание
                        centralGravity: 0.015,
                        springLength: 100,
                        springConstant: 0.08,
                        damping: 0.6, // Увеличить демпфирование для более быстрой стабилизации
                        avoidOverlap: 0.6 // Увеличить избегание наложений
                    },
                    stabilization: {
                        enabled: true,
                        iterations: 1000,
                        updateInterval: 25, // Чаще обновлять
                        onlyDynamicEdges: false,
                        fit: true // Масштабировать граф в контейнер после стабилизации
                    }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200,
                    dragNodes: true,
                    dragView: true,
                    zoomView: true
                },
                groups: {
                    1: { color: { background: '#97C2FC', border: '#2B7CE9' }, /* Шрифты */ },
                    2: { color: { background: '#FFA500', border: '#FF8C00' }, /* Реакции (оранжевый) */ }
                    // Можно настроить цвета групп
                    // 1: { color: { background: '#C1E1C1', border: '#8FBC8F' } }, // Пастельно-зеленый
                    // 2: { color: { background: '#FFDAB9', border: '#FFA07A' } }  // Персиковый
                },
            };

            try {
                const network = new Network(visJsRef.current, data, options);
                networkInstanceRef.current = network;

                network.on("stabilizationIterationsDone", function () {
                    console.log("Graph stabilization finished");
                    // Можно отключить физику после стабилизации для улучшения производительности
                    // network.setOptions( { physics: false } );
                });

                // Обработчик ошибок самой библиотеки vis-network
                network.on('error', (err) => {
                    console.error('vis-network error:', err);
                    dispatch(setError('Ошибка при работе с графом vis-network'));
                });

            } catch (err) {
                console.error("Failed to create vis-network:", err);
                dispatch(setError('Не удалось создать визуализацию графа'));
            }

        } else if (!loading && !graphData && visJsRef.current) {
            if (networkInstanceRef.current) {
                networkInstanceRef.current.destroy();
                networkInstanceRef.current = null;
            }
            visJsRef.current.innerHTML = '<Typography sx={{ textAlign: "center", mt: 4 }}>Не удалось отобразить граф. Данные не загружены.</Typography>';
        }
        // Перерисовываем граф при изменении данных, статуса загрузки или РАЗМЕРОВ контейнера
    }, [graphData, loading, containerSize, dispatch]);

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            {/* Обертка Paper теперь не задает жесткую высоту, а подстраивается */}
            <Paper elevation={3} sx={{
                p: 4,
                height: '85vh', // Сохраняем желаемую высоту для Paper
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden' // Предотвращаем выход содержимого за границы Paper
            }}>
                <Typography variant="h3" gutterBottom align="center" sx={{ flexShrink: 0 }}> {/* Заголовок не сжимается */}
                    Визуализация реакций на шрифты (vis-network)
                </Typography>

                {/* Контейнер для лоадера или графа */}
                <Box sx={{ flexGrow: 1, position: 'relative', overflow: 'hidden' /* Добавлено */ }}>
                    {loading && (
                        <Box display="flex" justifyContent="center" alignItems="center" sx={{ height: '100%' }}>
                            <CircularProgress size={60} />
                        </Box>
                    )}

                    {/* Контейнер для графа vis-network */}
                    {/* Убрали условный рендеринг самого div, он нужен для измерения */}
                    <Box
                        ref={visJsRef}
                        sx={{
                            height: '100%',
                            width: '100%',
                            // border: '1px solid lightgray', // Можно оставить для отладки
                            visibility: loading ? 'hidden' : 'visible' // Скрываем, но оставляем в DOM для измерения
                        }}
                    >
                        {/* Сообщение об ошибке или пустом графе рендерится внутри, если нужно */}
                        {!loading && !graphData && (
                            <Typography sx={{ textAlign: 'center', mt: 4 }}>
                                Не удалось отобразить граф. Данные не загружены.
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Paper>
        </Container>
    );
};

export default GraphPage;
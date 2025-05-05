import React, { useEffect, useState, useRef, useCallback } from "react";
import { getGraphData } from "../api/api";
import { useDispatch } from "react-redux";
import { setError, clearError } from "../store/errorSlice";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Container,
} from "@mui/material";
import { Network } from "vis-network/standalone/umd/vis-network.min";
import "vis-network/styles/vis-network.css";

const GraphPage = () => {
  const [graphData, setGraphData] = useState(null); // Содержит { nodes: [], links: [] }
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const dispatch = useDispatch();
  const visJsRef = useRef(null);
  const networkInstanceRef = useRef(null);
  const containerRef = useRef(null);

  const processData = useCallback((data) => {
    const nodesMap = new Map();
    const nodeDegrees = new Map();
    const linkCountMap = new Map();

    if (!Array.isArray(data) || data.length === 0) {
      return { nodes: [], links: [] };
    }

    data.forEach((item) => {
      if (!item.name || !item.description) {
        return;
      }
      const sourceId = item.name;
      const targetId = item.description;
      const count = item.count || 1;

      if (!nodesMap.has(sourceId)) {
        nodesMap.set(sourceId, {
          id: sourceId,
          label: sourceId,
          group: 1,
          font: { multi: "html" },
        });
        nodeDegrees.set(sourceId, 0);
      }
      if (!nodesMap.has(targetId)) {
        const label =
          targetId.length > 50 ? targetId.substring(0, 47) + "..." : targetId;
        nodesMap.set(targetId, {
          id: targetId,
          label: `<i>${label}</i>`,
          group: 2,
          font: { multi: "html", face: "Georgia", size: 11 },
        });
        nodeDegrees.set(targetId, 0);
      }

      nodeDegrees.set(sourceId, nodeDegrees.get(sourceId) + count);
      nodeDegrees.set(targetId, nodeDegrees.get(targetId) + count);

      const linkKey = `${sourceId}--->${targetId}`;
      linkCountMap.set(linkKey, count);
    });

    const nodes = Array.from(nodesMap.values()).map((node) => ({
      ...node,
      value: 1 + Math.log1p(nodeDegrees.get(node.id) || 0) * 5,
      title: `<b>${node.group === 1 ? "Шрифт" : "Реакция"}:</b> ${
        node.id
      }<br>Связей (взвеш.): ${nodeDegrees.get(node.id) || 0}`,
    }));

    // Имя переменной `links` остается, но это просто массив ребер
    const links = Array.from(linkCountMap.entries()).map(([linkKey, count]) => {
      const [from, to] = linkKey.split("--->");
      return {
        from,
        to,
        label: String(count),
        value: count,
        title: `<b>Связь:</b> ${from} - ${to}<br>Количество: ${count}`,
      };
    });

    // Возвращаем объект с nodes и links
    return { nodes, links };
  }, []);

  useEffect(() => {
    const fetchGraphData = async () => {
      setLoading(true);
      setErrorState(null);
      dispatch(clearError());
      try {
        const response = await getGraphData();
        const processedData = processData(response);
        setGraphData(processedData); // Сохраняем { nodes, links }
      } catch (error) {
        console.error("Graph data fetch error:", error);
        const errorMsg = "Не удалось загрузить данные для графа";
        setErrorState(errorMsg);
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
  }, [dispatch, processData]);

  useEffect(() => {
    let network = null;
    let resizeObserver = null;

    // Проверяем наличие graphData и обязательных полей nodes и links
    if (
      graphData &&
      graphData.nodes &&
      graphData.links &&
      visJsRef.current &&
      !loading &&
      !errorState
    ) {
      const options = {
        width: "100%",
        height: "100%",
        nodes: {
          shape: "dot",
          scaling: {
            min: 8,
            max: 40,
            label: { enabled: true, min: 10, max: 25 },
          },
          font: { size: 12, face: "Arial", multi: "html" },
          borderWidth: 1.5,
          borderWidthSelected: 3,
          color: {
            highlight: { border: "#e1a200", background: "#fff6df" },
            hover: { border: "#7c5a00", background: "#fffbed" },
          },
        },
        edges: {
          font: { color: "#555555", size: 10, strokeWidth: 0, align: "middle" },
          scaling: { min: 0.5, max: 6, label: { enabled: false } },
          width: 1, // Базовая ширина ребра
          smooth: { enabled: true, type: "continuous", roundness: 0.5 },
          color: {
            color: "#aaaaaa",
            highlight: "#777777",
            hover: "#555555",
            inherit: false,
          }, // Сделали цвет чуть темнее
          arrows: { to: { enabled: false } },
          hoverWidth: function (width) {
            return width * 1.5;
          },
          selectionWidth: function (width) {
            return width * 1.8;
          },
        },
        physics: {
          enabled: true,
          solver: "forceAtlas2Based",
          forceAtlas2Based: {
            gravitationalConstant: -45,
            centralGravity: 0.01,
            springLength: 120,
            springConstant: 0.07,
            damping: 0.7,
            avoidOverlap: 0.8,
          },
          stabilization: {
            enabled: true,
            iterations: 500,
            updateInterval: 25,
            onlyDynamicEdges: false,
            fit: true,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 250,
          dragNodes: true,
          dragView: true,
          zoomView: true,
          navigationButtons: true,
          keyboard: true,
        },
        groups: {
          1: {
            color: { background: "#97C2FC", border: "#2B7CE9" },
            shape: "ellipse",
          },
          2: {
            color: { background: "#FFA500", border: "#FF8C00" },
            shape: "box",
            font: { color: "#333" },
          },
        },
        layout: { improvedLayout: true },
      };

      try {
        // ---- ИЗМЕНЕНИЕ ЗДЕСЬ ----
        // Создаем новый объект для vis-network с правильными ключами
        const networkData = {
          nodes: graphData.nodes,
          edges: graphData.links, // Используем ключ 'edges' и передаем массив 'links'
        };
        network = new Network(visJsRef.current, networkData, options);
        // ------------------------

        networkInstanceRef.current = network;
        network.on("stabilizationIterationsDone", () =>
          console.log("Graph stabilization finished.")
        );
        network.on("error", (err) => {
          console.error("vis-network error:", err);
          setErrorState("Ошибка при отрисовке графа");
          dispatch(setError("Ошибка при работе с графом vis-network"));
        });

        if (containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            if (networkInstanceRef.current) {
              networkInstanceRef.current.redraw();
              networkInstanceRef.current.fit();
            }
          });
          resizeObserver.observe(containerRef.current);
        }
      } catch (err) {
        console.error("Failed to create vis-network:", err);
        setErrorState("Не удалось создать визуализацию графа");
        dispatch(setError("Не удалось создать визуализацию графа"));
      }
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
      }
    };
    // Добавили graphData в зависимости, чтобы useEffect сработал при получении данных
  }, [graphData, loading, errorState, dispatch]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Paper
        ref={containerRef}
        elevation={3}
        sx={{
          p: { xs: 1, sm: 2, md: 4 },
          height: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          align="center"
          sx={{ flexShrink: 0, fontSize: { xs: "1.5rem", sm: "2rem" } }}
        >
          Визуализация реакций на шрифты
        </Typography>
        <Box
          sx={{
            flexGrow: 1,
            position: "relative",
            border: "1px solid #eee",
            borderRadius: 1,
            overflow: "hidden",
          }}
        >
          {loading && (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{
                height: "100%",
                position: "absolute",
                width: "100%",
                zIndex: 1,
                backgroundColor: "rgba(255, 255, 255, 0.7)",
              }}
            >
              <CircularProgress size={60} />
            </Box>
          )}
          {errorState && !loading && (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              sx={{ height: "100%" }}
            >
              <Typography color="error">{errorState}</Typography>
            </Box>
          )}
          {!loading &&
            graphData &&
            graphData.nodes.length === 0 &&
            !errorState && (
              <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                sx={{ height: "100%" }}
              >
                <Typography sx={{ textAlign: "center", mt: 4 }}>
                  Нет данных для отображения графа.
                </Typography>
              </Box>
            )}
          {/* Контейнер для графа */}
          <Box
            ref={visJsRef}
            sx={{
              height: "100%",
              width: "100%",
              visibility: loading || errorState ? "hidden" : "visible",
            }}
          />
        </Box>
      </Paper>
    </Container>
  );
};

export default GraphPage;

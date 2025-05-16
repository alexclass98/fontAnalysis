import React, { useEffect, useState, useRef, useCallback } from "react";
import { getGraphData, findAssociationsByReaction } from "../api/api";
import { useDispatch } from "react-redux";
import { setError, clearError } from "../store/errorSlice";
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Container,
  Grid,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Chip,
  Button,
  Alert,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Checkbox,
  Switch,
  Tooltip,
} from "@mui/material";
import { LoadingButton } from "@mui/lab";
import SearchIcon from "@mui/icons-material/Search";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import LanguageIcon from "@mui/icons-material/Language";
import StyleIcon from "@mui/icons-material/Style";
import { Network } from "vis-network/standalone/umd/vis-network.min";
import "vis-network/styles/vis-network.css";

const FILTER_HIGHLIGHT_STYLE = {
  color: {
    border: "#D32F2F",
    background: "#FFCDD2",
    highlight: {
      border: "#B71C1C",
      background: "#FFEBEE",
    },
    hover: {
      border: "#B71C1C",
      background: "#FFEBEE",
    },
  },
  borderWidth: 3.5,
  shadow: {
    enabled: true,
    color: "rgba(0,0,0,0.45)",
    size: 12,
    x: 2,
    y: 2,
  },
};

const formatVariationDetails = (details) => {
  if (!details) return "Нет данных";
  const style =
    details.font_style_display !== "Прямой" ? details.font_style_display : "";
  return `${details.cipher_name} ${details.font_weight_display} ${style} (Spacing: ${details.letter_spacing}, Size: ${details.font_size}pt, Leading: ${details.line_height})`
    .replace(/\s+/g, " ")
    .trim();
};

const findNeighborhoodNodesAndEdges = (startNodeIds, allNodes, allEdges) => {
  const initialNodes = new Map();
  const level1Nodes = new Map();
  const level2Nodes = new Map();
  const finalEdges = new Map();

  if (!startNodeIds || startNodeIds.length === 0 || !allNodes || !allEdges) {
    return { nodes: [], edges: [] };
  }

  const allNodesMap = new Map(allNodes.map((node) => [node.id, node]));
  const edgeObjects = allEdges.map((edge, index) => ({
    ...edge,
    id: edge.id || `edge-${index}`,
  }));

  startNodeIds.forEach((nodeId) => {
    const node = allNodesMap.get(nodeId);
    if (node) {
      initialNodes.set(nodeId, node);
    }
  });

  if (initialNodes.size === 0) return { nodes: [], edges: [] };

  edgeObjects.forEach((edge) => {
    const fromIsInitial = initialNodes.has(edge.from);
    const toIsInitial = initialNodes.has(edge.to);
    if (fromIsInitial && !toIsInitial) {
      const neighborNode = allNodesMap.get(edge.to);
      if (neighborNode && !level1Nodes.has(edge.to)) {
        level1Nodes.set(edge.to, neighborNode);
      }
      if (neighborNode && !finalEdges.has(edge.id)) {
        finalEdges.set(edge.id, edge);
      }
    } else if (!fromIsInitial && toIsInitial) {
      const neighborNode = allNodesMap.get(edge.from);
      if (neighborNode && !level1Nodes.has(edge.from)) {
        level1Nodes.set(edge.from, neighborNode);
      }
      if (neighborNode && !finalEdges.has(edge.id)) {
        finalEdges.set(edge.id, edge);
      }
    } else if (fromIsInitial && toIsInitial) {
      if (!finalEdges.has(edge.id)) {
        finalEdges.set(edge.id, edge);
      }
    }
  });

  edgeObjects.forEach((edge) => {
    const fromIsL1 = level1Nodes.has(edge.from);
    const toIsL1 = level1Nodes.has(edge.to);
    const fromIsInitial = initialNodes.has(edge.from);
    const toIsInitial = initialNodes.has(edge.to);
    if (fromIsL1 && !toIsInitial && !toIsL1) {
      const neighborNode = allNodesMap.get(edge.to);
      if (neighborNode && !level2Nodes.has(edge.to)) {
        level2Nodes.set(edge.to, neighborNode);
      }
      if (neighborNode && !finalEdges.has(edge.id)) {
        finalEdges.set(edge.id, edge);
      }
    } else if (toIsL1 && !fromIsInitial && !fromIsL1) {
      const neighborNode = allNodesMap.get(edge.from);
      if (neighborNode && !level2Nodes.has(edge.from)) {
        level2Nodes.set(edge.from, neighborNode);
      }
      if (neighborNode && !finalEdges.has(edge.id)) {
        finalEdges.set(edge.id, edge);
      }
    } else if (fromIsL1 && toIsL1) {
      if (!finalEdges.has(edge.id)) {
        finalEdges.set(edge.id, edge);
      }
    }
  });

  const finalNodesMap = new Map([
    ...initialNodes,
    ...level1Nodes,
    ...level2Nodes,
  ]);

  return {
    nodes: Array.from(finalNodesMap.values()),
    edges: Array.from(finalEdges.values()),
  };
};

const GraphPage = () => {
  const [originalGraphData, setOriginalGraphData] = useState({
    nodes: [],
    edges: [],
  });
  const [filteredGraphData, setFilteredGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState("");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [matchExactVariation, setMatchExactVariation] = useState(true);
  const [searchByLemma, setSearchByLemma] = useState(true);
  const [aggregateGraphByLemma, setAggregateGraphByLemma] = useState(false);

  const dispatch = useDispatch();
  const visJsRef = useRef(null);
  const networkInstanceRef = useRef(null);
  const containerRef = useRef(null);

  const createHtmlElement = (htmlString) => {
    const div = document.createElement("div");
    div.innerHTML = htmlString;
    return div;
  };

  const processData = useCallback((data) => {
    const nodesMap = new Map();
    const nodeDegrees = new Map();
    const linkMap = new Map();
    if (!Array.isArray(data) || data.length === 0)
      return { nodes: [], edges: [] };
    data.forEach((item, index) => {
      if (!item.name || !item.description) return;
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
      const edgeId = `edge-${linkKey}-${index}`;
      linkMap.set(edgeId, {
        id: edgeId,
        from: sourceId,
        to: targetId,
        label: String(count),
        value: count,
        title: createHtmlElement(
          `<b>Связь:</b> ${sourceId} - ${targetId}<br>Количество: ${count}`
        ),
      });
    });
    const nodes = Array.from(nodesMap.values()).map((node) => ({
      ...node,
      value: 1 + Math.log1p(nodeDegrees.get(node.id) || 0) * 5,
      title: createHtmlElement(
        `<b>${node.group === 1 ? "Шрифт" : "Реакция"}:</b> ${
          node.id
        }<br>Связей (взвеш.): ${nodeDegrees.get(node.id) || 0}`
      ),
    }));
    return { nodes, edges: Array.from(linkMap.values()) };
  }, []);

  const fetchGraphData = useCallback(async () => {
    setLoading(true);
    setErrorState(null);
    dispatch(clearError());
    try {
      const response = await getGraphData(aggregateGraphByLemma);
      const processedData = processData(response);
      setOriginalGraphData(processedData);
      setFilteredGraphData(null);
    } catch (error) {
      console.error("Graph data fetch error:", error);
      setErrorState("Не удалось загрузить данные для графа");
    } finally {
      setLoading(false);
    }
  }, [dispatch, processData, aggregateGraphByLemma]);

  useEffect(() => {
    fetchGraphData();
    return () => {
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
      }
    };
  }, [fetchGraphData]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    setSearchError("");
    dispatch(clearError());
    try {
      const results = await findAssociationsByReaction(
        searchTerm.trim(),
        matchExactVariation,
        searchByLemma
      );
      setSearchResults(results);
      if (results.length === 0) {
        setSearchError("Результаты не найдены.");
      }
    } catch (error) {
      console.error("Association search error", error);
      setSearchError(error.response?.data?.error || "Ошибка поиска.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFilterChange = (event) => {
    setFilterKeyword(event.target.value);
  };

  const applyFilter = useCallback(
    (keyword) => {
      if (!keyword?.trim()) {
        setFilteredGraphData(null);
        return;
      }
      const lowerKeyword = keyword.toLowerCase();

      const directlyMatchedOriginalNodes = originalGraphData.nodes.filter(
        (node) =>
          node.id.toLowerCase().includes(lowerKeyword) ||
          (typeof node.label === "string" &&
            node.label.toLowerCase().includes(lowerKeyword))
      );

      if (directlyMatchedOriginalNodes.length > 0) {
        const startNodeIds = directlyMatchedOriginalNodes.map((n) => n.id);

        const neighborhood = findNeighborhoodNodesAndEdges(
          startNodeIds,
          originalGraphData.nodes,
          originalGraphData.edges
        );

        const finalNodes = neighborhood.nodes.map((node) => {
          if (startNodeIds.includes(node.id)) {
            return {
              ...node,
              color: {
                ...(typeof node.color === "object" ? node.color : {}),
                ...FILTER_HIGHLIGHT_STYLE.color,
              },
              borderWidth: FILTER_HIGHLIGHT_STYLE.borderWidth,
              shadow: FILTER_HIGHLIGHT_STYLE.shadow,
            };
          }
          return node;
        });

        setFilteredGraphData({
          nodes: finalNodes,
          edges: neighborhood.edges,
        });
      } else {
        setFilteredGraphData({ nodes: [], edges: [] });
      }
    },
    [originalGraphData]
  );

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    applyFilter(filterKeyword);
  };

  const handleResetFilter = () => {
    setFilterKeyword("");
    setFilteredGraphData(null);
  };

  const handleResultClick = (result) => {
    const cn = result.details?.cipher_name;
    if (cn) {
      setFilterKeyword(cn);
      applyFilter(cn);
    }
  };
  const handleAggregateToggle = (event) => {
    setAggregateGraphByLemma(event.target.checked);
  };

  useEffect(() => {
    let network = null;
    let resizeObserver = null;
    const dataToRender = filteredGraphData || originalGraphData;

    if (
      dataToRender &&
      dataToRender.nodes &&
      dataToRender.edges &&
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
          width: 1,
          smooth: { enabled: true, type: "continuous", roundness: 0.5 },
          color: {
            color: "#aaaaaa",
            highlight: "#777777",
            hover: "#555555",
            inherit: false,
          },
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
            gravitationalConstant: -50,
            centralGravity: 0.015,
            springLength: 130,
            springConstant: 0.06,
            damping: 0.75,
            avoidOverlap: 0.85,
          },
          stabilization: {
            enabled: true,
            iterations: 500,
            updateInterval: 30,
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
        if (networkInstanceRef.current) {
          networkInstanceRef.current.destroy();
          networkInstanceRef.current = null;
        }
        network = new Network(visJsRef.current, dataToRender, options);
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
          if (resizeObserver) resizeObserver.disconnect();
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
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [filteredGraphData, originalGraphData, loading, errorState, dispatch]);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Grid container spacing={2} sx={{ height: "calc(100vh - 64px - 32px)" }}>
        <Grid
          item
          xs={12}
          md={4}
          lg={3}
          sx={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <Paper
            elevation={2}
            sx={{
              p: 2,
              display: "flex",
              flexDirection: "column",
              flexGrow: 1,
              overflow: "hidden",
            }}
          >
            <Typography variant="h6" gutterBottom>
              Поиск вариаций
            </Typography>
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label="Введите реакцию"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={searchLoading}
              />
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <Tooltip title="Учитывать вариации (стиль, вес...)">
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={matchExactVariation}
                        onChange={(e) =>
                          setMatchExactVariation(e.target.checked)
                        }
                      />
                    }
                    label={
                      <StyleIcon sx={{ marginTop: "3px" }} fontSize="small" />
                    }
                    sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
                  />
                </Tooltip>
                <Tooltip title="Искать по смыслу (леммам)">
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={searchByLemma}
                        onChange={(e) => setSearchByLemma(e.target.checked)}
                      />
                    }
                    label={
                      <LanguageIcon
                        sx={{ marginTop: "3px" }}
                        fontSize="small"
                      />
                    }
                    sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
                  />
                </Tooltip>
              </Box>
              <LoadingButton
                type="submit"
                variant="contained"
                size="small"
                loading={searchLoading}
                disabled={!searchTerm.trim()}
                startIcon={<SearchIcon />}
              >
                Найти
              </LoadingButton>
            </Box>
            {searchError && (
              <Alert
                severity="warning"
                sx={{ fontSize: "0.8rem", py: 0.5, px: 1, mb: 1 }}
              >
                {searchError}
              </Alert>
            )}
            <Box sx={{ flexGrow: 1, overflowY: "auto", minHeight: 150 }}>
              <List dense disablePadding>
                {searchResults.map((result, index) => (
                  <ListItemButton
                    key={result.details?.id || index}
                    sx={{
                      px: 1,
                      py: 0.5,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                    onClick={() => handleResultClick(result)}
                  >
                    <ListItemText
                      primary={
                        result.aggregated_by_font_only
                          ? result.details?.cipher_name
                          : formatVariationDetails(result.details)
                      }
                      secondary={`Совпадение: ${result.percentage}% (${
                        result.score
                      } ${result.score === 1 ? "р." : "р."}) ${
                        result.aggregated_by_font_only ? "(по шрифту)" : ""
                      }`}
                      primaryTypographyProps={{
                        variant: "body2",
                        noWrap: true,
                        title: result.aggregated_by_font_only
                          ? result.details?.cipher_name
                          : formatVariationDetails(result.details),
                      }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItemButton>
                ))}
                {!searchLoading &&
                  searchResults.length === 0 &&
                  !searchError &&
                  searchTerm && (
                    <Typography
                      variant="caption"
                      sx={{ p: 1, display: "block", textAlign: "center" }}
                    >
                      Результатов нет.
                    </Typography>
                  )}
              </List>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Фильтр графа
            </Typography>
            <Box
              component="form"
              onSubmit={handleFilterSubmit}
              sx={{ display: "flex", gap: 1, mb: 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label="Фильтр по узлам"
                value={filterKeyword}
                onChange={handleFilterChange}
                InputProps={{
                  endAdornment: filterKeyword && (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={handleResetFilter}
                        title="Сбросить фильтр"
                      >
                        <FilterListOffIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                type="submit"
                variant="outlined"
                size="small"
                disabled={!filterKeyword.trim()}
              >
                Фильтр
              </Button>
            </Box>
            <Tooltip
              title={
                aggregateGraphByLemma
                  ? "Узлы реакций сгруппированы по смыслу (леммам)"
                  : "Узлы реакций отображают оригинальный текст"
              }
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={aggregateGraphByLemma}
                    onChange={handleAggregateToggle}
                  />
                }
                label="Леммы в графе"
                sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
              />
            </Tooltip>
          </Paper>
        </Grid>
        <Grid item xs={12} md={8} lg={9} sx={{ height: "100%" }}>
          <Paper
            ref={containerRef}
            elevation={3}
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
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
                (originalGraphData.nodes.length === 0 ||
                  (filteredGraphData &&
                    filteredGraphData.nodes.length === 0)) &&
                !errorState && (
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    sx={{ height: "100%" }}
                  >
                    <Typography sx={{ textAlign: "center", mt: 4 }}>
                      {filteredGraphData
                        ? "Узлы по фильтру не найдены."
                        : "Нет данных для отображения графа."}
                    </Typography>
                  </Box>
                )}
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
        </Grid>
      </Grid>
    </Container>
  );
};

export default GraphPage;

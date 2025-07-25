import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
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
  Button,
  Alert,
  InputAdornment,
  IconButton,
  FormControlLabel,
  Checkbox,
  Switch,
  Tooltip,
  MenuItem,
  FormGroup,
  FormControl,
  InputLabel,
  Select,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  RadioGroup,
  Radio,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { LoadingButton } from "@mui/lab";
import SearchIcon from "@mui/icons-material/Search";
import FilterListOffIcon from "@mui/icons-material/FilterListOff";
import StyleIcon from "@mui/icons-material/Style";
import CleaningServicesIcon from "@mui/icons-material/CleaningServices";
import BlockIcon from "@mui/icons-material/Block";
import SpellcheckIcon from "@mui/icons-material/Spellcheck";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import HubIcon from "@mui/icons-material/Hub";
import BuildIcon from "@mui/icons-material/Build";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Network } from "vis-network/standalone/umd/vis-network.min";
import "vis-network/styles/vis-network.css";
import { useDebouncedCallback } from "use-debounce";

const FILTER_HIGHLIGHT_STYLE = {
  color: {
    border: "#D32F2F",
    background: "#FFCDD2",
    highlight: { border: "#B71C1C", background: "#FFEBEE" },
    hover: { border: "#B71C1C", background: "#FFEBEE" },
  },
  borderWidth: 3.5,
  shadow: { enabled: true, color: "rgba(0,0,0,0.45)", size: 12, x: 2, y: 2 },
};

const ACTIVE_FILTER_NODE_STYLE = {
  color: {
    border: "#B71C1C",
    background: "#E57373",
    highlight: { border: "#B71C1C", background: "#FFCDD2" },
    hover: { border: "#B71C1C", background: "#FFCDD2" },
  },
  borderWidth: 3,
  shadow: { enabled: true, color: "rgba(0,0,0,0.5)", size: 10, x: 2, y: 2 },
};

const formatVariationDetails = (details) => {
  if (!details) return "Нет данных";
  const style =
    details.font_style_display !== "Прямой" ? details.font_style_display : "";
  const cipherName =
    details.cipher_name || (details.cipher && details.cipher.result) || "N/A";
  return `${cipherName} ${
    details.font_weight_display || ""
  } ${style} (Spacing: ${details.letter_spacing}, Size: ${
    details.font_size
  }pt, Leading: ${details.line_height})`
    .replace(/\s+/g, " ")
    .trim();
};

const findNeighborhoodNodesAndEdges = (startNodeIds, allNodes, allEdges) => {
  const initialNodes = new Map();
  const level1Nodes = new Map();
  const level2Nodes = new Map();
  const finalEdges = new Map();
  if (!startNodeIds || startNodeIds.length === 0 || !allNodes || !allEdges)
    return { nodes: [], edges: [] };
  const allNodesMap = new Map(allNodes.map((node) => [node.id, node]));
  const edgeObjects = allEdges.map((edge, index) => ({
    ...edge,
    id: edge.id || `edge-${index}`,
  }));
  startNodeIds.forEach((nodeId) => {
    const node = allNodesMap.get(nodeId);
    if (node) initialNodes.set(nodeId, node);
  });
  if (initialNodes.size === 0) return { nodes: [], edges: [] };
  edgeObjects.forEach((edge) => {
    const fromIsInitial = initialNodes.has(edge.from);
    const toIsInitial = initialNodes.has(edge.to);
    if (fromIsInitial && !toIsInitial) {
      const neighborNode = allNodesMap.get(edge.to);
      if (neighborNode && !level1Nodes.has(edge.to))
        level1Nodes.set(edge.to, neighborNode);
      if (neighborNode && !finalEdges.has(edge.id))
        finalEdges.set(edge.id, edge);
    } else if (!fromIsInitial && toIsInitial) {
      const neighborNode = allNodesMap.get(edge.from);
      if (neighborNode && !level1Nodes.has(edge.from))
        level1Nodes.set(edge.from, neighborNode);
      if (neighborNode && !finalEdges.has(edge.id))
        finalEdges.set(edge.id, edge);
    } else if (fromIsInitial && toIsInitial) {
      if (!finalEdges.has(edge.id)) finalEdges.set(edge.id, edge);
    }
  });
  edgeObjects.forEach((edge) => {
    const fromIsL1 = level1Nodes.has(edge.from);
    const toIsL1 = level1Nodes.has(edge.to);
    const fromIsInitial = initialNodes.has(edge.from);
    const toIsInitial = initialNodes.has(edge.to);
    if (fromIsL1 && !toIsInitial && !toIsL1) {
      const neighborNode = allNodesMap.get(edge.to);
      if (neighborNode && !level2Nodes.has(edge.to))
        level2Nodes.set(edge.to, neighborNode);
      if (neighborNode && !finalEdges.has(edge.id))
        finalEdges.set(edge.id, edge);
    } else if (toIsL1 && !fromIsInitial && !fromIsL1) {
      const neighborNode = allNodesMap.get(edge.from);
      if (neighborNode && !level2Nodes.has(edge.from))
        level2Nodes.set(edge.from, neighborNode);
      if (neighborNode && !finalEdges.has(edge.id))
        finalEdges.set(edge.id, edge);
    } else if (fromIsL1 && toIsL1) {
      if (!finalEdges.has(edge.id)) finalEdges.set(edge.id, edge);
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

const GROUPING_STRATEGIES = [
  { value: "original", label: "Оригинал" },
  { value: "processed", label: "Базовая обработка" },
  { value: "lemmas", label: "Леммы" },
  { value: "synonyms", label: "Синонимы (группировка)" },
];

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
  const [matchExactVariation, setMatchExactVariation] = useState(true);
  const [searchUseEmbeddings, setSearchUseEmbeddings] = useState(false);
  const [searchMultiWordLogic, setSearchMultiWordLogic] = useState("OR");
  const [filterKeyword, setFilterKeyword] = useState("");
  const [nlpPreprocess, setNlpPreprocess] = useState(true);
  const [nlpRemoveStops, setNlpRemoveStops] = useState(true);
  const [nlpLemmatize, setNlpLemmatize] = useState(true);
  const [nlpGroupSyns, setNlpGroupSyns] = useState(true);
  const [nlpGroupingStrategy, setNlpGroupingStrategy] = useState("lemmas");
  const [edgeFilterType, setEdgeFilterType] = useState("all");
  const [edgeFilterValue, setEdgeFilterValue] = useState("");
  const [displayGraphData, setDisplayGraphData] = useState({
    nodes: [],
    edges: [],
  });

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
      if (!item.name || typeof item.description !== "string") return;
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
          targetId.length > 50
            ? targetId.substring(0, 47) + "..."
            : targetId || " ";
        nodesMap.set(targetId, {
          id: targetId,
          label: `<i>${label}</i>`,
          group: 2,
          font: { multi: "html", face: "Georgia", size: 11 },
        });
        nodeDegrees.set(targetId, 0);
      }
      nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + count);
      nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + count);
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

  const getFilteredEdgesAndNodes = useCallback(
    (nodes, edges, filterType, filterValue) => {
      if (
        filterType === "all" ||
        !filterValue ||
        isNaN(parseInt(filterValue))
      ) {
        return { nodes, edges };
      }
      const numericValue = parseInt(filterValue);
      let filteredEdges = [];
      if (filterType === "frequency_above") {
        filteredEdges = edges.filter((edge) => edge.value >= numericValue);
      } else if (filterType === "top_n") {
        filteredEdges = [...edges]
          .sort((a, b) => b.value - a.value)
          .slice(0, numericValue);
      } else {
        return { nodes, edges };
      }
      const connectedNodeIds = new Set();
      filteredEdges.forEach((edge) => {
        connectedNodeIds.add(edge.from);
        connectedNodeIds.add(edge.to);
      });
      const filteredNodes = nodes.filter((node) =>
        connectedNodeIds.has(node.id)
      );
      return { nodes: filteredNodes, edges: filteredEdges };
    },
    []
  );

  const updateDisplayGraphData = useCallback(() => {
    const baseData = filteredGraphData || originalGraphData;
    if (!baseData || !baseData.nodes || !baseData.edges) {
      setDisplayGraphData({ nodes: [], edges: [] });
      return;
    }
    let { nodes: currentNodes, edges: currentEdges } = baseData;
    const { nodes: nodesAfterEdgeFilter, edges: edgesAfterEdgeFilter } =
      getFilteredEdgesAndNodes(
        currentNodes,
        currentEdges,
        edgeFilterType,
        edgeFilterValue
      );
    currentNodes = nodesAfterEdgeFilter;
    currentEdges = edgesAfterEdgeFilter;

    if (filteredGraphData && filterKeyword.trim()) {
      const lowerKeyword = filterKeyword.toLowerCase();
      currentNodes = currentNodes.map((node) => {
        const isFilterTargetNode =
          (node.id.toLowerCase().includes(lowerKeyword) ||
            (typeof node.label === "string" &&
              node.label
                .toLowerCase()
                .replace(/<i>|<\/i>/g, "")
                .includes(lowerKeyword))) &&
          node.group !== 2;
        if (isFilterTargetNode) {
          return { ...node, ...ACTIVE_FILTER_NODE_STYLE };
        }
        return node;
      });
    }
    setDisplayGraphData({ nodes: currentNodes, edges: currentEdges });
  }, [
    originalGraphData,
    filteredGraphData,
    edgeFilterType,
    edgeFilterValue,
    getFilteredEdgesAndNodes,
    filterKeyword,
  ]);

  useEffect(() => {
    updateDisplayGraphData();
  }, [updateDisplayGraphData]);

  const fetchGraphData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      setErrorState(null);
      dispatch(clearError());
      try {
        const params = {
          preprocess: nlpPreprocess.toString(),
          remove_stops: nlpRemoveStops.toString(),
          lemmatize: nlpLemmatize.toString(),
          group_syns: nlpGroupSyns.toString(),
          grouping_strategy: nlpGroupingStrategy,
        };
        const response = await getGraphData(params);
        const processedData = processData(response || []);
        setOriginalGraphData(processedData);
        setFilteredGraphData(null);
      } catch (error) {
        const errorMsg =
          error.response?.data?.error ||
          error.message ||
          "Не удалось загрузить данные для графа";
        setErrorState(errorMsg);
        dispatch(setError(errorMsg));
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [
      dispatch,
      processData,
      nlpPreprocess,
      nlpRemoveStops,
      nlpLemmatize,
      nlpGroupSyns,
      nlpGroupingStrategy,
    ]
  );

  useEffect(() => {
    fetchGraphData(true);
  }, []);

  const handleApplySettingsAndRefresh = () => {
    fetchGraphData(true);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    setSearchError("");
    dispatch(clearError());
    try {
      const searchParams = {
        reaction_description: searchTerm.trim(),
        match_exact_variation: matchExactVariation,
        preprocess: nlpPreprocess.toString(),
        remove_stops: nlpRemoveStops.toString(),
        lemmatize: nlpLemmatize.toString(),
        group_syns: nlpGroupSyns.toString(),
        grouping_strategy: nlpGroupingStrategy,
        search_use_embeddings: searchUseEmbeddings.toString(),
        multi_word_logic: searchMultiWordLogic,
      };
      const results = await findAssociationsByReaction(searchParams);
      if (Array.isArray(results)) {
        setSearchResults(results);
        if (results.length === 0) setSearchError("Результаты не найдены.");
      } else {
        setSearchResults([]);
        if (results && results.message) {
          let message = results.message;
          if (results.note) message += ` ${results.note}`;
          setSearchError(message);
        } else if (results && results.error) {
          setSearchError(results.error);
        } else {
          setSearchError("Получен неожиданный ответ от сервера.");
        }
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.error || error.message || "Ошибка поиска.";
      setSearchError(errorMsg);
      dispatch(setError(errorMsg));
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const applyFilter = useCallback(
    (keyword) => {
      if (!keyword?.trim()) {
        setFilteredGraphData(null);
        return;
      }
      const lowerKeyword = keyword.toLowerCase();
      const matchedNodes = originalGraphData.nodes.filter(
        (node) =>
          node.id.toLowerCase().includes(lowerKeyword) ||
          (typeof node.label === "string" &&
            node.label
              .toLowerCase()
              .replace(/<i>|<\/i>/g, "")
              .includes(lowerKeyword))
      );
      if (matchedNodes.length > 0) {
        const matchedNodeIds = new Set(matchedNodes.map((n) => n.id));
        const neighborhood = findNeighborhoodNodesAndEdges(
          Array.from(matchedNodeIds),
          originalGraphData.nodes,
          originalGraphData.edges
        );
        const finalNodes = neighborhood.nodes.map((node) => {
          if (matchedNodeIds.has(node.id) && node.group === 2) {
            return {
              ...node,
              color: FILTER_HIGHLIGHT_STYLE.color,
              borderWidth: FILTER_HIGHLIGHT_STYLE.borderWidth,
              shadow: FILTER_HIGHLIGHT_STYLE.shadow,
            };
          }
          return node;
        });
        setFilteredGraphData({ nodes: finalNodes, edges: neighborhood.edges });
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
    const cn =
      result.details?.cipher_name ||
      (result.details?.cipher && result.details?.cipher.result);
    if (cn) {
      setFilterKeyword(cn);
      applyFilter(cn);
    }
  };

  // Debounced фильтр для поиска по узлам графа
  const debouncedApplyFilter = useDebouncedCallback(applyFilter, 300);
  const handleFilterChange = (event) => {
    setFilterKeyword(event.target.value);
    debouncedApplyFilter(event.target.value);
  };

  // Виртуализированный список результатов поиска
  const SearchResultsList = ({
    results,
    onResultClick,
    searchUseEmbeddings,
  }) => {
    const Row = ({ index, style }) => {
      const result = results[index];
      if (!result) return null;
      const {
        details,
        best_reaction_text,
        best_reaction_relevance_percentage,
        best_reaction_frequency,
        total_associations_in_variation,
        aggregated_by_font_only,
        relative_frequency_percentage,
        similarity_score_debug,
      } = result;
      const primaryText =
        aggregated_by_font_only && !searchUseEmbeddings
          ? details?.cipher_name ||
            (details?.cipher && details?.cipher.result) ||
            "N/A"
          : formatVariationDetails(details);
      const bestReactionDisplay =
        typeof best_reaction_text === "string" && best_reaction_text !== "N/A"
          ? `"${best_reaction_text.substring(0, 50)}${
              best_reaction_text.length > 50 ? "..." : ""
            }"`
          : "(нет данных о реакции)";
      let secondaryTextLines = [];
      if (searchUseEmbeddings) {
        const similarityPercent =
          typeof best_reaction_relevance_percentage === "number"
            ? best_reaction_relevance_percentage.toFixed(1)
            : "N/A";
        secondaryTextLines.push(
          <Typography component="span" variant="caption" display="block">
            <strong>Сходство: {similarityPercent}%</strong>
          </Typography>
        );
        secondaryTextLines.push(
          <Typography
            component="span"
            variant="caption"
            display="block"
            title={best_reaction_text}
          >
            Реакция: {bestReactionDisplay}
          </Typography>
        );
        if (typeof similarity_score_debug === "number")
          secondaryTextLines.push(
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              display="block"
            >
              (Raw score: {similarity_score_debug.toFixed(4)})
            </Typography>
          );
      } else {
        const displayPercentageText =
          typeof relative_frequency_percentage === "number"
            ? relative_frequency_percentage.toFixed(1)
            : "N/A";
        const relevanceToQueryText =
          typeof best_reaction_relevance_percentage === "number"
            ? best_reaction_relevance_percentage.toFixed(1)
            : "0.0";
        const frequencyText =
          typeof best_reaction_frequency === "number"
            ? best_reaction_frequency
            : "0";
        const totalInVariationText =
          typeof total_associations_in_variation === "number"
            ? total_associations_in_variation
            : "0";
        secondaryTextLines.push(
          <Typography component="span" variant="caption" display="block">
            Популярность (отн. лидера): {displayPercentageText}% (частота:{" "}
            {frequencyText})
          </Typography>
        );
        secondaryTextLines.push(
          <Typography
            component="span"
            variant="caption"
            display="block"
            title={best_reaction_text}
          >
            Лучшая реакция: {bestReactionDisplay}
          </Typography>
        );
        secondaryTextLines.push(
          <Typography component="span" variant="caption" display="block">
            Релевантность запросу: {relevanceToQueryText}% | Всего реакций на
            шрифт: {totalInVariationText}
          </Typography>
        );
      }
      const secondaryContent = (
        <>
          {secondaryTextLines.map((line, i) => (
            <React.Fragment key={i}>{line}</React.Fragment>
          ))}
        </>
      );
      return (
        <div style={style}>
          <ListItemButton
            key={details?.id || `search-result-${index}`}
            sx={{
              px: 1,
              py: 0.5,
              "&:hover": { bgcolor: "action.hover" },
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              borderBottom: "1px solid #f0f0f0",
            }}
            onClick={() => onResultClick(result)}
          >
            <ListItemText
              primary={primaryText}
              secondary={secondaryContent}
              primaryTypographyProps={{
                variant: "body2",
                noWrap: true,
                title: primaryText,
                style: { fontWeight: 500, marginBottom: "2px" },
              }}
              secondaryTypographyProps={{
                component: "div",
                variant: "caption",
                style: { lineHeight: "1.4" },
              }}
              sx={{ my: 0, width: "100%" }}
            />
          </ListItemButton>
        </div>
      );
    };
    return (
      <List
        height={300}
        itemCount={results.length}
        itemSize={60}
        width={"100%"}
      >
        {Row}
      </List>
    );
  };

  useEffect(() => {
    let network = null;
    let resizeObserver = null;
    const dataToRender = displayGraphData;
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
        hoverWidth: (width) => width * 1.5,
        selectionWidth: (width) => width * 1.8,
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

    if (
      dataToRender &&
      dataToRender.nodes &&
      dataToRender.edges &&
      visJsRef.current &&
      !loading &&
      !errorState
    ) {
      try {
        if (networkInstanceRef.current) {
          networkInstanceRef.current.destroy();
          networkInstanceRef.current = null;
        }
        network = new Network(visJsRef.current, dataToRender, options);
        networkInstanceRef.current = network;
        network.on("stabilizationIterationsDone", () => {});
        network.on("error", (err) => {
          console.error("Vis Network Error:", err);
          setErrorState(
            "Ошибка при отрисовке графа: " + (err.message || err.toString())
          );
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
        console.error("Error creating graph visualization:", err);
        setErrorState(
          "Не удалось создать визуализацию графа: " +
            (err.message || err.toString())
        );
        dispatch(setError("Не удалось создать визуализацию графа"));
      }
    }
    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [displayGraphData, loading, errorState, dispatch]);

  useEffect(() => {
    return () => {
      if (networkInstanceRef.current) {
        networkInstanceRef.current.destroy();
        networkInstanceRef.current = null;
      }
    };
  }, []);

  const handleApplyEdgeFilter = () => {
    updateDisplayGraphData();
  };

  const handleResetEdgeFilter = () => {
    setEdgeFilterType("all");
    setEdgeFilterValue("");
  };

  const renderNLPSettings = () => (
    <FormGroup>
      <Tooltip title="Базовая предобработка (регистр, пунктуация)">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={nlpPreprocess}
              onChange={(e) => setNlpPreprocess(e.target.checked)}
            />
          }
          label={
            <div style={{ display: "flex", alignItems: "center" }}>
              <CleaningServicesIcon fontSize="small" sx={{ mr: 0.5 }} />{" "}
              Предобработка
            </div>
          }
          sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
        />
      </Tooltip>
      <Tooltip title="Удаление стоп-слов">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={nlpRemoveStops}
              onChange={(e) => setNlpRemoveStops(e.target.checked)}
            />
          }
          label={
            <div style={{ display: "flex", alignItems: "center" }}>
              <BlockIcon fontSize="small" sx={{ mr: 0.5 }} /> Стоп-слова
            </div>
          }
          sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
        />
      </Tooltip>
      <Tooltip title="Лемматизация (приведение слов к начальной форме)">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={nlpLemmatize}
              onChange={(e) => setNlpLemmatize(e.target.checked)}
            />
          }
          label={
            <div style={{ display: "flex", alignItems: "center" }}>
              <SpellcheckIcon fontSize="small" sx={{ mr: 0.5 }} /> Леммы
            </div>
          }
          sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
        />
      </Tooltip>
      <Tooltip title="Объединение синонимов (влияет на группировку узлов графа и поиск)">
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={nlpGroupSyns}
              onChange={(e) => setNlpGroupSyns(e.target.checked)}
            />
          }
          label={
            <div style={{ display: "flex", alignItems: "center" }}>
              <PeopleAltIcon fontSize="small" sx={{ mr: 0.5 }} /> Синонимы
            </div>
          }
          sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
        />
      </Tooltip>
      <FormControl fullWidth size="small" sx={{ mt: 1.5 }}>
        <InputLabel
          id="nlp-grouping-strategy-label"
          sx={{ fontSize: "0.9rem" }}
        >
          Стратегия группировки/поиска
        </InputLabel>
        <Select
          labelId="nlp-grouping-strategy-label"
          value={nlpGroupingStrategy}
          label="Стратегия группировки/поиска"
          onChange={(e) => setNlpGroupingStrategy(e.target.value)}
          MenuProps={{ PaperProps: { sx: { maxHeight: 200 } } }}
        >
          {GROUPING_STRATEGIES.map((option) => (
            <MenuItem
              key={option.value}
              value={option.value}
              sx={{ fontSize: "0.8rem" }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </FormGroup>
  );

  const renderEdgeFilterControls = () => (
    <Accordion
      sx={{
        mb: 2,
        boxShadow: "none",
        "&:before": { display: "none" },
        border: "1px solid rgba(0, 0, 0, 0.12)",
        borderRadius: 1,
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <HubIcon sx={{ mr: 1, color: "text.secondary" }} />
        <Typography variant="subtitle1">Фильтр связей (ассоциаций)</Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{ p: 1, pt: 0, display: "flex", flexDirection: "column", gap: 1.5 }}
      >
        <FormControl component="fieldset" size="small">
          <RadioGroup
            aria-label="edge-filter-type"
            name="edge-filter-type-group"
            value={edgeFilterType}
            onChange={(e) => setEdgeFilterType(e.target.value)}
          >
            <FormControlLabel
              value="all"
              control={<Radio size="small" />}
              label="Показать все"
            />
            <FormControlLabel
              value="frequency_above"
              control={<Radio size="small" />}
              label="Частота от"
            />
            <FormControlLabel
              value="top_n"
              control={<Radio size="small" />}
              label="Топ N по частоте"
            />
          </RadioGroup>
        </FormControl>
        {(edgeFilterType === "frequency_above" ||
          edgeFilterType === "top_n") && (
          <TextField
            fullWidth
            size="small"
            type="number"
            label={
              edgeFilterType === "frequency_above"
                ? "Минимальная частота"
                : "Количество (топ N)"
            }
            value={edgeFilterValue}
            onChange={(e) => setEdgeFilterValue(e.target.value)}
            inputProps={{ min: "1" }}
          />
        )}
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={handleApplyEdgeFilter}
            variant="outlined"
            size="small"
            disabled={
              (edgeFilterType !== "all" && !edgeFilterValue.trim()) ||
              (edgeFilterType === "all" && edgeFilterValue.trim())
            }
          >
            Применить фильтр связей
          </Button>
          <Button
            onClick={handleResetEdgeFilter}
            variant="text"
            size="small"
            disabled={edgeFilterType === "all" && !edgeFilterValue.trim()}
          >
            Сбросить
          </Button>
        </Box>
      </AccordionDetails>
    </Accordion>
  );

  const showNoDataMessage =
    !loading &&
    !errorState &&
    (!displayGraphData ||
      !displayGraphData.nodes ||
      displayGraphData.nodes.length === 0);

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
              overflowY: "auto",
            }}
          >
            <Accordion
              defaultExpanded
              sx={{
                mb: 2,
                boxShadow: "none",
                "&:before": { display: "none" },
                border: "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: 1,
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="nlp-settings-content"
                id="nlp-settings-header"
              >
                <BuildIcon sx={{ mr: 1, color: "text.secondary" }} />
                <Typography variant="subtitle1">
                  Общие настройки обработки
                </Typography>
              </AccordionSummary>
              <AccordionDetails
                sx={{
                  p: 1,
                  pt: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                }}
              >
                {renderNLPSettings()}
                <Button
                  onClick={handleApplySettingsAndRefresh}
                  variant="outlined"
                  size="small"
                  startIcon={<RefreshIcon />}
                >
                  Применить и обновить граф
                </Button>
              </AccordionDetails>
            </Accordion>

            {renderEdgeFilterControls()}

            <Typography variant="h6" gutterBottom>
              Поиск ассоциаций
            </Typography>
            <Box
              component="form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 2 }}
            >
              <TextField
                fullWidth
                size="small"
                label="Введите реакцию или фразу"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={searchLoading}
              />
              <Tooltip title="Учитывать точные вариации шрифта (стиль, вес...) при поиске. Не влияет на поиск по сходству (embeddings), где вариации всегда учитываются.">
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={matchExactVariation}
                      onChange={(e) => setMatchExactVariation(e.target.checked)}
                      disabled={searchUseEmbeddings}
                    />
                  }
                  label={
                    <Box
                      component="span"
                      sx={{ display: "flex", alignItems: "center" }}
                    >
                      <StyleIcon fontSize="small" sx={{ mr: 0.5 }} /> Вариации
                      шрифта
                    </Box>
                  }
                  sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
                />
              </Tooltip>
              <FormControl component="fieldset" size="small">
                <RadioGroup
                  row
                  aria-label="multi-word-logic"
                  name="multi-word-logic-group"
                  value={searchMultiWordLogic}
                  onChange={(e) => setSearchMultiWordLogic(e.target.value)}
                >
                  <FormControlLabel
                    value="OR"
                    control={<Radio size="small" />}
                    label={
                      <Typography variant="caption">Любое слово</Typography>
                    }
                  />
                  <FormControlLabel
                    value="AND"
                    control={<Radio size="small" />}
                    label={<Typography variant="caption">Все слова</Typography>}
                  />
                </RadioGroup>
              </FormControl>
              <Tooltip title="Использовать семантический поиск (word embeddings) для нахождения схожих по смыслу реакций.">
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={searchUseEmbeddings}
                      onChange={(e) => setSearchUseEmbeddings(e.target.checked)}
                    />
                  }
                  label={
                    <>
                      <HubIcon fontSize="small" sx={{ mr: 0.5 }} /> Поиск по
                      смыслу (Embeddings)
                    </>
                  }
                  sx={{ "& .MuiTypography-root": { fontSize: "0.8rem" } }}
                />
              </Tooltip>
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
                severity={
                  searchResults.length > 0 &&
                  !searchError.toLowerCase().includes("ошибка")
                    ? "info"
                    : "warning"
                }
                sx={{ fontSize: "0.8rem", py: 0.5, px: 1, mb: 1 }}
              >
                {searchError}
              </Alert>
            )}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                minHeight: 150,
                border: "1px solid #eee",
                borderRadius: 1,
                p: 0.5,
              }}
            >
              <SearchResultsList
                results={searchResults}
                onResultClick={handleResultClick}
                searchUseEmbeddings={searchUseEmbeddings}
              />
              {!searchLoading &&
                searchResults.length === 0 &&
                !searchError &&
                searchTerm && (
                  <Typography
                    variant="caption"
                    sx={{ p: 1, display: "block", textAlign: "center" }}
                  >
                    Результатов нет. Попробуйте изменить запрос или настройки.
                  </Typography>
                )}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              Фильтр по узлам графа
            </Typography>
            <Box
              component="form"
              onSubmit={handleFilterSubmit}
              sx={{ display: "flex", gap: 1, mb: 1 }}
            >
              <TextField
                fullWidth
                size="small"
                label="Фильтр по названию узла"
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
                    zIndex: 10,
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
              {showNoDataMessage && (
                <Box
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  sx={{ height: "100%" }}
                >
                  <Typography sx={{ textAlign: "center", mt: 4 }}>
                    {filteredGraphData &&
                    (!filteredGraphData.nodes ||
                      filteredGraphData.nodes.length === 0)
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
                  visibility:
                    loading || errorState || showNoDataMessage
                      ? "hidden"
                      : "visible",
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

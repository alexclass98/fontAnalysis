import React, { useState, useEffect } from "react";
import {
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Grid,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Pagination,
  Stack,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  Alert,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useDispatch } from "react-redux";
import { setError } from "../store/errorSlice";
import {
  analyzeNLPText,
  analyzeAllAssociationsNLP,
  getAllAssociationsForNLP,
  getFilteredAssociationsForNLP,
  getFastGroupedAssociations,
} from "../api/api";
import { UMAP } from "umap-js";
import Plot from "react-plotly.js";

console.log("[NLPAnalysisPage] === КОМПОНЕНТ ЗАГРУЖЕН ===");

const TabPanel = (props) => {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`nlp-analysis-tabpanel-${index}`}
      aria-labelledby={`nlp-analysis-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const GROUPING_STRATEGIES = [
  { value: "original", label: "Оригинал" },
  { value: "processed", label: "Базовая обработка" },
  { value: "lemmas", label: "Леммы" },
  { value: "synonyms", label: "Синонимы (группировка)" },
];

const NLPAnalysisPage = () => {
  const [currentTab, setCurrentTab] = useState(0);
  const [inputText, setInputText] = useState("");
  const [singleTextAnalysisResults, setSingleTextAnalysisResults] =
    useState(null);

  const [allAssociationsData, setAllAssociationsData] = useState({
    results: [],
    count: 0,
    next: null,
    previous: null,
  });
  const [currentPageAllAssoc, setCurrentPageAllAssoc] = useState(1);
  const [pageSizeAllAssoc, setPageSizeAllAssoc] = useState(5);

  const [loadingSingle, setLoadingSingle] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const dispatch = useDispatch();

  const [plotData, setPlotData] = useState([]);
  const [showEmbeddingPlot, setShowEmbeddingPlot] = useState(false);
  const [activePlotSource, setActivePlotSource] = useState(null);
  const [is3D, setIs3D] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInfo, setModalInfo] = useState(null);

  // Состояния для вкладки 3D визуализации
  const [vizIs3D, setVizIs3D] = useState(false);
  const [vizSelectedFont, setVizSelectedFont] = useState("");
  const [vizSelectedUser, setVizSelectedUser] = useState("");
  const [vizSearchText, setVizSearchText] = useState("");
  const [vizGroupingStrategy, setVizGroupingStrategy] = useState("lemmas");
  const [vizModalOpen, setVizModalOpen] = useState(false);
  const [vizModalInfo, setVizModalInfo] = useState(null);
  const [vizShowEmbeddingPlot, setVizShowEmbeddingPlot] = useState(false);
  const [vizPlotData, setVizPlotData] = useState([]);
  const [vizActivePlotSource, setVizActivePlotSource] = useState(null);
  const [vizAllEmbeddingsData, setVizAllEmbeddingsData] = useState(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [totalDataCount, setTotalDataCount] = useState(0);
  const [vizMaxGroups, setVizMaxGroups] = useState(200); // новый фильтр

  // Вместо memo по фильтрам используем данные с бэка
  const [allUsers, setAllUsers] = useState([]); // [{user_username, count}]
  const [allFonts, setAllFonts] = useState([]); // [{cipher_name, count}]

  console.log("[NLPAnalysisPage] Состояние компонента инициализировано");

  const handleTabChange = (event, newValue) => {
    console.log(
      `[NLPAnalysisPage] === ПЕРЕКЛЮЧЕНИЕ НА ВКЛАДКУ ${newValue} ===`
    );
    setCurrentTab(newValue);
    setShowEmbeddingPlot(false);
    setPlotData([]);

    if (newValue === 2) {
      console.log(
        "[NLPAnalysisPage] Переход на 3D вкладку, проверяем данные..."
      );
      console.log(
        `[NLPAnalysisPage] vizAllEmbeddingsData: ${
          vizAllEmbeddingsData ? "ЕСТЬ" : "НЕТ"
        }`
      );

      if (!vizAllEmbeddingsData) {
        console.log(
          "[NLPAnalysisPage] 🚀 Запуск автоматической загрузки данных для 3D визуализации"
        );
        fetchVizAllEmbeddings();
      } else {
        console.log(
          "[NLPAnalysisPage] ✅ Данные уже загружены, количество:",
          vizAllEmbeddingsData.results?.length || 0
        );
      }
    }
  };

  const handleAnalyzeSingleText = async () => {
    if (!inputText.trim()) {
      dispatch(setError("Пожалуйста, введите текст для анализа."));
      return;
    }
    console.log(`[NLPAnalysisPage] Анализ одного текста: "${inputText}"`);
    setLoadingSingle(true);
    setSingleTextAnalysisResults(null);
    setShowEmbeddingPlot(false);
    try {
      const data = await analyzeNLPText({ text: inputText });
      console.log("[NLPAnalysisPage] ✅ Анализ текста завершен:", data);
      setSingleTextAnalysisResults(data);
    } catch (error) {
      console.error("[NLPAnalysisPage] ❌ Ошибка анализа текста:", error);
    } finally {
      setLoadingSingle(false);
    }
  };

  const fetchAllAssociationsAnalysis = async (page) => {
    console.log(`[NLPAnalysisPage] Загрузка ассоциаций для страницы: ${page}`);
    setLoadingAll(true);
    setShowEmbeddingPlot(false);
    try {
      const data = await analyzeAllAssociationsNLP(page, pageSizeAllAssoc);
      console.log(
        `[NLPAnalysisPage] ✅ Загружено ${data.results?.length} ассоциаций из ${data.count} общих`
      );
      setAllAssociationsData(data);
      setCurrentPageAllAssoc(page);
    } catch (error) {
      console.error("[NLPAnalysisPage] ❌ Ошибка загрузки ассоциаций:", error);
      setAllAssociationsData({
        results: [],
        count: 0,
        next: null,
        previous: null,
      });
    } finally {
      setLoadingAll(false);
    }
  };

  // Загрузка всех ассоциаций для вкладки 3D (используем фильтрацию на бэкенде)
  const fetchVizAllEmbeddings = async () => {
    setVizLoading(true);
    setVizShowEmbeddingPlot(false);
    try {
      const params = {
        font: vizSelectedFont || undefined,
        user: vizSelectedUser || undefined,
        search: vizSearchText || undefined,
        grouping_strategy: vizGroupingStrategy,
        limit: vizMaxGroups !== "all" ? vizMaxGroups : undefined,
      };
      const data = await getFastGroupedAssociations(params);
      setVizAllEmbeddingsData({ results: data.results, count: data.count });
      setTotalDataCount(data.count);
      setAllUsers(data.all_users || []);
      setAllFonts(data.all_fonts || []);
      await generateVizPlot(
        "all",
        {
          results: data.results.map((item) => ({
            ...item,
            processing_variants: [
              { result: { text_embedding_vector: item.embedding } },
            ],
          })),
        },
        vizIs3D,
        true
      );
    } catch (error) {
      setVizAllEmbeddingsData(null);
      setVizPlotData([]);
      setVizShowEmbeddingPlot(false);
      dispatch(setError("Ошибка при загрузке эмбеддингов: " + error.message));
    } finally {
      setVizLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 1 && allAssociationsData.results.length === 0) {
      console.log("[NLPAnalysisPage] Автоматическая загрузка для вкладки 1");
      fetchAllAssociationsAnalysis(1);
    }
  }, [currentTab]);

  const handlePageChangeAllAssoc = (event, value) => {
    console.log(`[NLPAnalysisPage] Смена страницы на: ${value}`);
    fetchAllAssociationsAnalysis(value);
  };

  // Удаляем старые memo vizFontOptions и vizUserOptions
  // Вместо них формируем списки шрифтов и пользователей из сгруппированных данных
  const vizFontOptions = React.useMemo(() => {
    if (!vizAllEmbeddingsData?.results) return [];
    // Собираем все уникальные шрифты из items (если есть)
    const setFonts = new Set();
    vizAllEmbeddingsData.results.forEach((item) => {
      if (item.cipher_name) setFonts.add(item.cipher_name);
      // если внутри items
      if (item.items && Array.isArray(item.items)) {
        item.items.forEach((sub) => {
          if (sub.cipher_name) setFonts.add(sub.cipher_name);
        });
      }
    });
    return Array.from(setFonts).filter(Boolean);
  }, [vizAllEmbeddingsData]);

  const vizUserOptions = React.useMemo(() => {
    if (!vizAllEmbeddingsData?.results) return [];
    const setUsers = new Set();
    vizAllEmbeddingsData.results.forEach((item) => {
      if (item.user_username) setUsers.add(item.user_username);
      if (item.items && Array.isArray(item.items)) {
        item.items.forEach((sub) => {
          if (sub.user_username) setUsers.add(sub.user_username);
        });
      }
    });
    return Array.from(setUsers).filter(Boolean);
  }, [vizAllEmbeddingsData]);

  // Для 3D вкладки теперь не нужно фильтровать и группировать на фронте, просто отображаем data.results
  const vizFilteredGroupedAssociations = React.useMemo(() => {
    if (!vizAllEmbeddingsData?.results) return [];
    // Каждая "группа" — это объект с groupKey и items (item содержит embedding, count, grouping_key)
    return vizAllEmbeddingsData.results.map((item) => ({
      groupKey: item.grouping_key,
      items: [
        {
          ...item,
          processing_variants: [
            { result: { text_embedding_vector: item.embedding } },
          ],
        },
      ],
    }));
  }, [vizAllEmbeddingsData]);

  const generatePlotForEmbeddings = async (
    sourceType,
    analysisData,
    is3DMode = false,
    useAll = false
  ) => {
    console.log(
      `[NLPAnalysisPage] Генерация графика: ${sourceType}, 3D: ${is3DMode}, useAll: ${useAll}`
    );
    setShowEmbeddingPlot(false);
    setActivePlotSource(sourceType);

    let embeddings = [];
    let labels = [];
    let groupInfo = [];
    let assocMap = {};

    const dataToUse = analysisData?.results || [];
    console.log(
      `[NLPAnalysisPage] Обработка ${dataToUse.length} элементов для визуализации`
    );

    dataToUse.forEach((assoc, index) => {
      const embeddingVariant = assoc.processing_variants.find(
        (v) =>
          v.name.includes("Текстовый Эмбеддинг") &&
          v.result.text_embedding_vector
      );

      const groupVariant = assoc.processing_variants.find((v) => {
        return v.name.includes("Лемматизация");
      });

      if (embeddingVariant) {
        embeddings.push(embeddingVariant.result.text_embedding_vector);
        const label =
          groupVariant?.result?.grouping_key || assoc.original_reaction_text;
        labels.push(label);

        groupInfo.push({
          groupKey: label,
          cipher_name: assoc.cipher_name,
          user_username: assoc.user_username,
          association_id: assoc.association_id,
        });

        if (!assocMap[label]) assocMap[label] = [];
        assocMap[label].push(assoc);
      }
    });

    console.log(
      `[NLPAnalysisPage] ✅ Найдено ${embeddings.length} эмбеддингов для визуализации`
    );

    if (embeddings.length < 2) {
      console.warn(
        "[NLPAnalysisPage] ❌ Недостаточно эмбеддингов для построения графика"
      );
      dispatch(
        setError(
          "Недостаточно эмбеддингов для построения графика (нужно минимум 2)"
        )
      );
      setPlotData([]);
      setShowEmbeddingPlot(false);
      return;
    }

    const tempLoadingSetter =
      sourceType === "single" ? setLoadingSingle : setLoadingAll;
    tempLoadingSetter(true);

    try {
      console.log("[NLPAnalysisPage] 🔄 Начало UMAP проекции");
      const startTime = performance.now();

      const umap = new UMAP({
        nNeighbors: Math.min(15, embeddings.length - 1),
        minDist: 0.1,
        nComponents: is3DMode ? 3 : 2,
      });

      const projection = await umap.fitAsync(embeddings);
      const endTime = performance.now();

      console.log(
        `[NLPAnalysisPage] ✅ UMAP проекция завершена за ${(
          endTime - startTime
        ).toFixed(2)}мс`
      );

      let trace;
      const markerSize = embeddings.length > 200 ? 4 : 8;

      if (is3DMode) {
        trace = {
          x: projection.map((p) => p[0]),
          y: projection.map((p) => p[1]),
          z: projection.map((p) => p[2]),
          mode: "markers",
          type: "scatter3d",
          text: labels,
          marker: { size: markerSize },
        };
      } else {
        trace = {
          x: projection.map((p) => p[0]),
          y: projection.map((p) => p[1]),
          mode: "markers",
          type: "scatter",
          text: labels,
          marker: { size: markerSize },
        };
      }

      setPlotData([trace]);
      setShowEmbeddingPlot(true);
      setModalInfo({ assocMap, groupInfo });

      console.log("[NLPAnalysisPage] ✅ График успешно построен");
    } catch (e) {
      console.error("[NLPAnalysisPage] ❌ Ошибка при построении графика:", e);
      dispatch(setError(`Ошибка при снижении размерности: ${e.message}`));
      setPlotData([]);
      setShowEmbeddingPlot(false);
    } finally {
      tempLoadingSetter(false);
    }
  };

  // Визуализация для вкладки 2 (3D)
  const generateVizPlot = async (
    sourceType,
    analysisData,
    is3DMode = false,
    useAll = false
  ) => {
    setVizShowEmbeddingPlot(false);
    setVizActivePlotSource(sourceType);
    // Используем сгруппированные ассоциации: каждая группа = точка, размер зависит от количества
    const groups = useAll
      ? vizFilteredGroupedAssociations
      : [{ groupKey: null, items: analysisData?.results || [] }];
    let embeddings = [];
    let labels = [];
    let groupInfo = [];
    let assocMap = {};
    groups.forEach((group) => {
      // Новый формат: group.items[0] содержит embedding, count, grouping_key
      const item = group.items[0];
      if (!item || !item.embedding) return;
      embeddings.push(item.embedding);
      labels.push(`${group.groupKey} (${item.count})`);
      groupInfo.push({
        groupKey: group.groupKey,
        count: item.count,
        associations: [item],
      });
      assocMap[group.groupKey] = [item];
    });
    if (embeddings.length < 2) {
      dispatch(
        setError(
          "Недостаточно уникальных групп с эмбеддингами для построения графика (нужно минимум 2)."
        )
      );
      setVizPlotData([]);
      setVizShowEmbeddingPlot(false);
      return;
    }
    setVizLoading(true);
    try {
      const umap = new UMAP({
        nNeighbors: Math.min(15, embeddings.length - 1),
        minDist: 0.1,
        nComponents: is3DMode ? 3 : 2,
      });
      const projection = await umap.fitAsync(embeddings);
      let trace;
      if (is3DMode) {
        trace = {
          x: projection.map((p) => p[0]),
          y: projection.map((p) => p[1]),
          z: projection.map((p) => p[2]),
          mode: "markers",
          type: "scatter3d",
          text: labels,
          marker: {
            size: groupInfo.map((g) => Math.max(6, Math.min(20, g.count * 2))),
            color: groupInfo.map((g) => g.count),
            colorscale: "Viridis",
            showscale: true,
            colorbar: { title: "Количество ассоциаций" },
          },
        };
      } else {
        trace = {
          x: projection.map((p) => p[0]),
          y: projection.map((p) => p[1]),
          mode: "markers",
          type: "scatter",
          text: labels,
          marker: {
            size: groupInfo.map((g) => Math.max(8, Math.min(25, g.count * 3))),
            color: groupInfo.map((g) => g.count),
            colorscale: "Viridis",
            showscale: true,
            colorbar: { title: "Количество ассоциаций" },
          },
        };
      }
      setVizPlotData([trace]);
      setVizShowEmbeddingPlot(true);
      setVizModalInfo({ assocMap, groupInfo });
    } catch (e) {
      dispatch(setError(`Ошибка при снижении размерности: ${e.message}`));
      setVizPlotData([]);
      setVizShowEmbeddingPlot(false);
    } finally {
      setVizLoading(false);
    }
  };

  const handlePlotClick = (event) => {
    if (!modalInfo || !event?.points?.length) return;
    const label = event.points[0].text;
    const groupAssocs = modalInfo.assocMap[label] || [];
    console.log(
      `[NLPAnalysisPage] Клик по точке: "${label}", ассоциаций: ${groupAssocs.length}`
    );
    setModalInfo((prev) => ({
      ...prev,
      selectedGroup: { label, groupAssocs },
    }));
    setModalOpen(true);
  };

  // Обработчик клика по точке Plotly (вкладка 2)
  const handleVizPlotClick = (event) => {
    if (!vizModalInfo || !event?.points?.length) return;
    const label = event.points[0].text;
    // Найти группу по label (groupKey)
    const group = vizFilteredGroupedAssociations.find((g) =>
      label.startsWith(g.groupKey)
    );
    if (!group) return;
    // Используем все ассоциации из group.items[0].associations
    const allAssocs =
      group.items[0] && group.items[0].associations
        ? group.items[0].associations
        : [];
    setVizModalInfo((prev) => ({
      ...prev,
      selectedGroup: { label, groupAssocs: allAssocs },
    }));
    setVizModalOpen(true);
  };

  const renderResultValue = (value) => {
    if (value === null || value === undefined)
      return <Chip label="N/A" size="small" variant="outlined" />;
    if (typeof value === "string" && value.trim() === "")
      return (
        <Chip label="пусто" size="small" color="warning" variant="outlined" />
      );
    if (Array.isArray(value)) {
      if (value.length === 0)
        return (
          <Chip
            label="пусто (массив)"
            size="small"
            color="warning"
            variant="outlined"
          />
        );
      return value.map((item, index) => (
        <Chip
          key={index}
          label={item}
          size="small"
          sx={{ mr: 0.5, mb: 0.5 }}
          variant="outlined"
        />
      ));
    }
    if (typeof value === "object") {
      if (Object.keys(value).length === 0)
        return (
          <Chip
            label="пусто (объект)"
            size="small"
            color="warning"
            variant="outlined"
          />
        );
      return (
        <Box>
          {Object.entries(value).map(([key, val]) => (
            <Box key={key} sx={{ mb: 0.5 }}>
              <Typography
                variant="caption"
                component="span"
                sx={{ fontWeight: "bold" }}
              >
                {key}:{" "}
              </Typography>
              {Array.isArray(val) ? val.join(", ") : String(val)}
            </Box>
          ))}
        </Box>
      );
    }
    return String(value);
  };

  const renderProcessingVariants = (variants) => (
    <Grid container spacing={2}>
      {variants.map((variant, index) => (
        <Grid item xs={12} md={6} key={index}>
          <Paper elevation={2} sx={{ p: 2, height: "100%" }}>
            <Typography variant="subtitle1" gutterBottom color="primary">
              {variant.name}
            </Typography>
            <Typography
              variant="caption"
              color="textSecondary"
              gutterBottom
              display="block"
            >
              Параметры: {variant.params_desc}
            </Typography>
            {variant.result.error ? (
              <Typography color="error" variant="body2">
                Ошибка: {variant.result.error}
              </Typography>
            ) : (
              <TableContainer
                component={Paper}
                variant="outlined"
                sx={{ mt: 1, maxHeight: 400, overflowY: "auto" }}
              >
                <Table size="small" stickyHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", width: "30%" }}>
                        Processed Text
                      </TableCell>
                      <TableCell>
                        {renderResultValue(variant.result.processed_text)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>Tokens</TableCell>
                      <TableCell>
                        {renderResultValue(variant.result.tokens)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>Lemmas</TableCell>
                      <TableCell>
                        {renderResultValue(variant.result.lemmas)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Synonym Groups
                      </TableCell>
                      <TableCell>
                        {renderResultValue(variant.result.synonym_groups)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Grouping Key
                      </TableCell>
                      <TableCell>
                        {renderResultValue(variant.result.grouping_key)}
                      </TableCell>
                    </TableRow>
                    {variant.result.hasOwnProperty(
                      "text_embedding_details"
                    ) && (
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Embedding
                        </TableCell>
                        <TableCell>
                          {renderResultValue(
                            variant.result.text_embedding_details
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Анализ NLP Обработок
      </Typography>

      {totalDataCount > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Загружено {totalDataCount} ассоциаций для 3D визуализации
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="NLP analysis tabs"
        >
          <Tab
            label="Анализ одного текста"
            id="nlp-analysis-tab-0"
            aria-controls="nlp-analysis-tabpanel-0"
          />
          <Tab
            label="Анализ всех ассоциаций"
            id="nlp-analysis-tab-1"
            aria-controls="nlp-analysis-tabpanel-1"
          />
          <Tab
            label="3D визуализация (UMAP)"
            id="nlp-analysis-tab-2"
            aria-controls="nlp-analysis-tabpanel-2"
          />
        </Tabs>
      </Box>

      {/* Остальные TabPanel остаются без изменений */}
      <TabPanel value={currentTab} index={0}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <TextField
            fullWidth
            label="Введите текст для анализа"
            multiline
            rows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleAnalyzeSingleText}
            disabled={loadingSingle && !showEmbeddingPlot}
          >
            {loadingSingle && !showEmbeddingPlot && !plotData.length ? (
              <CircularProgress size={24} />
            ) : (
              "Анализировать текст"
            )}
          </Button>
        </Paper>

        {loadingSingle && !plotData.length && !singleTextAnalysisResults && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {singleTextAnalysisResults && (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
              Исходный текст: "{singleTextAnalysisResults.input_text}"
            </Typography>
            <Button
              onClick={() =>
                generatePlotForEmbeddings("single", singleTextAnalysisResults)
              }
              variant="outlined"
              sx={{ my: 2 }}
              disabled={
                loadingSingle ||
                !singleTextAnalysisResults?.processing_variants?.some(
                  (v) => v.result.text_embedding_vector
                )
              }
            >
              Визуализировать эмбеддинги вариантов (UMAP 2D)
            </Button>
            {showEmbeddingPlot &&
              activePlotSource === "single" &&
              plotData.length > 0 && (
                <Paper sx={{ p: 2, mt: 2, mb: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Визуализация эмбеддингов (UMAP 2D)
                  </Typography>
                  <Plot
                    data={plotData}
                    layout={{
                      width: "100%",
                      height: 500,
                      autosize: true,
                      xaxis: { title: "UMAP 1" },
                      yaxis: { title: "UMAP 2" },
                    }}
                    config={{ responsive: true }}
                  />
                </Paper>
              )}
            {renderProcessingVariants(
              singleTextAnalysisResults.processing_variants
            )}
          </Box>
        )}
      </TabPanel>

      <TabPanel value={currentTab} index={1}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Button
            onClick={() =>
              generatePlotForEmbeddings("all", allAssociationsData, is3D, false)
            }
            variant="outlined"
            sx={{ my: 2 }}
            disabled={
              loadingAll ||
              !allAssociationsData.results?.some((a) =>
                a.processing_variants.some(
                  (v) => v.result.text_embedding_vector
                )
              )
            }
          >
            Визуализировать эмбеддинги (UMAP {is3D ? "3D" : "2D"}) для текущей
            страницы
          </Button>
          <FormControlLabel
            control={
              <Switch checked={is3D} onChange={() => setIs3D((v) => !v)} />
            }
            label="3D"
          />
        </Box>

        {loadingAll &&
          !allAssociationsData.results.length &&
          !plotData.length && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
              <CircularProgress />
            </Box>
          )}

        {allAssociationsData.results &&
          allAssociationsData.results.length === 0 &&
          !loadingAll && (
            <Typography>
              Нет ассоциаций для анализа или данные не загружены.
            </Typography>
          )}

        {allAssociationsData.results &&
          allAssociationsData.results.length > 0 && (
            <Box>
              {showEmbeddingPlot &&
                activePlotSource === "all" &&
                plotData.length > 0 && (
                  <Paper sx={{ p: 2, mt: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Визуализация эмбеддингов (UMAP {is3D ? "3D" : "2D"})
                    </Typography>
                    <Plot
                      data={plotData}
                      layout={
                        is3D
                          ? {
                              width: "100%",
                              height: 600,
                              autosize: true,
                              scene: {
                                xaxis: { title: "UMAP 1" },
                                yaxis: { title: "UMAP 2" },
                                zaxis: { title: "UMAP 3" },
                              },
                            }
                          : {
                              width: "100%",
                              height: 600,
                              autosize: true,
                              xaxis: { title: "UMAP 1" },
                              yaxis: { title: "UMAP 2" },
                            }
                      }
                      config={{ responsive: true }}
                      onClick={handlePlotClick}
                    />
                    {modalOpen && modalInfo?.selectedGroup && (
                      <Paper sx={{ p: 2, mt: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                          Реакция: {modalInfo.selectedGroup.label}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Встречается в{" "}
                          {modalInfo.selectedGroup.groupAssocs.length}{" "}
                          ассоциациях:
                        </Typography>
                        <ul>
                          {modalInfo.selectedGroup.groupAssocs.map((a, idx) => (
                            <li key={a.association_id || idx}>
                              <b>Шрифт:</b> {a.cipher_name},{" "}
                              <b>Пользователь:</b> {a.user_username},{" "}
                              <b>Текст:</b> {a.original_reaction_text}
                            </li>
                          ))}
                        </ul>
                        <Button
                          onClick={() => setModalOpen(false)}
                          variant="outlined"
                          sx={{ mt: 1 }}
                        >
                          Закрыть
                        </Button>
                      </Paper>
                    )}
                  </Paper>
                )}
              <Typography variant="h6" gutterBottom sx={{ mt: 1, mb: 2 }}>
                Анализ ассоциаций (Страница {currentPageAllAssoc} из{" "}
                {Math.ceil(allAssociationsData.count / pageSizeAllAssoc)})
              </Typography>
              {allAssociationsData.results.map((assocAnalysis, index) => (
                <Accordion
                  key={assocAnalysis.association_id || index}
                  sx={{ mb: 1 }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls={`panel${index}-content`}
                    id={`panel${index}-header`}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: "bold" }}
                      >
                        ID: {assocAnalysis.association_id} / Пользователь:{" "}
                        {assocAnalysis.user_username}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        Шрифт: {assocAnalysis.cipher_name} (
                        {assocAnalysis.font_details})
                      </Typography>
                      <Typography variant="body2" sx={{ fontStyle: "italic" }}>
                        Оригинальная реакция: "
                        {assocAnalysis.original_reaction_text}"
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {renderProcessingVariants(
                      assocAnalysis.processing_variants
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
              {allAssociationsData.count > pageSizeAllAssoc && (
                <Stack spacing={2} sx={{ mt: 3, mb: 2, alignItems: "center" }}>
                  <Pagination
                    count={Math.ceil(
                      allAssociationsData.count / pageSizeAllAssoc
                    )}
                    page={currentPageAllAssoc}
                    onChange={handlePageChangeAllAssoc}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Stack>
              )}
            </Box>
          )}
      </TabPanel>

      <TabPanel value={currentTab} index={2}>
        {vizLoading && !vizShowEmbeddingPlot && (
          <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>
              Загрузка и построение визуализации...
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            mb: 2,
            flexWrap: "wrap",
          }}
        >
          <InputLabel id="viz-max-groups-label">Кол-во групп</InputLabel>
          <Select
            labelId="viz-max-groups-label"
            value={vizMaxGroups}
            onChange={(e) =>
              setVizMaxGroups(
                e.target.value === "all" ? "all" : Number(e.target.value)
              )
            }
            size="small"
            sx={{ minWidth: 80 }}
          >
            {[100, 200, 500, 1000].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
            <MenuItem key="all" value="all">
              Все
            </MenuItem>
          </Select>
          <InputLabel id="viz-font-filter-label">Шрифт</InputLabel>
          <Select
            labelId="viz-font-filter-label"
            value={vizSelectedFont}
            onChange={(e) => setVizSelectedFont(e.target.value)}
            size="small"
            sx={{ minWidth: 120 }}
            displayEmpty
            disabled={allFonts.length === 0}
          >
            <MenuItem key="all-fonts" value="">
              Все ({allFonts.length})
            </MenuItem>
            {allFonts.map((f) => (
              <MenuItem
                key={f.cipher_name || `font-${f.cipher_name}`}
                value={f.cipher_name || ""}
              >
                {f.cipher_name || "(неизвестно)"}{" "}
                {f.count ? `(${f.count})` : ""}
              </MenuItem>
            ))}
          </Select>
          <InputLabel id="viz-user-filter-label">Пользователь</InputLabel>
          <Select
            labelId="viz-user-filter-label"
            value={vizSelectedUser}
            onChange={(e) => setVizSelectedUser(e.target.value)}
            size="small"
            sx={{ minWidth: 120 }}
            displayEmpty
            disabled={allUsers.length === 0}
          >
            <MenuItem key="all-users" value="">
              Все ({allUsers.length})
            </MenuItem>
            {allUsers.map((u) => (
              <MenuItem
                key={u.user_username || `user-${u.user_username}`}
                value={u.user_username || ""}
              >
                {u.user_username || "(неизвестно)"}{" "}
                {u.count ? `(${u.count})` : ""}
              </MenuItem>
            ))}
          </Select>
          <TextField
            label="Поиск по реакции"
            value={vizSearchText}
            onChange={(e) => setVizSearchText(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <InputLabel id="viz-grouping-strategy-label">Группировка</InputLabel>
          <Select
            labelId="viz-grouping-strategy-label"
            value={vizGroupingStrategy}
            onChange={(e) => setVizGroupingStrategy(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            {GROUPING_STRATEGIES.map((g) => (
              <MenuItem key={g.value} value={g.value}>
                {g.label}
              </MenuItem>
            ))}
          </Select>
          <Button
            variant="outlined"
            color="primary"
            onClick={fetchVizAllEmbeddings}
            disabled={vizLoading}
          >
            Обновить визуализацию {vizIs3D ? "3D" : "2D"}
          </Button>
          <FormControlLabel
            control={
              <Switch
                checked={vizIs3D}
                onChange={() => setVizIs3D((v) => !v)}
              />
            }
            label="3D"
          />
        </Box>

        {vizFilteredGroupedAssociations.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Отфильтровано {vizFilteredGroupedAssociations.length} уникальных
            групп из {totalDataCount} ассоциаций
          </Alert>
        )}

        {vizShowEmbeddingPlot &&
          vizActivePlotSource === "all" &&
          vizPlotData.length > 0 && (
            <Paper sx={{ p: 2, mt: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Визуализация эмбеддингов (UMAP {vizIs3D ? "3D" : "2D"})
              </Typography>
              <Plot
                data={vizPlotData}
                layout={
                  vizIs3D
                    ? {
                        width: "100%",
                        height: 600,
                        autosize: true,
                        scene: {
                          xaxis: { title: "UMAP 1" },
                          yaxis: { title: "UMAP 2" },
                          zaxis: { title: "UMAP 3" },
                          dragmode: "orbit",
                        },
                        margin: { l: 0, r: 0, b: 0, t: 0 },
                        showlegend: false,
                      }
                    : {
                        width: "100%",
                        height: 600,
                        autosize: true,
                        xaxis: { title: "UMAP 1" },
                        yaxis: { title: "UMAP 2" },
                        margin: { l: 0, r: 0, b: 0, t: 0 },
                        showlegend: false,
                      }
                }
                config={{
                  responsive: true,
                  displayModeBar: true,
                  modeBarButtonsToAdd: [
                    "resetCamera3d",
                    "zoom3d",
                    "pan3d",
                    "orbitRotation",
                    "tableRotation",
                  ],
                }}
                onClick={handleVizPlotClick}
              />
              {vizModalOpen && vizModalInfo?.selectedGroup && (
                <Paper sx={{ p: 2, mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Группа: {vizModalInfo.selectedGroup.label}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    Всего ассоциаций:{" "}
                    <strong>
                      {vizModalInfo.selectedGroup.groupAssocs.length}
                    </strong>
                  </Typography>
                  <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                    Пользователи, шрифты и их реакции:
                  </Typography>
                  <TableContainer
                    component={Paper}
                    sx={{ maxHeight: 350, mb: 2 }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <b>Пользователь</b>
                          </TableCell>
                          <TableCell>
                            <b>Шрифт</b>
                          </TableCell>
                          <TableCell>
                            <b>Реакция</b>
                          </TableCell>
                          <TableCell align="center">
                            <b>Кол-во</b>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.values(
                          vizModalInfo.selectedGroup.groupAssocs.reduce(
                            (acc, a) => {
                              const key = `${a.user_username}||${a.cipher_name}||${a.reaction_description}`;
                              if (!acc[key])
                                acc[key] = {
                                  user: a.user_username,
                                  font: a.cipher_name,
                                  reaction: a.reaction_description,
                                  count: 0,
                                };
                              acc[key].count += 1;
                              return acc;
                            },
                            {}
                          )
                        )
                          .sort((a, b) => b.count - a.count)
                          .map((item, idx) => (
                            <TableRow
                              key={item.user + item.font + item.reaction + idx}
                            >
                              <TableCell>
                                {item.user || "(неизвестно)"}
                              </TableCell>
                              <TableCell sx={{ color: "#1976d2" }}>
                                {item.font || "(шрифт не указан)"}
                              </TableCell>
                              <TableCell>"{item.reaction}"</TableCell>
                              <TableCell align="center">
                                <b>{item.count}</b>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Button
                    onClick={() => setVizModalOpen(false)}
                    variant="outlined"
                    sx={{ mt: 1 }}
                  >
                    Закрыть
                  </Button>
                </Paper>
              )}
            </Paper>
          )}
      </TabPanel>
    </Container>
  );
};

export default NLPAnalysisPage;

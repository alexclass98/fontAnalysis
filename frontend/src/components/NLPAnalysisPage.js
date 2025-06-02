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
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useDispatch } from "react-redux";
import { setError } from "../store/errorSlice";
import { analyzeNLPText, analyzeAllAssociationsNLP } from "../api/api";
import { UMAP } from "umap-js";
import Plot from "react-plotly.js";

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

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
    setShowEmbeddingPlot(false);
    setPlotData([]);
  };

  const handleAnalyzeSingleText = async () => {
    if (!inputText.trim()) {
      dispatch(setError("Пожалуйста, введите текст для анализа."));
      return;
    }
    setLoadingSingle(true);
    setSingleTextAnalysisResults(null);
    setShowEmbeddingPlot(false);
    try {
      const data = await analyzeNLPText({ text: inputText });
      setSingleTextAnalysisResults(data);
    } catch (error) {
      console.error("Single NLP Analysis error:", error);
    } finally {
      setLoadingSingle(false);
    }
  };

  const fetchAllAssociationsAnalysis = async (page) => {
    setLoadingAll(true);
    setShowEmbeddingPlot(false);
    try {
      const data = await analyzeAllAssociationsNLP(page, pageSizeAllAssoc);
      setAllAssociationsData(data);
      setCurrentPageAllAssoc(page);
    } catch (error) {
      console.error("All Associations NLP Analysis error:", error);
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

  useEffect(() => {
    if (currentTab === 1 && allAssociationsData.results.length === 0) {
      fetchAllAssociationsAnalysis(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  const handlePageChangeAllAssoc = (event, value) => {
    fetchAllAssociationsAnalysis(value);
  };

  const generatePlotForEmbeddings = async (sourceType, analysisData) => {
    setShowEmbeddingPlot(false);
    setActivePlotSource(sourceType);

    let embeddings = [];
    let labels = [];

    if (
      sourceType === "single" &&
      analysisData &&
      analysisData.processing_variants
    ) {
      analysisData.processing_variants.forEach((variant) => {
        if (variant.result.text_embedding_vector) {
          embeddings.push(variant.result.text_embedding_vector);
          labels.push(
            `${variant.name.substring(
              0,
              20
            )}... (${analysisData.input_text.substring(0, 20)}...)`
          );
        }
      });
    } else if (
      sourceType === "all" &&
      analysisData &&
      Array.isArray(analysisData.results)
    ) {
      analysisData.results.forEach((assocAnalysis) => {
        assocAnalysis.processing_variants.forEach((variant) => {
          if (
            variant.name.includes("Текстовый Эмбеддинг") &&
            variant.result.text_embedding_vector
          ) {
            embeddings.push(variant.result.text_embedding_vector);
            labels.push(
              `ID:${
                assocAnalysis.association_id
              } (${assocAnalysis.original_reaction_text.substring(
                0,
                20
              )}...) - ${variant.name.substring(0, 10)}`
            );
          }
        });
      });
    }

    if (embeddings.length < 2) {
      dispatch(
        setError(
          "Недостаточно эмбеддингов для построения графика (нужно минимум 2)."
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
      const umap = new UMAP({
        nNeighbors: Math.min(15, embeddings.length - 1),
        minDist: 0.1,
        nComponents: 2,
      });

      const projection = await umap.fitAsync(embeddings);

      const trace = {
        x: projection.map((p) => p[0]),
        y: projection.map((p) => p[1]),
        mode: "markers",
        type: "scatter",
        text: labels,
        marker: { size: 8 },
      };
      setPlotData([trace]);
      setShowEmbeddingPlot(true);
    } catch (e) {
      console.error("Error during UMAP projection:", e);
      dispatch(setError(`Ошибка при снижении размерности: ${e.message}`));
      setPlotData([]);
      setShowEmbeddingPlot(false);
    } finally {
      tempLoadingSetter(false);
    }
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
                    {/* Отключено для экономии места, если не нужно всегда показывать вектор
                    {variant.result.text_embedding_vector && (
                       <TableRow>
                          <TableCell sx={{fontWeight: 'bold'}}>Vector (snippet)</TableCell>
                          <TableCell sx={{wordBreak: 'break-all'}}>{renderResultValue(variant.result.text_embedding_vector.slice(0,5).join(', ') + '...')}</TableCell>
                       </TableRow>
                    )}
                    */}
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
        </Tabs>
      </Box>

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
        <Button
          variant="contained"
          color="secondary"
          onClick={() => fetchAllAssociationsAnalysis(1)}
          disabled={loadingAll && !showEmbeddingPlot}
          sx={{ mb: 2 }}
        >
          {loadingAll &&
          !showEmbeddingPlot &&
          !allAssociationsData.results.length ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            "Загрузить/Обновить ассоциации"
          )}
        </Button>

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
              <Button
                onClick={() =>
                  generatePlotForEmbeddings("all", allAssociationsData)
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
                Визуализировать эмбеддинги (UMAP 2D) для текущей страницы
              </Button>
              {showEmbeddingPlot &&
                activePlotSource === "all" &&
                plotData.length > 0 && (
                  <Paper sx={{ p: 2, mt: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Визуализация эмбеддингов (UMAP 2D)
                    </Typography>
                    <Plot
                      data={plotData}
                      layout={{
                        width: "100%",
                        height: 600,
                        autosize: true,
                        xaxis: { title: "UMAP 1" },
                        yaxis: { title: "UMAP 2" },
                      }}
                      config={{ responsive: true }}
                    />
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
    </Container>
  );
};

export default NLPAnalysisPage;

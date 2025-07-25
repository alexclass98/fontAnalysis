import abc
import logging
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Set, Any
import numpy as np
from .utils import load_spacy_model
from pymorphy2 import MorphAnalyzer
from ruwordnet import RuWordNet
from sentence_transformers import SentenceTransformer

# Используем только логгер mainapp
logger = logging.getLogger('mainapp')

SBERT_MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'

_sentence_transformer_model = None
_sentence_transformer_init_error = None

def get_sentence_transformer() -> Optional[SentenceTransformer]:
    """
    Возвращает загруженную модель SentenceTransformer или None, если возникла ошибка.
    """
    global _sentence_transformer_model, _sentence_transformer_init_error
    if _sentence_transformer_model is None and _sentence_transformer_init_error is None:
        try:
            logger.info(f"Загрузка модели SentenceTransformer: {SBERT_MODEL_NAME}...")
            _sentence_transformer_model = SentenceTransformer(SBERT_MODEL_NAME)
            logger.info(f"Модель SentenceTransformer '{SBERT_MODEL_NAME}' успешно загружена.")
        except Exception as e:
            _sentence_transformer_init_error = e
            logger.error(f"Ошибка загрузки модели SentenceTransformer '{SBERT_MODEL_NAME}': {e}")
            _sentence_transformer_model = None
    if _sentence_transformer_init_error and _sentence_transformer_model is None:
        pass
    return _sentence_transformer_model

@dataclass
class NLPAnalysisResult:
    """
    Результат NLP анализа текста: токены, леммы, синонимы, эмбеддинги и ключ группировки.
    """
    original_text: str
    processed_text: Optional[str] = None
    tokens: List[str] = field(default_factory=list)
    lemmas: List[str] = field(default_factory=list)
    synonym_groups: Dict[str, Set[str]] = field(default_factory=dict)
    text_embedding: Optional[np.ndarray] = None
    token_embeddings: Dict[str, np.ndarray] = field(default_factory=dict)
    grouping_key: Optional[str] = None

    def __str__(self):
        data_dict = asdict(self)
        data_dict["text_embedding_exists"] = self.text_embedding is not None
        data_dict["token_embeddings_count"] = len(self.token_embeddings)
        if "text_embedding" in data_dict: del data_dict["text_embedding"]
        if "token_embeddings" in data_dict: del data_dict["token_embeddings"]
        return f"NLPAnalysisResult({data_dict})"

    def get_lemmas_as_string(self) -> str:
        if not self.lemmas: return ""
        return " ".join(sorted(list(set(self.lemmas))))

    def get_canonical_synonyms_as_string(self) -> str:
        if not self.synonym_groups:
            return self.get_lemmas_as_string() if self.lemmas else ""
        canonical_forms = set(self.synonym_groups.keys())
        return " ".join(sorted(list(canonical_forms)))

class ITextProcessorBuilder(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def set_text(self, text: str): pass
    @abc.abstractmethod
    def preprocess_text(self): pass
    @abc.abstractmethod
    def tokenize(self): pass
    @abc.abstractmethod
    def remove_stopwords(self): pass
    @abc.abstractmethod
    def lemmatize(self): pass
    @abc.abstractmethod
    def group_synonyms(self): pass
    @abc.abstractmethod
    def generate_text_embedding(self): pass
    @abc.abstractmethod
    def generate_token_embeddings(self): pass
    @abc.abstractmethod
    def set_grouping_key(self, strategy: str): pass
    @abc.abstractmethod
    def get_result(self) -> NLPAnalysisResult: pass

class AdvancedTextProcessorBuilder(ITextProcessorBuilder):
    """
    Реализация builder для поэтапной обработки текста: spaCy, pymorphy2, RuWordNet, SBERT.
    """
    def __init__(self):
        self._nlp_model = load_spacy_model()
        self._morph = MorphAnalyzer()
        self._sbert_model = get_sentence_transformer()
        self._rwn_instance_local = None
        self.reset()

    def _get_rwn_local_instance(self):
        if self._rwn_instance_local is None:
            try:
                logger.debug("Создание локального экземпляра RuWordNet...")
                self._rwn_instance_local = RuWordNet()
                logger.info("Локальный экземпляр RuWordNet успешно создан.")
            except Exception as e:
                logger.error(f"Ошибка создания локального экземпляра RuWordNet: {e}")
                self._rwn_instance_local = None
        return self._rwn_instance_local

    def reset(self):
        self._original_text: Optional[str] = None
        self._processed_text: Optional[str] = None
        self._doc: Optional[Any] = None
        self._tokens_after_stopwords: List[str] = []
        self._result = None

    def set_text(self, text: str) -> 'AdvancedTextProcessorBuilder':
        self.reset()
        self._original_text = text
        self._result = NLPAnalysisResult(original_text=self._original_text)
        if not self._original_text:
            logger.warning("AdvancedTextProcessorBuilder: Установлен пустой текст.")
        return self

    def preprocess_text(self) -> 'AdvancedTextProcessorBuilder':
        if not self._result or not self._original_text:
            logger.warning("preprocess_text: Текст не установлен, предобработка пропущена.")
            return self
        
        self._processed_text = self._original_text.lower().strip()
        self._result.processed_text = self._processed_text
        
        if self._nlp_model and self._processed_text:
            try:
                self._doc = self._nlp_model(self._processed_text)
            except Exception as e:
                logger.error(f"Ошибка создания spaCy Doc для текста '{self._processed_text[:50]}...': {e}")
                self._doc = None
        elif not self._nlp_model:
            logger.warning("preprocess_text: Модель spaCy не загружена, обработка spaCy Doc пропущена.")
        return self

    def tokenize(self) -> 'AdvancedTextProcessorBuilder':
        if not self._result: return self
        if not self._doc:
            if self._result.processed_text:
                 self._result.tokens = [t for t in self._result.processed_text.split() if t.isalpha()]
                 logger.warning(f"tokenize: spaCy Doc отсутствует. Выполнена базовая токенизация для '{self._result.processed_text[:50]}...'.")
            else:
                 logger.warning("tokenize: spaCy Doc и processed_text отсутствуют, токенизация пропущена.")
            return self
        
        self._result.tokens = [token.text for token in self._doc if token.is_alpha]
        return self

    def remove_stopwords(self) -> 'AdvancedTextProcessorBuilder':
        if not self._result: return self
        if not self._doc:
            logger.warning("remove_stopwords: spaCy Doc отсутствует, удаление стоп-слов не может быть выполнено через spaCy.")
            self._tokens_after_stopwords = self._result.tokens
            return self

        self._tokens_after_stopwords = [token.text for token in self._doc if token.is_alpha and not token.is_stop]
        self._result.tokens = self._tokens_after_stopwords
        return self

    def lemmatize(self) -> 'AdvancedTextProcessorBuilder':
        if not self._result: return self
        
        tokens_to_lemmatize = self._tokens_after_stopwords if self._tokens_after_stopwords else self._result.tokens
        
        if not tokens_to_lemmatize and self._doc:
            tokens_to_lemmatize = [token.text for token in self._doc if token.is_alpha and \
                                   (not self._tokens_after_stopwords or not token.is_stop)]
        
        if not tokens_to_lemmatize:
            logger.warning("lemmatize: Нет токенов для лемматизации.")
            self._result.lemmas = []
            return self

        lemmas = []
        for token_text in tokens_to_lemmatize:
            lemma_found_spacy = False
            if self._doc:
                spacy_token_obj = next((t for t in self._doc if t.text == token_text), None)
                if spacy_token_obj and spacy_token_obj.lemma_:
                    lemmas.append(spacy_token_obj.lemma_)
                    lemma_found_spacy = True
            
            if not lemma_found_spacy:
                try:
                    parsed_morph = self._morph.parse(token_text)
                    if parsed_morph:
                        lemmas.append(parsed_morph[0].normal_form)
                    else:
                        lemmas.append(token_text)
                except Exception as e:
                    logger.error(f"Ошибка Pymorphy2 при лемматизации токена '{token_text}': {e}")
                    lemmas.append(token_text)
        
        self._result.lemmas = lemmas
        return self

    def _get_canonical_form_rwn(self, lemma: str) -> str:
        rwn = self._get_rwn_local_instance()
        if not rwn:
            logger.warning(f"RuWordNet недоступен для леммы '{lemma}', возвращается исходная лемма.")
            return lemma
        try:
            senses = rwn.get_senses(lemma)
            if senses:
                synset = senses[0].synset
                if synset:
                    if synset.title and synset.title.strip(): return synset.title.lower()
                    elif synset.senses and len(synset.senses) > 0 and synset.senses[0].name: return synset.senses[0].name.lower()
            return lemma
        except Exception as e:
             logger.error(f"Ошибка RuWordNet при обработке леммы '{lemma}': {e}")
        return lemma

    def group_synonyms(self) -> 'AdvancedTextProcessorBuilder':
        rwn = self._get_rwn_local_instance()
        if not self._result or not self._result.lemmas:
            logger.warning("Группировка синонимов пропущена: леммы отсутствуют.")
            return self
        if not rwn:
            logger.warning("Группировка синонимов пропущена: RuWordNet не доступен.")
            return self
        
        current_lemmas = self._result.lemmas
        syn_groups_dict: Dict[str, Set[str]] = {}
        
        for lemma in current_lemmas:
            canonical_form = self._get_canonical_form_rwn(lemma)
            if canonical_form not in syn_groups_dict:
                syn_groups_dict[canonical_form] = set()
            syn_groups_dict[canonical_form].add(lemma)
            
        self._result.synonym_groups = syn_groups_dict
        return self

    def generate_text_embedding(self) -> 'AdvancedTextProcessorBuilder':
        if not self._result:
            logger.warning("generate_text_embedding пропущен: результат не инициализирован."); return self
        if not self._sbert_model:
            logger.warning("generate_text_embedding пропущен: модель SentenceTransformer не загружена."); return self
        
        text_to_embed = ""
        if self._result.lemmas:
            text_to_embed = " ".join(self._result.lemmas)
        elif self._result.processed_text:
            text_to_embed = self._result.processed_text
        elif self._original_text:
            text_to_embed = self._original_text
        
        if not text_to_embed or not text_to_embed.strip():
            logger.warning("generate_text_embedding пропущен: текст для эмбеддинга пуст.")
            self._result.text_embedding = None
            return self
        try:
            embedding = self._sbert_model.encode(text_to_embed, convert_to_numpy=True, show_progress_bar=False)
            self._result.text_embedding = embedding
        except Exception as e:
            logger.error(f"Ошибка при генерации эмбеддинга текста '{text_to_embed[:50]}...': {e}")
            self._result.text_embedding = None
        return self

    def generate_token_embeddings(self):
        logger.warning("generate_token_embeddings не реализован для SentenceTransformer в текущей конфигурации, т.к. он генерирует эмбеддинг для всего текста.")
        if not self._result: return self
        return self

    def set_grouping_key(self, strategy: str) -> 'AdvancedTextProcessorBuilder':
        if not self._result: return self
        
        if strategy == "original": self._result.grouping_key = self._result.original_text
        elif strategy == "processed": self._result.grouping_key = self._result.processed_text
        elif strategy == "lemmas": self._result.grouping_key = self._result.get_lemmas_as_string()
        elif strategy == "synonyms": self._result.grouping_key = self._result.get_canonical_synonyms_as_string()
        else:
            logger.warning(f"Неизвестная стратегия группировки '{strategy}'. Используется 'lemmas'.")
            self._result.grouping_key = self._result.get_lemmas_as_string()
        
        if self._result.grouping_key is None:
            self._result.grouping_key = ""
        return self

    def get_result(self) -> NLPAnalysisResult:
        if not self._result:
            return NLPAnalysisResult(original_text="", grouping_key="")
        
        if self._result.grouping_key is None:
            self.set_grouping_key("lemmas")
            
        return self._result

class NLPProcessingDirector:
    """
    Директор для управления процессом NLP-анализа с помощью builder.
    """
    def __init__(self, builder: ITextProcessorBuilder):
        self._builder = builder

    def set_builder(self, builder: ITextProcessorBuilder) -> None:
        self._builder = builder

    def construct_custom_analysis(self, text: str, preprocess: bool = True, tokenize_step: bool = True, remove_stops: bool = True, lemmatize_step: bool = True, group_syns: bool = False, gen_text_emb: bool = False, gen_token_embs: bool = False, grouping_strategy: str = "lemmas") -> NLPAnalysisResult:
        if not text or not text.strip():
            return NLPAnalysisResult(original_text=text or "", grouping_key="")

        self._builder.set_text(text)
        
        doc_exists_after_preprocess = False

        if preprocess:
            self._builder.preprocess_text()
            doc_exists_after_preprocess = hasattr(self._builder, '_doc') and self._builder._doc is not None
        
        if tokenize_step:
            if doc_exists_after_preprocess:
                self._builder.tokenize()
            elif preprocess and self._builder._result and self._builder._result.processed_text:
                self._builder.tokenize()
            else:
                 logger.warning(f"Токенизация для '{text[:30]}...' не выполнена: spaCy Doc отсутствует или нет текста после preprocess.")
        
        if remove_stops:
            if doc_exists_after_preprocess:
                self._builder.remove_stopwords()
            else:
                 logger.warning(f"Удаление стоп-слов для '{text[:30]}...' не выполнено: spaCy Doc отсутствует.")
        
        if lemmatize_step:
            needs_re_tokenize = False
            if not (self._builder._result and (self._builder._result.tokens or self._builder._tokens_after_stopwords)):
                needs_re_tokenize = True
            
            if needs_re_tokenize and not doc_exists_after_preprocess :
                 if preprocess and not doc_exists_after_preprocess:
                     self._builder.preprocess_text()
                     doc_exists_after_preprocess = hasattr(self._builder, '_doc') and self._builder._doc is not None
                 if tokenize_step and (doc_exists_after_preprocess or (self._builder._result and self._builder._result.processed_text)):
                     self._builder.tokenize()
            self._builder.lemmatize()

        if group_syns:
            lemmas_exist = self._builder._result and self._builder._result.lemmas and len(self._builder._result.lemmas) > 0
            if not lemmas_exist and lemmatize_step:
                if not (self._builder._result and self._builder._result.tokens):
                    if tokenize_step: self._builder.tokenize()
                self._builder.lemmatize()
                lemmas_exist = self._builder._result and self._builder._result.lemmas and len(self._builder._result.lemmas) > 0

            if lemmas_exist:
                self._builder.group_synonyms()
            else:
                 logger.warning(f"Группировка синонимов для '{text[:30]}...' невозможна: леммы отсутствуют.")
        
        if gen_text_emb:
            self._builder.generate_text_embedding()
        
        if gen_token_embs:
            self._builder.generate_token_embeddings()
            
        self._builder.set_grouping_key(grouping_strategy)
        
        return self._builder.get_result()
import spacy
import logging

logger = logging.getLogger(__name__)
nlp = None

def load_spacy_model(model_name="ru_core_news_sm"):
    global nlp
    if nlp is None:
        try:
            logger.info(f"Загрузка модели spaCy: {model_name}...")
            nlp = spacy.load(model_name)
            logger.info("Модель spaCy успешно загружена.")
        except OSError:
            logger.warning(f"Модель {model_name} не найдена. Попытка загрузки...")
            try:
                spacy.cli.download(model_name)
                nlp = spacy.load(model_name)
                logger.info(f"Модель {model_name} успешно загружена после скачивания.")
            except Exception as e:
                logger.error(f"Не удалось загрузить модель spaCy {model_name}: {e}")
                nlp = None
        except Exception as e:
             logger.error(f"Неизвестная ошибка при загрузке модели spaCy: {e}")
             nlp = None
    return nlp

def get_lemmas(text):
    if not text: return ""
    nlp_model = load_spacy_model()
    if not nlp_model:
         logger.warning("Модель spaCy не загружена, лемматизация невозможна.")
         return ""

    try:
        doc = nlp_model(text.lower())
        lemmas = [token.lemma_ for token in doc if token.is_alpha and not token.is_stop]
        return " ".join(sorted(list(set(lemmas))))
    except Exception as e:
        logger.error(f"Ошибка при лемматизации текста '{text[:50]}...': {e}")
        return ""

load_spacy_model()
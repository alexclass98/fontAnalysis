from django.http import JsonResponse
from django.views import View
from django.contrib.auth import get_user_model, authenticate
from django.db.models import Count, Q, F, ExpressionWrapper, FloatField, Value
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from .models import Study, Cipher, Association, Administrator, Reaction
from .serializers import RegisterSerializer, LoginSerializer, CipherSerializer, AssociationSerializer, CustomTokenObtainPairSerializer
from .nlp_processor import (
    AdvancedTextProcessorBuilder,
    NLPProcessingDirector,
    NLPAnalysisResult,
    get_sentence_transformer,
    SBERT_MODEL_NAME
)
from .gateway import AssociationFinder_ForRowData

import random
import itertools
import logging
from collections import Counter, defaultdict
import numpy as np
from sentence_transformers.util import cos_sim

logger = logging.getLogger(__name__)
User = get_user_model()

FONT_WEIGHTS = [fw[0] for fw in Association.FontWeight.choices]
FONT_STYLES = [fs[0] for fs in Association.FontStyle.choices]
LETTER_SPACINGS = [0, 10]
FONT_SIZES = [12, 16, 20]
LINE_HEIGHTS = [1.2, 1.5, 1.8]

def get_nlp_params_from_request(request_data_dict):
    def _get_value(param_key, default_str_value):
        value = None
        if param_key in request_data_dict:
            value = request_data_dict.get(param_key)
            if isinstance(value, list) and value:
                value = value[0]
        if value is None and hasattr(request_data_dict, 'getlist'):
            nested_key_candidate = f'aggregate_by_lemma[{param_key}]'
            if nested_key_candidate in request_data_dict:
                value = request_data_dict.get(nested_key_candidate)
                if isinstance(value, list) and value:
                    value = value[0]
        if value is not None:
            return str(value)
        return default_str_value

    preprocess_val_str = _get_value('preprocess', 'true')
    remove_stops_val_str = _get_value('remove_stops', 'true')
    lemmatize_val_str = _get_value('lemmatize', 'true')
    group_syns_val_str = _get_value('group_syns', 'false')
    grouping_strategy_val = _get_value('grouping_strategy', 'lemmas')

    preprocess_val = preprocess_val_str.lower() == 'true'
    remove_stops_val = remove_stops_val_str.lower() == 'true'
    lemmatize_val = lemmatize_val_str.lower() == 'true'
    group_syns_val = group_syns_val_str.lower() == 'true'
    tokenize_needed = remove_stops_val or lemmatize_val or group_syns_val or (preprocess_val and (lemmatize_val or remove_stops_val or group_syns_val))

    params = {
        "preprocess": preprocess_val,
        "remove_stops": remove_stops_val,
        "lemmatize_step": lemmatize_val,
        "group_syns": group_syns_val,
        "grouping_strategy": grouping_strategy_val,
        "tokenize_step": tokenize_needed,
    }
    return params

class UserView(APIView):
    def get_permissions(self):
        if self.kwargs.get('action') in ['register', 'login']: return [AllowAny()]
        if self.request.method == 'DELETE': return [IsAdminUser()]
        return [IsAuthenticated()]
    def post(self, request, action=None):
        if action == 'register':
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user = serializer.save()
                refresh = CustomTokenObtainPairSerializer.get_token(user)
                user_data = {"id": user.id, "username": user.username, "email": user.email, "first_name": user.first_name, "last_name": user.last_name}
                if hasattr(user, 'profile') and user.profile: user_data['profile'] = {'gender': user.profile.gender, 'age': user.profile.age, 'education_level': user.profile.education_level, 'specialty': user.profile.specialty}
                return Response({"message": "Регистрация успешна!", "user": user_data, "access": str(refresh.access_token), "refresh": str(refresh)}, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif action == 'login':
            login_serializer = LoginSerializer(data=request.data)
            if login_serializer.is_valid():
                user = authenticate(**login_serializer.validated_data)
                if user:
                    refresh = CustomTokenObtainPairSerializer.get_token(user)
                    user_data = {"id": user.id, "username": user.username, "email": user.email, "first_name": user.first_name, "last_name": user.last_name}
                    if hasattr(user, 'profile') and user.profile: user_data['profile'] = {'gender': user.profile.gender, 'age': user.profile.age, 'education_level': user.profile.education_level, 'specialty': user.profile.specialty}
                    return Response({"refresh": str(refresh), "access": str(refresh.access_token), "user": user_data, "is_admin": Administrator.objects.filter(user=user).exists()}, status=status.HTTP_200_OK)
                return Response({"error": "Неверные учетные данные"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(login_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        return Response({"error": "Недопустимое действие"}, status=status.HTTP_400_BAD_REQUEST)
    def get(self, request, user_id=None):
        if user_id: return Response({"error": "Метод GET для одного пользователя не реализован"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
        if not request.user.is_staff and not hasattr(request.user, 'administrator'): return Response({"error": "Недостаточно прав для просмотра пользователей"}, status=status.HTTP_403_FORBIDDEN)
        users_data = []
        for u in User.objects.all():
            data = {"id": u.id, "username": u.username, "email": u.email, "first_name": u.first_name, "last_name": u.last_name}
            if hasattr(u, 'profile') and u.profile: data['profile'] = {'gender': u.profile.gender, 'age': u.profile.age, 'education_level': u.profile.education_level, 'specialty': u.profile.specialty}
            users_data.append(data)
        return Response(users_data, status=status.HTTP_200_OK)
    def delete(self, request, user_id=None):
        if user_id is None: return Response({"error": "Не указан ID пользователя для удаления"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_to_delete = User.objects.get(id=user_id)
            if user_to_delete == request.user: return Response({"error": "Нельзя удалить самого себя"}, status=status.HTTP_400_BAD_REQUEST)
            user_to_delete.delete()
            return Response({"message": "Пользователь удален"}, status=status.HTTP_200_OK)
        except User.DoesNotExist: return Response({"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e: return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class RandomCipherView(APIView):
    permission_classes = [IsAuthenticated]
    POPULAR_CIPHERS = ["Times New Roman", "Arial", "Helvetica", "Garamond", "Comic Sans", "Courier New", "Georgia", "Verdana", "Baskerville", "Sans Forgetica"]
    def _create_popular_ciphers(self):
        for font_name in self.POPULAR_CIPHERS: Cipher.objects.get_or_create(result=font_name)
        return list(Cipher.objects.all())
    def post(self, request):
        user = request.user
        variations_params = {key: request.data.get(key, True) for key in ['vary_weight', 'vary_style', 'vary_spacing', 'vary_size', 'vary_leading']}
        seen_combinations = set(Association.objects.filter(user=user).values_list('cipher_id', 'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height'))
        all_ciphers = list(Cipher.objects.all()) or self._create_popular_ciphers()
        if not all_ciphers: return Response({"error": "Не удалось создать или найти шрифты."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        random.shuffle(all_ciphers)
        for base_cipher in all_ciphers:
            weights_to_try = FONT_WEIGHTS if variations_params['vary_weight'] else [Association.FontWeight.REGULAR]
            styles_to_try = FONT_STYLES if variations_params['vary_style'] else [Association.FontStyle.NORMAL]
            spacings_to_try = LETTER_SPACINGS if variations_params['vary_spacing'] else [0]
            sizes_to_try = FONT_SIZES if variations_params['vary_size'] else [16]
            leadings_to_try = LINE_HEIGHTS if variations_params['vary_leading'] else [1.5]
            possible_combinations = list(itertools.product([base_cipher.id], weights_to_try, styles_to_try, spacings_to_try, sizes_to_try, leadings_to_try))
            random.shuffle(possible_combinations)
            for combo in possible_combinations:
                if combo not in seen_combinations:
                    return Response({"cipher_id": combo[0], "result": base_cipher.result, "font_weight": combo[1], "font_style": combo[2], "letter_spacing": combo[3], "font_size": combo[4], "line_height": float(combo[5])}, status=status.HTTP_200_OK)
        return Response({"message": "Вы прошли все доступные вариации шрифтов для выбранных настроек!", "all_seen": True}, status=status.HTTP_200_OK)

class StudyView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        data = request.data; user = request.user
        if not isinstance(data, list): return Response({"error": "Ожидается список объектов исследования."}, status=status.HTTP_400_BAD_REQUEST)
        results, errors = [], []
        default_nlp_params = {
            "preprocess": True, "remove_stops": True, "lemmatize_step": True,
            "group_syns": False, "grouping_strategy": "lemmas", "tokenize_step": True
        }
        for item in data:
            item_nlp_params_from_request = item.get("processing_options", {})
            actual_nlp_params = default_nlp_params.copy()
            actual_nlp_params.update(item_nlp_params_from_request)

            result = self._save_single_study(item, user, actual_nlp_params)
            if "error" in result: errors.append(result)
            elif not result.get("skipped"): results.append(result)
        status_code = status.HTTP_207_MULTI_STATUS if errors and results else (status.HTTP_400_BAD_REQUEST if errors else status.HTTP_201_CREATED)
        message = "Сохранение завершено." if not errors or results else "Сохранение завершено с ошибками."
        return Response({"message": message, "saved": results, "errors": errors}, status=status_code)

    def _save_single_study(self, study_data, user, nlp_params_for_save):
        cipher_id = study_data.get("cipher_id"); reaction_description = study_data.get("reaction_description")
        font_weight = study_data.get("font_weight", Association.FontWeight.REGULAR); font_style = study_data.get("font_style", Association.FontStyle.NORMAL)
        letter_spacing = study_data.get("letter_spacing", 0); font_size = study_data.get("font_size", 16); line_height = study_data.get("line_height", 1.5)
        
        if not reaction_description or reaction_description.strip() == "" or reaction_description == "[skipped]": 
            return {"skipped": True, "cipher_id": cipher_id, "reason": "Empty or skipped reaction"}
        if not cipher_id: return {"error": "Поле 'cipher_id' (базовый шрифт) обязательно", "data": study_data}
        if font_weight not in FONT_WEIGHTS or font_style not in FONT_STYLES: return {"error": "Недопустимые значения weight или style", "data": study_data}
        try:
            cipher = Cipher.objects.get(id=cipher_id)
            nlp_builder = AdvancedTextProcessorBuilder(); nlp_director = NLPProcessingDirector(builder=nlp_builder)
            if (nlp_params_for_save.get("lemmatize_step") or nlp_params_for_save.get("group_syns")) and not nlp_params_for_save.get("tokenize_step"):
                nlp_params_for_save["tokenize_step"] = True

            analysis_result: NLPAnalysisResult = nlp_director.construct_custom_analysis(text=reaction_description, **nlp_params_for_save)
            
            processed_reaction_key = analysis_result.grouping_key if analysis_result.grouping_key is not None else ""
            if not processed_reaction_key and analysis_result.lemmas:
                processed_reaction_key = " ".join(sorted(list(set(analysis_result.lemmas))))
            
            association, created = Association.objects.get_or_create(
                user=user, cipher=cipher, font_weight=font_weight, font_style=font_style, letter_spacing=letter_spacing, font_size=font_size, line_height=line_height,
                defaults={'reaction_description': reaction_description, 'reaction_lemmas': processed_reaction_key}
            )
            if not created:
                 return {"error": "Повторная реакция на ту же вариацию", "skipped": True, "data": study_data}
            
            return {"association_id": association.id, "processed_key_saved": processed_reaction_key, "original_reaction": reaction_description}
        except Cipher.DoesNotExist: return {"error": f"Базовый шрифт с ID {cipher_id} не найден", "data": study_data}
        except Exception as e: 
            logger.error(f"StudyView: Ошибка сохранения {study_data} для {user.id}: {e}", exc_info=True)
            return {"error": "Внутренняя ошибка сервера при сохранении", "details": str(e), "data": study_data}

class GraphView(View):
    def get(self, request):
        nlp_params = get_nlp_params_from_request(request.GET)
        try:
            qs = Association.objects.select_related('cipher').filter(
                reaction_description__isnull=False
            ).exclude(reaction_description__exact='').values_list(
                'cipher__result', 'reaction_description'
            )
        except Exception as e:
            logger.error(f"GraphView: Ошибка при получении данных: {e}")
            return JsonResponse({"error": "Не удалось получить данные об ассоциациях"}, status=500)

        nlp_builder = AdvancedTextProcessorBuilder()
        nlp_director = NLPProcessingDirector(builder=nlp_builder)
        nlp_cache = {}
        frequency = Counter()

        for font_name, reaction_desc in qs:
            if not font_name or not reaction_desc:
                continue
            if reaction_desc not in nlp_cache:
                analysis_result = nlp_director.construct_custom_analysis(
                    text=reaction_desc, **nlp_params
                )
                processed_desc = analysis_result.grouping_key or ""
                nlp_cache[reaction_desc] = processed_desc
            else:
                processed_desc = nlp_cache[reaction_desc]
            if not processed_desc:
                processed_desc = reaction_desc[:50]
            key = (font_name, processed_desc)
            frequency[key] += 1

        data = [
            {'name': name, 'description': desc, 'count': count}
            for (name, desc), count in frequency.items()
        ]
        return JsonResponse(data, safe=False)

class AssociationSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        search_query_original_raw = request.data.get('reaction_description')
        
        if search_query_original_raw is None: search_query_original = ""
        elif isinstance(search_query_original_raw, str): search_query_original = search_query_original_raw.strip()
        else:
            return Response({"error": "Неверный формат поискового запроса (reaction_description). Ожидалась строка."}, status=status.HTTP_400_BAD_REQUEST)

        match_exact_variation = str(request.data.get('match_exact_variation', 'true')).lower() == 'true'
        search_use_embeddings = str(request.data.get('search_use_embeddings', 'false')).lower() == 'true'
        multi_word_logic = request.data.get('multi_word_logic', 'OR').upper()

        nlp_params_from_req = get_nlp_params_from_request(request.data)

        if not search_query_original: 
            return Response([], status=status.HTTP_200_OK)

        nlp_builder = AdvancedTextProcessorBuilder()
        nlp_director = NLPProcessingDirector(builder=nlp_builder)

        if search_use_embeddings:
            sbert_model = get_sentence_transformer()
            if not sbert_model:
                logger.error("AssociationSearchView: Модель SentenceTransformer не загружена.")
                return Response({"error": "Модель для семантического поиска не загружена на сервере."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            nlp_params_for_embedding_search = {
                "preprocess": nlp_params_from_req.get('preprocess', True),
                "tokenize_step": True,
                "remove_stops": nlp_params_from_req.get('remove_stops', True),
                "lemmatize_step": nlp_params_from_req.get('lemmatize_step', True),
                "group_syns": False,
                "grouping_strategy": "lemmas",
                "gen_text_emb": True
            }
            
            query_analysis_result_emb: NLPAnalysisResult = nlp_director.construct_custom_analysis(
                text=search_query_original, 
                **nlp_params_for_embedding_search
            )

            if query_analysis_result_emb.text_embedding is None:
                logger.error(f"AssociationSearchView: Не удалось получить эмбеддинг для запроса '{search_query_original}'.")
                return Response({"error": "Не удалось обработать поисковый запрос для семантического поиска."}, status=status.HTTP_400_BAD_REQUEST)
            
            query_embedding = query_analysis_result_emb.text_embedding
            logger.info(f"AssociationSearchView: Вектор для запроса '{search_query_original}' получен, форма: {query_embedding.shape}.")

            candidate_associations = Association.objects.select_related('cipher').filter(
                reaction_description__isnull=False
            ).exclude(reaction_description__exact='')
            
            if not candidate_associations.exists():
                return Response([], status=status.HTTP_200_OK)

            results_with_similarity = []
            texts_to_embed_from_db = []
            assoc_objects_map = []

            for assoc in candidate_associations:
                text_for_assoc_emb = assoc.reaction_lemmas
                if not text_for_assoc_emb or not text_for_assoc_emb.strip():
                    temp_nlp_params = nlp_params_for_embedding_search.copy()
                    temp_nlp_params["gen_text_emb"] = False
                    assoc_text_analysis: NLPAnalysisResult = nlp_director.construct_custom_analysis(
                        text=assoc.reaction_description, **temp_nlp_params
                    )
                    text_for_assoc_emb = assoc_text_analysis.grouping_key
                
                if text_for_assoc_emb and text_for_assoc_emb.strip():
                    texts_to_embed_from_db.append(text_for_assoc_emb)
                    assoc_objects_map.append(assoc)
                else:
                    logger.warning(f"Пропуск ассоциации ID {assoc.id} из-за отсутствия текста для эмбеддинга.")

            if not texts_to_embed_from_db:
                logger.info("Нет текстов из БД для генерации эмбеддингов.")
                return Response([], status=status.HTTP_200_OK)

            try:
                document_embeddings = sbert_model.encode(texts_to_embed_from_db, convert_to_numpy=True, show_progress_bar=False)
            except Exception as e:
                logger.error(f"Ошибка при пакетном кодировании текстов из БД: {e}")
                return Response({"error": "Ошибка при обработке данных для семантического поиска."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            for i, assoc_embedding_np in enumerate(document_embeddings):
                assoc = assoc_objects_map[i]
                similarity = cos_sim(query_embedding, assoc_embedding_np).item()

                if similarity < 0.3:
                    continue

                serialized_assoc = AssociationSerializer(assoc).data
                serialized_assoc['cipher_name'] = assoc.cipher.result 
                
                results_with_similarity.append({
                    'details': serialized_assoc,
                    'best_reaction_text': assoc.reaction_description,
                    'best_reaction_relevance_percentage': round(similarity * 100, 2),
                    'best_reaction_frequency': 1,
                    'total_associations_in_variation': 1,
                    'aggregated_by_font_only': not match_exact_variation, 
                    'relative_frequency_percentage': 0,
                    'similarity_score_debug': similarity
                })
            
            results_with_similarity.sort(key=lambda x: x['best_reaction_relevance_percentage'], reverse=True)
            return Response(results_with_similarity[:20], status=status.HTTP_200_OK) 

        else: 
            temp_nlp_params_for_tokenization = nlp_params_from_req.copy()
            if not temp_nlp_params_for_tokenization.get('tokenize_step', False) and \
               (temp_nlp_params_for_tokenization.get('remove_stops', False) or \
                temp_nlp_params_for_tokenization.get('lemmatize_step', False) or \
                temp_nlp_params_for_tokenization.get('group_syns', False)):
                temp_nlp_params_for_tokenization['tokenize_step'] = True
            
            query_analysis_result: NLPAnalysisResult = nlp_director.construct_custom_analysis(
                text=search_query_original, 
                **temp_nlp_params_for_tokenization
            )
            
            search_terms_list_candidate = None
            current_grouping_strategy = nlp_params_from_req.get("grouping_strategy", "lemmas") 
            
            if current_grouping_strategy == "original":
                minimal_processing_params = {'preprocess': nlp_params_from_req.get('preprocess', True), 'tokenize_step': True}
                original_tokens_result: NLPAnalysisResult = nlp_director.construct_custom_analysis(
                    text=search_query_original, **minimal_processing_params
                )
                search_terms_list_candidate = original_tokens_result.tokens
            elif current_grouping_strategy == "processed":
                search_terms_list_candidate = query_analysis_result.tokens 
            elif current_grouping_strategy in ["lemmas", "synonyms"]: 
                key_from_strategy = query_analysis_result.grouping_key 
                if key_from_strategy and key_from_strategy.strip():
                     search_terms_list_candidate = key_from_strategy.split()
            
            if not search_terms_list_candidate: 
                search_terms_list_candidate = query_analysis_result.lemmas if query_analysis_result.lemmas else query_analysis_result.tokens

            search_terms_list = sorted(list(set(term.lower() for term in search_terms_list_candidate if term.strip()))) if search_terms_list_candidate else []
            
            if not search_terms_list:
                return Response([], status=status.HTTP_200_OK)

            num_query_terms = len(search_terms_list)

            q_objects = Q()
            if multi_word_logic == 'AND':
                for term in search_terms_list:
                    q_objects &= Q(reaction_lemmas__icontains=term)
            else: 
                for term in search_terms_list:
                    q_objects |= Q(reaction_lemmas__icontains=term)
            
            if not q_objects and search_query_original: 
                q_objects = Q(reaction_description__icontains=search_query_original)
            elif not q_objects: 
                 return Response({"error": "Не удалось сформировать условия поиска."}, status=status.HTTP_400_BAD_REQUEST)

            candidate_associations = Association.objects.filter(q_objects).select_related('cipher').only(
                'id', 'cipher_id', 'cipher__result', 'reaction_description', 'reaction_lemmas', 
                'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height', 'created_at', 'user_id'
            ) 

            if not candidate_associations.exists():
                return Response([], status=status.HTTP_200_OK)

            variation_reaction_groups = defaultdict(lambda: defaultdict(lambda: {
                'count': 0, 
                'original_descs': [], 
                'query_relevance_scores': [] 
            }))
            
            variation_representative_obj = {}

            for assoc in candidate_associations:
                assoc_processed_key = assoc.reaction_lemmas.lower() if assoc.reaction_lemmas else ""
                
                variation_key_values = [assoc.cipher.result]
                if match_exact_variation:
                     variation_key_values.extend([
                        assoc.font_weight, assoc.font_style, 
                        assoc.letter_spacing, assoc.font_size, float(assoc.line_height) 
                    ])
                variation_key = tuple(variation_key_values)

                if variation_key not in variation_representative_obj or \
                   (variation_representative_obj[variation_key].created_at and assoc.created_at and \
                    assoc.created_at > variation_representative_obj[variation_key].created_at):
                    variation_representative_obj[variation_key] = assoc

                matched_terms_count = 0
                if assoc_processed_key: 
                    current_assoc_terms_set = set(assoc_processed_key.split())
                    for query_term_in_lower in search_terms_list:
                        if query_term_in_lower in current_assoc_terms_set:
                            matched_terms_count += 1
                
                query_relevance_score = (matched_terms_count / num_query_terms) if num_query_terms > 0 else 0.0
                if multi_word_logic == 'AND' and matched_terms_count < num_query_terms:
                    query_relevance_score = 0.0 

                group_data = variation_reaction_groups[variation_key][assoc_processed_key]
                group_data['count'] += 1
                group_data['original_descs'].append(assoc.reaction_description)
                if matched_terms_count > 0 : 
                     group_data['query_relevance_scores'].append(query_relevance_score)

            final_results_payload = []
            for variation_key, reactions_in_variation in variation_reaction_groups.items():
                best_reaction_for_variation = None
                max_weighted_score = -1.0 
                total_associations_in_variation_group = 0

                for reaction_key_from_db, data in reactions_in_variation.items():
                    reaction_frequency = data['count']
                    total_associations_in_variation_group += reaction_frequency
                    avg_query_relevance = 0.0
                    if data['query_relevance_scores']: 
                        avg_query_relevance = sum(data['query_relevance_scores']) / len(data['query_relevance_scores'])
                    
                    if avg_query_relevance == 0.0 and multi_word_logic == 'AND' and num_query_terms > 0:
                        continue

                    current_weighted_score = reaction_frequency * avg_query_relevance 
                    
                    if current_weighted_score > max_weighted_score :
                        max_weighted_score = current_weighted_score
                        most_common_original_desc = "N/A"
                        if data['original_descs']:
                            counts = Counter(data['original_descs'])
                            most_common_original_desc = counts.most_common(1)[0][0]
                        
                        best_reaction_for_variation = {
                            'reaction_text': most_common_original_desc,
                            'lemmas_key': reaction_key_from_db,
                            'frequency_in_group': reaction_frequency,
                            'query_relevance_percentage': avg_query_relevance * 100.0,
                            'weighted_score': current_weighted_score
                        }
                
                if best_reaction_for_variation:
                    representative_assoc_obj = variation_representative_obj.get(variation_key)
                    if not representative_assoc_obj: 
                        logger.error(f"Не найден репрезентативный объект для variation_key: {variation_key}")
                        continue 
                    
                    serialized_representative = AssociationSerializer(representative_assoc_obj).data
                    serialized_representative['cipher_name'] = variation_key[0] 

                    final_results_payload.append({
                        'details': serialized_representative, 
                        'best_reaction_text': best_reaction_for_variation['reaction_text'],
                        'best_reaction_relevance_percentage': round(best_reaction_for_variation['query_relevance_percentage'], 2),
                        'best_reaction_frequency': best_reaction_for_variation['frequency_in_group'],
                        'overall_score_for_variation': round(max_weighted_score, 2), 
                        'total_associations_in_variation': total_associations_in_variation_group,
                        'num_query_terms': num_query_terms,
                        'aggregated_by_font_only': not match_exact_variation,
                    })

            final_results_payload.sort(key=lambda x: (
                x['best_reaction_relevance_percentage'], 
                x['best_reaction_frequency'],
                x['overall_score_for_variation'] 
            ), reverse=True)
            
            if final_results_payload:
                max_best_reaction_frequency = 0
                if final_results_payload: 
                    valid_freqs = [item.get('best_reaction_frequency', 0) for item in final_results_payload if item.get('best_reaction_frequency') is not None]
                    if valid_freqs:
                        max_best_reaction_frequency = max(valid_freqs)

                if max_best_reaction_frequency > 0:
                    for item in final_results_payload:
                        current_best_reaction_freq = item.get('best_reaction_frequency', 0)
                        item['relative_frequency_percentage'] = round((current_best_reaction_freq / max_best_reaction_frequency) * 100, 1)
                else:
                    for item in final_results_payload:
                        item['relative_frequency_percentage'] = 0
            
            return Response(final_results_payload[:20], status=status.HTTP_200_OK)

class NLPAnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_processing_variants(self, text_to_analyze, nlp_director, nlp_builder):
        analysis_variants = []
        sbert_model_name_val = SBERT_MODEL_NAME
        sbert_available = get_sentence_transformer() is not None
        rwn_available = nlp_builder._get_rwn_local_instance() is not None

        params_v1 = {"preprocess": True, "tokenize_step": True, "remove_stops": False, "lemmatize_step": False, "group_syns": False, "gen_text_emb": False, "grouping_strategy": "processed"}
        result_v1: NLPAnalysisResult = nlp_director.construct_custom_analysis(text=text_to_analyze, **params_v1)
        analysis_variants.append({
            "name": "Только токенизация (без стоп-слов, без лемм)",
            "params_desc": "Предобработка, токенизация.",
            "result": {
                "original_text": result_v1.original_text,
                "processed_text": result_v1.processed_text,
                "tokens": result_v1.tokens,
                "lemmas": result_v1.lemmas,
                "synonym_groups": result_v1.synonym_groups,
                "grouping_key": result_v1.grouping_key,
                "text_embedding_vector": result_v1.text_embedding.tolist() if result_v1.text_embedding is not None else None
            }
        })

        params_v2 = {"preprocess": True, "tokenize_step": True, "remove_stops": True, "lemmatize_step": False, "group_syns": False, "gen_text_emb": False, "grouping_strategy": "processed"}
        result_v2: NLPAnalysisResult = nlp_director.construct_custom_analysis(text=text_to_analyze, **params_v2)
        analysis_variants.append({
            "name": "Токенизация + Удаление стоп-слов",
            "params_desc": "Предобработка, токенизация, удаление стоп-слов.",
            "result": {
                "original_text": result_v2.original_text,
                "processed_text": result_v2.processed_text,
                "tokens": result_v2.tokens,
                "lemmas": result_v2.lemmas,
                "synonym_groups": result_v2.synonym_groups,
                "grouping_key": result_v2.grouping_key,
                "text_embedding_vector": result_v2.text_embedding.tolist() if result_v2.text_embedding is not None else None
            }
        })

        params_v3 = {"preprocess": True, "tokenize_step": True, "remove_stops": True, "lemmatize_step": True, "group_syns": False, "gen_text_emb": False, "grouping_strategy": "lemmas"}
        result_v3: NLPAnalysisResult = nlp_director.construct_custom_analysis(text=text_to_analyze, **params_v3)
        analysis_variants.append({
            "name": "Лемматизация + Удаление стоп-слов",
            "params_desc": "Предобработка, токенизация, удаление стоп-слов, лемматизация. Ключ группировки: леммы.",
            "result": {
                "original_text": result_v3.original_text,
                "processed_text": result_v3.processed_text,
                "tokens": result_v3.tokens,
                "lemmas": result_v3.lemmas,
                "synonym_groups": result_v3.synonym_groups,
                "grouping_key": result_v3.grouping_key,
                "text_embedding_vector": result_v3.text_embedding.tolist() if result_v3.text_embedding is not None else None
            }
        })

        if rwn_available:
            params_v4 = {"preprocess": True, "tokenize_step": True, "remove_stops": True, "lemmatize_step": True, "group_syns": True, "gen_text_emb": False, "grouping_strategy": "synonyms"}
            result_v4: NLPAnalysisResult = nlp_director.construct_custom_analysis(text=text_to_analyze, **params_v4)
            analysis_variants.append({
                "name": "Лемматизация + Стоп-слова + Группировка синонимов (RuWordNet)",
                "params_desc": "Все шаги + группировка синонимов. Ключ группировки: канонические формы синонимов.",
                "result": {
                    "original_text": result_v4.original_text,
                    "processed_text": result_v4.processed_text,
                    "tokens": result_v4.tokens,
                    "lemmas": result_v4.lemmas,
                    "synonym_groups": result_v4.synonym_groups,
                    "grouping_key": result_v4.grouping_key,
                    "text_embedding_vector": result_v4.text_embedding.tolist() if result_v4.text_embedding is not None else None
                }
            })
        else:
            analysis_variants.append({
                "name": "Группировка синонимов (RuWordNet)",
                "params_desc": "RuWordNet недоступен или не инициализирован.",
                "result": {"error": "RuWordNet not available"}
            })


        if sbert_available:
            params_v5 = {"preprocess": True, "tokenize_step": True, "remove_stops": True, "lemmatize_step": True, "group_syns": False, "gen_text_emb": True, "grouping_strategy": "lemmas"}
            result_v5: NLPAnalysisResult = nlp_director.construct_custom_analysis(text=text_to_analyze, **params_v5)
            embedding_details_str = "Not generated"
            embedding_vector_list = None
            if result_v5.text_embedding is not None:
                embedding_details_str = f"Generated (vector shape: {result_v5.text_embedding.shape}, model: {sbert_model_name_val})"
                embedding_vector_list = result_v5.text_embedding.tolist()

            analysis_variants.append({
                "name": f"Текстовый Эмбеддинг ({sbert_model_name_val})",
                "params_desc": "Предобработка, лемматизация, удаление стоп-слов, генерация эмбеддинга всего текста.",
                "result": {
                    "original_text": result_v5.original_text,
                    "processed_text": result_v5.processed_text,
                    "tokens": result_v5.tokens,
                    "lemmas": result_v5.lemmas,
                    "synonym_groups": result_v5.synonym_groups,
                    "grouping_key": result_v5.grouping_key,
                    "text_embedding_details": embedding_details_str,
                    "text_embedding_vector": embedding_vector_list
                }
            })
        else:
            analysis_variants.append({
                "name": f"Текстовый Эмбеддинг ({sbert_model_name_val})",
                "params_desc": f"Модель {sbert_model_name_val} недоступна или не инициализирована.",
                "result": {"error": f"SentenceTransformer model ({sbert_model_name_val}) not available"}
            })
        return analysis_variants

    def post(self, request):
        text_to_analyze = request.data.get("text")
        if not text_to_analyze or not isinstance(text_to_analyze, str) or not text_to_analyze.strip():
            return Response({"error": "Please provide a non-empty 'text' field."}, status=status.HTTP_400_BAD_REQUEST)

        nlp_builder = AdvancedTextProcessorBuilder()
        nlp_director = NLPProcessingDirector(builder=nlp_builder)
        
        processing_variants = self._get_processing_variants(text_to_analyze, nlp_director, nlp_builder)

        return Response({
            "input_text": text_to_analyze,
            "processing_variants": processing_variants
        }, status=status.HTTP_200_OK)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 20

class AllAssociationsNLPAnalysisView(APIView):
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination

    def get(self, request):
        associations_qs = Association.objects.select_related('cipher', 'user').filter(
            reaction_description__isnull=False
        ).exclude(reaction_description__exact='').order_by('-created_at')
        
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(associations_qs, request, view=self)

        if page is None:
            return paginator.get_paginated_response([])

        nlp_builder = AdvancedTextProcessorBuilder()
        nlp_director = NLPProcessingDirector(builder=nlp_builder)
        temp_nlp_analysis_view = NLPAnalysisView()

        results_on_page = []
        for assoc in page:
            if not assoc.reaction_description or not assoc.reaction_description.strip():
                continue

            text_to_analyze = assoc.reaction_description
            processing_variants_for_assoc = temp_nlp_analysis_view._get_processing_variants(
                text_to_analyze, nlp_director, nlp_builder
            )
            
            results_on_page.append({
                "association_id": assoc.id,
                "user_username": assoc.user.username if assoc.user else "N/A",
                "cipher_name": assoc.cipher.result if assoc.cipher else "N/A",
                "original_reaction_text": text_to_analyze,
                "font_details": assoc.variation_details,
                "processing_variants": processing_variants_for_assoc
            })
            
        return paginator.get_paginated_response(results_on_page)
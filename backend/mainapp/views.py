from django.http import JsonResponse
from django.views import View
from django.contrib.auth import get_user_model, authenticate
from django.db.models import Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework import status
from .models import Study, Cipher, Association, Administrator, UserProfile # Добавлен UserProfile для возможного использования
from .gateway import UserGateway, StudyGateway, ReactionGateway, CipherGateway, AssociationGateway # Предполагается, что gateway.py существует
from .serializers import RegisterSerializer, LoginSerializer, CipherSerializer, AssociationSerializer, CustomTokenObtainPairSerializer # Добавлен CustomTokenObtainPairSerializer
from .utils import get_lemmas # Предполагается, что utils.py существует
import random
import itertools

User = get_user_model()

FONT_WEIGHTS = [fw[0] for fw in Association.FontWeight.choices]
FONT_STYLES = [fs[0] for fs in Association.FontStyle.choices]
LETTER_SPACINGS = [0, 10]
FONT_SIZES = [12, 16, 20]
LINE_HEIGHTS = [1.2, 1.5, 1.8]

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
                access_token = str(refresh.access_token)
                
                user_data = {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                }
                if hasattr(user, 'profile') and user.profile:
                    user_data['profile'] = {
                        'gender': user.profile.gender,
                        'age': user.profile.age,
                        'education_level': user.profile.education_level,
                        'specialty': user.profile.specialty,
                    }

                return Response({
                    "message": "Регистрация успешна!",
                    "user": user_data,
                    "access": access_token,
                    "refresh": str(refresh) 
                }, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        elif action == 'login':
            login_serializer = LoginSerializer(data=request.data)
            if login_serializer.is_valid():
                username = login_serializer.validated_data['username']
                password = login_serializer.validated_data['password']
                
                user = authenticate(username=username, password=password)
                if user:
                    refresh = CustomTokenObtainPairSerializer.get_token(user)
                    is_admin = Administrator.objects.filter(user=user).exists()
                    
                    user_data = {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                    }
                    if hasattr(user, 'profile') and user.profile:
                         user_data['profile'] = {
                            'gender': user.profile.gender,
                            'age': user.profile.age,
                            'education_level': user.profile.education_level,
                            'specialty': user.profile.specialty,
                        }

                    return Response({
                        "refresh": str(refresh),
                        "access": str(refresh.access_token),
                        "user": user_data,
                        "is_admin": is_admin
                    }, status=status.HTTP_200_OK)
                return Response({"error": "Неверные учетные данные"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(login_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        else: return Response({"error": "Недопустимое действие"}, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, user_id=None):
        if user_id: return Response({"error": "Метод GET для одного пользователя не реализован"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
        else:
            if not request.user.is_staff and not hasattr(request.user, 'administrator'): return Response({"error": "Недостаточно прав для просмотра пользователей"}, status=status.HTTP_403_FORBIDDEN)
            try:
                users = User.objects.all()
                users_data = []
                for u in users:
                    data = {
                        "id": u.id, "username": u.username, "email": u.email,
                        "first_name": u.first_name, "last_name": u.last_name
                    }
                    if hasattr(u, 'profile') and u.profile:
                        data['profile'] = {
                            'gender': u.profile.gender, 'age': u.profile.age,
                            'education_level': u.profile.education_level, 'specialty': u.profile.specialty
                        }
                    users_data.append(data)
                return Response(users_data, status=status.HTTP_200_OK)
            except Exception as e: return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, user_id=None):
        if user_id is None: return Response({"error": "Не указан ID пользователя для удаления"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            user_to_delete = User.objects.get(id=user_id)
            if user_to_delete == request.user: return Response({"error": "Нельзя удалить самого себя"}, status=status.HTTP_400_BAD_REQUEST)
            user_to_delete.delete()
            return Response({"message": "Пользователь удален"}, status=status.HTTP_200_OK)
        except User.DoesNotExist:
             return Response({"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e: return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class RandomCipherView(APIView):
    permission_classes = [IsAuthenticated]
    POPULAR_CIPHERS = [
        "Times New Roman", "Arial", "Helvetica", "Garamond", "Comic Sans",
        "Courier New", "Georgia", "Verdana", "Baskerville", "Sans Forgetica"
    ]

    def _create_popular_ciphers(self):
        created_count = 0
        for font_name in self.POPULAR_CIPHERS:
            _, created = Cipher.objects.get_or_create(result=font_name)
            if created:
                created_count += 1
        return list(Cipher.objects.all())

    def post(self, request):
        user = request.user
        vary_weight = request.data.get('vary_weight', True)
        vary_style = request.data.get('vary_style', True)
        vary_spacing = request.data.get('vary_spacing', True)
        vary_size = request.data.get('vary_size', True)
        vary_leading = request.data.get('vary_leading', True)

        seen_combinations = set(Association.objects.filter(user=user).values_list(
                'cipher_id', 'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height'))

        all_ciphers = list(Cipher.objects.all())

        if not all_ciphers:
            all_ciphers = self._create_popular_ciphers()
            if not all_ciphers:
                return Response(
                    {"error": "Не удалось создать или найти шрифты в базе данных."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        random.shuffle(all_ciphers)

        for base_cipher in all_ciphers:
            weights_to_try = FONT_WEIGHTS if vary_weight else [Association.FontWeight.REGULAR]
            styles_to_try = FONT_STYLES if vary_style else [Association.FontStyle.NORMAL]
            spacings_to_try = LETTER_SPACINGS if vary_spacing else [0]
            sizes_to_try = FONT_SIZES if vary_size else [16]
            leadings_to_try = LINE_HEIGHTS if vary_leading else [1.5]

            possible_combinations = list(itertools.product(
                [base_cipher.id], weights_to_try, styles_to_try, spacings_to_try, sizes_to_try, leadings_to_try
            ))
            random.shuffle(possible_combinations)

            for combo in possible_combinations:
                if combo not in seen_combinations:
                    return Response({
                        "cipher_id": combo[0],
                        "result": base_cipher.result,
                        "font_weight": combo[1],
                        "font_style": combo[2],
                        "letter_spacing": combo[3],
                        "font_size": combo[4],
                        "line_height": float(combo[5])
                    }, status=status.HTTP_200_OK)

        return Response({
            "message": "Вы прошли все доступные вариации шрифтов для выбранных настроек!",
            "all_seen": True
        }, status=status.HTTP_200_OK)

class StudyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data; user = request.user
        if not isinstance(data, list): return Response({"error": "Ожидается список объектов исследования."}, status=status.HTTP_400_BAD_REQUEST)
        results = []; errors = []
        for item in data:
            result = self._save_single_study(item, user)
            if "error" in result: errors.append(result)
            elif not result.get("skipped"): results.append(result)
        status_code = status.HTTP_207_MULTI_STATUS if errors and results else (status.HTTP_400_BAD_REQUEST if errors else status.HTTP_201_CREATED)
        message = "Сохранение завершено." if not errors or results else "Сохранение завершено с ошибками."
        return Response({"message": message, "saved": results, "errors": errors}, status=status_code)

    def _save_single_study(self, study_data, user):
        cipher_id = study_data.get("cipher_id"); reaction_description = study_data.get("reaction_description")
        font_weight = study_data.get("font_weight", Association.FontWeight.REGULAR); font_style = study_data.get("font_style", Association.FontStyle.NORMAL)
        letter_spacing = study_data.get("letter_spacing", 0); font_size = study_data.get("font_size", 16); line_height = study_data.get("line_height", 1.5)
        if not reaction_description or reaction_description == "[skipped]": return {"skipped": True, "cipher_id": cipher_id}
        if not cipher_id: return {"error": "Поле 'cipher_id' (базовый шрифт) обязательно", "data": study_data}
        if font_weight not in FONT_WEIGHTS or font_style not in FONT_STYLES: return {"error": "Недопустимые значения weight или style", "data": study_data}
        try:
            cipher = Cipher.objects.get(id=cipher_id)
            lemmas = get_lemmas(reaction_description)
            association, created = Association.objects.get_or_create(
                user=user, cipher=cipher, font_weight=font_weight, font_style=font_style, letter_spacing=letter_spacing, font_size=font_size, line_height=line_height,
                defaults={'reaction_description': reaction_description, 'reaction_lemmas': lemmas})
            if not created and association.reaction_description is None:
                 association.reaction_description = reaction_description
                 association.reaction_lemmas = lemmas
                 association.save()
            elif not created: return {"error": "Повторная реакция на ту же вариацию", "skipped": True, "data": study_data}
            return {"association_id": association.id}
        except Cipher.DoesNotExist: return {"error": f"Базовый шрифт с ID {cipher_id} не найден", "data": study_data}
        except Exception as e:
            print(f"Error saving study data {study_data} for user {user.id}: {e}")
            return {"error": "Внутренняя ошибка сервера при сохранении", "details": str(e), "data": study_data}

class GraphView(View):
     def get(self, request):
         aggregate_by_lemma = request.GET.get('aggregate_by_lemma', 'false').lower() == 'true'
         base_query = Association.objects.select_related('cipher').filter(reaction_description__isnull=False).exclude(reaction_description__exact='')
         if aggregate_by_lemma:
             base_query = base_query.exclude(reaction_lemmas__isnull=True).exclude(reaction_lemmas__exact='')
             associations_data = base_query.values('cipher__result', 'reaction_lemmas')
             description_field = 'reaction_lemmas'
         else:
             associations_data = base_query.values('cipher__result', 'reaction_description')
             description_field = 'reaction_description'
         frequency = {}
         for assoc_data in associations_data:
             font_name = assoc_data.get('cipher__result')
             desc = assoc_data.get(description_field)
             if not font_name or not desc: continue
             key = (font_name, desc)
             frequency[key] = frequency.get(key, 0) + 1
         data = [{'name': name, 'description': desc, 'count': count} for (name, desc), count in frequency.items()]
         return JsonResponse(data, safe=False)

class AssociationSearchView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        search_term = request.data.get('reaction_description', '').strip()
        match_exact_variation = request.data.get('match_exact_variation', True)
        search_by_lemma = request.data.get('search_by_lemma', True)
        if not search_term: return Response({"error": "Необходимо указать текст реакции для поиска."}, status=status.HTTP_400_BAD_REQUEST)
        if search_by_lemma:
            search_lemmas = get_lemmas(search_term)
            if not search_lemmas: filter_kwargs = {'reaction_description__iexact': search_term}
            else: filter_kwargs = {'reaction_lemmas__icontains': search_lemmas}
        else: filter_kwargs = {'reaction_description__iexact': search_term}
        matching_associations = Association.objects.filter(**filter_kwargs).select_related('cipher')
        if not matching_associations.exists(): return Response({"error": "Ассоциации не найдены."}, status=status.HTTP_404_NOT_FOUND)
        if match_exact_variation:
            grouping_fields = ['cipher_id', 'cipher__result', 'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height']
            value_fields = ['cipher_id', 'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height']
        else:
            grouping_fields = ['cipher_id', 'cipher__result']
            value_fields = ['cipher_id']
        variation_counts = matching_associations.values(*grouping_fields).annotate(score=Count('id')).order_by('-score')
        if not variation_counts: return Response({"error": "Не удалось агрегировать результаты."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        top_results_data = []; max_score = variation_counts[0]['score'] if variation_counts else 0
        for variation_group in variation_counts[:5]:
            filter_kwargs_repr = {}
            for field in value_fields:
                filter_kwargs_repr[field] = variation_group[field]
            representative_assoc = matching_associations.filter(**filter_kwargs_repr).order_by('-created_at').first()
            if representative_assoc:
                serializer = AssociationSerializer(representative_assoc)
                percentage = (variation_group['score'] / max_score * 100) if max_score > 0 else 0
                top_results_data.append({"score": variation_group['score'], "percentage": round(percentage, 1), "details": serializer.data, "aggregated_by_font_only": not match_exact_variation})
        return Response(top_results_data, status=status.HTTP_200_OK)
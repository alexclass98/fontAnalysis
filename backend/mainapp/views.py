from django.http import JsonResponse
from django.views import View
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework import status
from .models import Study, Cipher, Association, Administrator
from .gateway import UserGateway
from .serializers import RegisterSerializer, LoginSerializer, CipherSerializer, AssociationSerializer
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
                ug = UserGateway.create(
                    username=serializer.validated_data['username'], password=serializer.validated_data['password'],
                    email=serializer.validated_data['email'], first_name=serializer.validated_data.get('first_name'),
                    last_name=serializer.validated_data.get('last_name'))
                return Response({"message": "Регистрация успешна!", "user": ug.to_dict()}, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        elif action == 'login':
            serializer = LoginSerializer(data=request.data)
            if serializer.is_valid():
                username = serializer.validated_data['username']; password = serializer.validated_data['password']
                ug = UserGateway.authenticate(username=username, password=password)
                if ug:
                    rt, at = ug.get_tokens(); ud = ug.to_dict(); is_admin = Administrator.objects.filter(user=ug.user).exists()
                    return Response({"refresh": rt, "access": at, "user": ud, "is_admin": is_admin}, status=status.HTTP_200_OK)
                return Response({"error": "Неверные учетные данные"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        else: return Response({"error": "Недопустимое действие"}, status=status.HTTP_400_BAD_REQUEST)
    def get(self, request, user_id=None):
        if user_id: return Response({"error": "Метод GET для одного пользователя не реализован"}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
        else:
            if not request.user.is_staff and not hasattr(request.user, 'administrator'): return Response({"error": "Недостаточно прав для просмотра пользователей"}, status=status.HTTP_403_FORBIDDEN)
            try:
                user_gateways = UserGateway.get_all_users(); users_data = [ug.to_dict() for ug in user_gateways]
                return Response(users_data, status=status.HTTP_200_OK)
            except Exception as e: return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    def delete(self, request, user_id=None):
        if user_id is None: return Response({"error": "Не указан ID пользователя для удаления"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            ug = UserGateway.get_by_id(user_id)
            if not ug: return Response({"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)
            if ug.user == request.user: return Response({"error": "Нельзя удалить самого себя"}, status=status.HTTP_400_BAD_REQUEST)
            if ug.delete(): return Response({"message": "Пользователь удален"}, status=status.HTTP_200_OK)
            return Response({"error": "Не удалось удалить пользователя"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e: return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class RandomCipherView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        user = request.user
        vary_weight = request.data.get('vary_weight', True); vary_style = request.data.get('vary_style', True)
        vary_spacing = request.data.get('vary_spacing', True); vary_size = request.data.get('vary_size', True)
        vary_leading = request.data.get('vary_leading', True)
        seen_combinations = set(Association.objects.filter(user=user).values_list(
                'cipher_id', 'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height'))
        all_ciphers = list(Cipher.objects.all())
        if not all_ciphers: return Response({"error": "В базе данных нет шрифтов."}, status=status.HTTP_404_NOT_FOUND)
        random.shuffle(all_ciphers)
        for base_cipher in all_ciphers:
            weights_to_try = FONT_WEIGHTS if vary_weight else [Association.FontWeight.REGULAR]
            styles_to_try = FONT_STYLES if vary_style else [Association.FontStyle.NORMAL]
            spacings_to_try = LETTER_SPACINGS if vary_spacing else [0]
            sizes_to_try = FONT_SIZES if vary_size else [16]
            leadings_to_try = LINE_HEIGHTS if vary_leading else [1.5]
            possible_combinations = list(itertools.product(
                [base_cipher.id], weights_to_try, styles_to_try, spacings_to_try, sizes_to_try, leadings_to_try))
            random.shuffle(possible_combinations)
            for combo in possible_combinations:
                if combo not in seen_combinations:
                    return Response({
                        "cipher_id": combo[0], "result": base_cipher.result, "font_weight": combo[1],
                        "font_style": combo[2], "letter_spacing": combo[3], "font_size": combo[4],
                        "line_height": float(combo[5])}, status=status.HTTP_200_OK)
        return Response({"message": "Вы прошли все доступные вариации шрифтов для выбранных настроек!", "all_seen": True}, status=status.HTTP_200_OK)

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
        # Возвращаем сообщение об успехе, если нет критических ошибок
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
            association, created = Association.objects.get_or_create(
                user=user, cipher=cipher, font_weight=font_weight, font_style=font_style, letter_spacing=letter_spacing, font_size=font_size, line_height=line_height,
                defaults={'reaction_description': reaction_description})
            if not created and association.reaction_description is None: association.reaction_description = reaction_description; association.save()
            elif not created: return {"error": "Повторная реакция на ту же вариацию", "skipped": True, "data": study_data}
            return {"association_id": association.id}
        except Cipher.DoesNotExist: return {"error": f"Базовый шрифт с ID {cipher_id} не найден", "data": study_data}
        except Exception as e: print(f"Error saving study data {study_data} for user {user.id}: {e}"); return {"error": "Внутренняя ошибка сервера при сохранении", "details": str(e), "data": study_data}

class GraphView(View):
     def get(self, request):
        associations = Association.objects.select_related('cipher').filter(reaction_description__isnull=False).exclude(reaction_description__exact='').exclude(reaction_description__exact='[skipped]')
        frequency = {};
        for assoc in associations:
            if not assoc.cipher: continue
            key = (assoc.cipher.result, assoc.reaction_description)
            frequency[key] = frequency.get(key, 0) + 1
        data = [{'name': name, 'description': desc, 'count': count} for (name, desc), count in frequency.items() if name and desc]
        return JsonResponse(data, safe=False)

class FindFontByReactionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        reaction_description = request.data.get('reaction_description')
        if not reaction_description or not isinstance(reaction_description, str) or not reaction_description.strip():
            return Response({"error": "Поле 'reaction_description' обязательно."}, status=status.HTTP_400_BAD_REQUEST)
        association = Association.objects.filter(reaction_description__iexact=reaction_description.strip()).select_related('cipher').order_by('-created_at').first()
        if not association: return Response({"error": "Ассоциация для данной реакции не найдена."}, status=status.HTTP_404_NOT_FOUND)
        serializer = AssociationSerializer(association)
        response_data = {"message": "Ассоциация найдена!", "font_name": association.cipher.result, "variation_details": serializer.data}
        return Response(response_data, status=status.HTTP_200_OK)
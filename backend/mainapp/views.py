from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import Study, Cipher, Administrator
from .gateway import StudyGateway, CipherGateway, AssociationGateway, UserGateway, ReactionGateway
from .serializers import RegisterSerializer, LoginSerializer
import random

class UserView(APIView):
    """Класс для операций с пользователями: регистрация, вход, управление."""

    def post(self, request, action=None):
        if action == 'register':
            serializer = RegisterSerializer(data=request.data)
            if serializer.is_valid():
                user_gateway = UserGateway.create(
                    username=serializer.validated_data['username'],
                    password=serializer.validated_data['password'],
                    email=serializer.validated_data.get('email')
                )
                return Response({
                    "message": "Registration successful!",
                    "user": user_gateway.to_dict()
                }, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        elif action == 'login':
            serializer = LoginSerializer(data=request.data)
            if serializer.is_valid():
                username = serializer.validated_data['username']
                password = serializer.validated_data['password']

                user_gateway = UserGateway.authenticate(username=username, password=password)
                if user_gateway:
                    refresh_token, access_token = user_gateway.get_tokens()
                    user = user_gateway.to_dict()
                    is_admin = Administrator.objects.filter(user=user_gateway.user).exists()

                    return Response({
                        "refresh": refresh_token,
                        "access": access_token,
                        "user": user,
                        "is_admin": is_admin
                    }, status=status.HTTP_200_OK)
                return Response({"error": "Неверные учетные данные"}, status=status.HTTP_401_UNAUTHORIZED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        """Получение списка пользователей."""
        try:
            user_gateways = UserGateway.get_all_users()
            users_data = [user_gateway.to_dict() for user_gateway in user_gateways]
            return Response(users_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, user_id=None):
        """Удаление пользователя по ID."""
        try:
            user_gateway = UserGateway.get_by_id(user_id)
            if not user_gateway:
                return Response({"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)

            if user_gateway.delete():
                return Response({"message": "Пользователь удален"}, status=status.HTTP_200_OK)
            return Response({"error": "Не удалось удалить пользователя"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class CipherView(APIView):
    """Класс для работы с шрифтами."""

    def get(self, request):
        ciphers = Cipher.objects.all()
        if not ciphers.exists():
            return JsonResponse({"error": "Нет доступных шрифтов"}, status=404)

        cipher = random.choice(ciphers)
        return JsonResponse({
            "id": cipher.id,
            "font": cipher.result
        })

class StudyView(APIView):
    """Класс для работы с исследованиями."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        cipher_id = request.data.get("cipher_id")
        reaction_description = request.data.get("reaction_description")

        if not all([cipher_id, reaction_description]):
            return Response({"error": "Все поля обязательны"}, status=400)

        try:
            cipher_gateway = CipherGateway.get_by_id(cipher_id)
            if not cipher_gateway:
                return Response({"error": "Шрифт не найден"}, status=404)

            reaction, created = ReactionGateway.get_or_create(
                name=cipher_gateway.result,
                description=reaction_description
            )
            cipher = Cipher.objects.get(id=cipher_gateway.cipher_id)
            study_gateway = StudyGateway(user=request.user, cipher=cipher, reaction=reaction, result=f"User {request.user.username} reacted: {reaction_description}")
            study = study_gateway.create()

            return Response({"message": "Исследование успешно сохранено", "study_id": study.study_id})
        except Cipher.DoesNotExist:
            return Response({"error": "Шрифт не найден"}, status=404)

class AssociationView(APIView):
    """Класс для сохранения ассоциаций между реакцией и шрифтом."""

    def post(self, request):
        reaction_description = request.data.get('reaction_description')

        if not reaction_description:
            return Response({"error": "Поле 'reaction_description' обязательно!"}, status=status.HTTP_400_BAD_REQUEST)

        reaction_gateway = ReactionGateway.get_by_description(reaction_description)
        if not reaction_gateway:
            return Response({"error": "Реакция не найдена"}, status=status.HTTP_404_NOT_FOUND)

        study = Study.objects.filter(reaction__id=reaction_gateway.reaction_id).first()
        if not study:
            return Response({"error": "Исследование с такой реакцией не найдено!"}, status=status.HTTP_404_NOT_FOUND)

        cipher = study.cipher
        user = request.user

        association_gateway = AssociationGateway(user=user, cipher=cipher, reaction_description=reaction_description)
        association_gateway.create()

        return Response({
            "message": "Ассоциация сохранена!",
            "font_name": cipher.result
        }, status=status.HTTP_201_CREATED)


from django.http import JsonResponse
from django.views import View
from mainapp.models import Reaction
class GraphView(View):
    def get(self, request):
        reactions = Reaction.objects.all().values('name', 'description')

        # Агрегация данных
        frequency = {}
        for reaction in reactions:
            key = (reaction['name'], reaction['description'])
            frequency[key] = frequency.get(key, 0) + 1

        # Форматирование для ответа
        data = [
            {
                'name': name,
                'description': desc,
                'count': count
            } for (name, desc), count in frequency.items()
        ]

        return JsonResponse(data, safe=False)
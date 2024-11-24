from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Study, Reaction, Cipher, Administrator
from django.contrib.auth.models import User
from .gateway import StudyGateway, CipherGateway, AssociationGateway, UserGateway
import random
from .serializers import RegisterSerializer, LoginSerializer


@api_view(['POST'])
def save_association(request):
    """Сохраняет ассоциацию между реакцией и шрифтом"""
    reaction_description = request.data.get('reaction_description')

    if not reaction_description:
        return Response({"error": "Поле 'reaction_description' обязательно!"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        reaction = Reaction.objects.get(description__icontains=reaction_description)
        study = Study.objects.filter(reaction=reaction).first()

        if not study:
            return Response({"error": "Исследование с такой реакцией не найдено!"}, status=status.HTTP_404_NOT_FOUND)

        cipher = study.cipher
        user = request.user

        association_gateway = AssociationGateway(user=user, cipher=cipher, reaction_description=reaction_description)
        association = association_gateway.create()

        return Response({
            "message": "Ассоциация сохранена!",
            "font_name": cipher.result
        }, status=status.HTTP_201_CREATED)

    except Reaction.DoesNotExist:
        return Response({"error": "Реакция не найдена"}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
def random_cipher(request):
    """Возвращает случайный шрифт из таблицы Cipher."""
    ciphers = Cipher.objects.all()
    if not ciphers.exists():
        return JsonResponse({"error": "Нет доступных шрифтов"}, status=404)

    cipher = random.choice(ciphers)
    return JsonResponse({
        "id": cipher.id,
        "font": cipher.result  # Возвращаем шрифт
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_study(request):
    """Сохраняет данные исследования"""
    cipher_id = request.data.get("cipher_id")
    reaction_description = request.data.get("reaction_description")


    if not all([cipher_id, reaction_description]):
        return Response({"error": "Все поля обязательны"}, status=400)

    try:
        cipher_gateway = CipherGateway.get_by_id(cipher_id)
        if not cipher_gateway:
            return Response({"error": "Шрифт не найден"}, status=404)

        reaction, created = Reaction.objects.get_or_create(
            name=cipher_gateway.result,
            description=reaction_description
        )
        cipher = Cipher.objects.get(id=cipher_gateway.cipher_id)
        study_gateway = StudyGateway(user=request.user, cipher=cipher, reaction=reaction, result=f"User {request.user.username} reacted: {reaction_description}")
        study = study_gateway.create()

        return Response({"message": "Исследование успешно сохранено", "study_id": study.study_id})
    except Cipher.DoesNotExist:
        return Response({"error": "Шрифт не найден"}, status=404)


@api_view(['POST'])
def register(request):
    """Регистрация нового пользователя"""
    if request.method == 'POST':
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            # Создаем нового пользователя через гейтвей
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


@api_view(['POST'])
def login(request):
    """Аутентификация пользователя с возвратом токенов и статуса администратора."""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        # Проверка подлинности пользователя через UserGateway
        user_gateway = UserGateway.authenticate(username=username, password=password)
        if user_gateway is not None:
            # Генерация токенов
            refresh_token, access_token = user_gateway.get_tokens()

            # Получаем пользователя
            user = user_gateway.to_dict()

            is_admin = Administrator.objects.filter(user=user_gateway.user).exists()

            return Response({
                "refresh": refresh_token,
                "access": access_token,
                "user": user,
                "is_admin": is_admin  # Добавляем поле о статусе администратора
            }, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Неверные учетные данные"}, status=status.HTTP_401_UNAUTHORIZED)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



@api_view(['GET'])
def get_users(request):
    """Получение списка всех пользователей"""
    try:
        users = User.objects.all()
        users_data = [
            {"id": user.id, "username": user.username, "first_name": user.first_name, "last_name": user.last_name}
            for user in users
        ]
        return Response(users_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
def delete_user(request, user_id):
    """Удаление пользователя по ID"""
    try:
        user = User.objects.get(id=user_id)
        user.delete()  # Удаляем пользователя
        return Response({"message": "Пользователь удален"}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({"error": "Пользователь не найден"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

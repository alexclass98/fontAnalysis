from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Association
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Добавить роль администратора
        token['is_admin'] = hasattr(user, 'administrator')
        return token


# Сериализатор для регистрации пользователя
class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128)

    def validate(self, data):
        return data

class AssociationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Association
        fields = ['user', 'cipher', 'reaction_description']

# Сериализатор для логина пользователя (для аутентификации)
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=128)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Добавить роль администратора
        token['is_admin'] = hasattr(user, 'administrator')
        return token


from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Association, Cipher
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_admin'] = hasattr(user, 'administrator')
        token['username'] = user.username
        token['user_id'] = user.id
        return token

class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Пользователь с таким именем (логином) уже существует.")
        return value

    def validate_email(self, value):
         if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует.")
         return value

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)

class CipherSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cipher
        fields = ['id', 'result']
        read_only_fields = ['id']

class AssociationSerializer(serializers.ModelSerializer):
    cipher_name = serializers.CharField(source='cipher.result', read_only=True)
    variation_details = serializers.CharField(read_only=True)
    font_weight_display = serializers.CharField(source='get_font_weight_display', read_only=True)
    font_style_display = serializers.CharField(source='get_font_style_display', read_only=True)

    class Meta:
        model = Association
        fields = [
            'id', 'user', 'cipher', 'cipher_name', 'reaction_description',
            'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height',
            'created_at', 'variation_details', 'font_weight_display', 'font_style_display'
        ]
        read_only_fields = [
            'id', 'user', 'created_at', 'cipher_name', 'variation_details',
            'font_weight_display', 'font_style_display'
        ]
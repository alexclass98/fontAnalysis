from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Association, Cipher, UserProfile
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

    gender = serializers.ChoiceField(choices=UserProfile.Gender.choices, required=False, allow_blank=True, allow_null=True)
    age = serializers.IntegerField(required=False, allow_null=True, min_value=0)
    education_level = serializers.ChoiceField(choices=UserProfile.EducationLevel.choices, required=False, allow_blank=True, allow_null=True)
    specialty = serializers.CharField(max_length=255, required=False, allow_blank=True, allow_null=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Пользователь с таким именем (логином) уже существует.")
        return value

    def validate_email(self, value):
         if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Пользователь с таким email уже существует.")
         return value

    def create(self, validated_data):
        # print("--- Validated Data in RegisterSerializer ---") 
        # print(validated_data) 

        profile_data = {
            'gender': validated_data.pop('gender', None),
            'age': validated_data.pop('age', None),
            'education_level': validated_data.pop('education_level', None),
            'specialty': validated_data.pop('specialty', None), 
        }

        # print("--- Profile Data to be saved ---") 
        # print(profile_data) 

        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', '')
        )

        if hasattr(user, 'profile') and user.profile:
            profile_instance = user.profile
            
            if profile_data['gender'] is not None:
                profile_instance.gender = profile_data['gender']
            if profile_data['age'] is not None:
                profile_instance.age = profile_data['age']
            if profile_data['education_level'] is not None:
                profile_instance.education_level = profile_data['education_level']
            if profile_data['specialty'] is not None:
                profile_instance.specialty = profile_data['specialty']
            
            profile_instance.save()
            # print(f"--- UserProfile for {user.username} saved ---") 
            # print(f"Gender: {profile_instance.gender}, Age: {profile_instance.age}, Education: {profile_instance.education_level}, Specialty: {profile_instance.specialty}")
        else:
            # print(f"--- UserProfile for {user.username} NOT found, creating manually (SIGNAL ISSUE?) ---")
            cleaned_profile_data = {k: v for k, v in profile_data.items() if v is not None}
            if cleaned_profile_data:
                 UserProfile.objects.create(user=user, **cleaned_profile_data)
        return user

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
            'id', 'user', 'cipher', 'cipher_name', 'reaction_description', 'reaction_lemmas',
            'font_weight', 'font_style', 'letter_spacing', 'font_size', 'line_height',
            'created_at', 'variation_details', 'font_weight_display', 'font_style_display'
        ]
        read_only_fields = [
            'id', 'user', 'created_at', 'cipher_name', 'variation_details',
            'font_weight_display', 'font_style_display', 'reaction_lemmas'
        ]
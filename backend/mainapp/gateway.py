# gateway.py

from .models import Study, Cipher, Association
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken

class StudyGateway:
    def __init__(self, study_id=None, cipher=None, reaction=None, user=None, result=None):
        self.study_id = study_id
        self.cipher = cipher
        self.reaction = reaction
        self.user = user
        self.result = result

    @classmethod
    def get_by_id(cls, study_id):
        try:
            study = Study.objects.get(id=study_id)
            return cls(study_id=study.id, cipher=study.cipher, reaction=study.reaction, user=study.user, result=study.result)
        except Study.DoesNotExist:
            return None

    def create(self):
        study = Study.objects.create(
            cipher=self.cipher,
            reaction=self.reaction,
            user=self.user,
            result=self.result
        )
        return StudyGateway(study_id=study.id, cipher=study.cipher, reaction=study.reaction, user=study.user, result=study.result)

    def update(self):
        try:
            study = Study.objects.get(id=self.study_id)
            study.cipher = self.cipher
            study.reaction = self.reaction
            study.user = self.user
            study.result = self.result
            study.save()
            return StudyGateway(study_id=study.id, cipher=study.cipher, reaction=study.reaction, user=study.user, result=study.result)
        except Study.DoesNotExist:
            return None

    def delete(self):
        try:
            study = Study.objects.get(id=self.study_id)
            study.delete()
            return True
        except Study.DoesNotExist:
            return False


class CipherGateway:
    def __init__(self, cipher_id=None, result=None):
        self.cipher_id = cipher_id
        self.result = result

    @classmethod
    def get_by_id(cls, cipher_id):
        try:
            cipher = Cipher.objects.get(id=cipher_id)
            return cls(cipher_id=cipher.id, result=cipher.result)
        except Cipher.DoesNotExist:
            return None

    def create(self):
        cipher = Cipher.objects.create(result=self.result)
        return CipherGateway(cipher_id=cipher.id, result=cipher.result)

    def update(self):
        try:
            cipher = Cipher.objects.get(id=self.cipher_id)
            cipher.result = self.result
            cipher.save()
            return CipherGateway(cipher_id=cipher.id, result=cipher.result)
        except Cipher.DoesNotExist:
            return None

    def delete(self):
        try:
            cipher = Cipher.objects.get(id=self.cipher_id)
            cipher.delete()
            return True
        except Cipher.DoesNotExist:
            return False


class AssociationGateway:
    def __init__(self, association_id=None, user=None, cipher=None, reaction_description=None):
        self.association_id = association_id
        self.user = user
        self.cipher = cipher
        self.reaction_description = reaction_description

    @classmethod
    def get_by_id(cls, association_id):
        try:
            association = Association.objects.get(id=association_id)
            return cls(association_id=association.id, user=association.user, cipher=association.cipher, reaction_description=association.reaction_description)
        except Association.DoesNotExist:
            return None

    def create(self):
        association = Association.objects.create(
            user=self.user,
            cipher=self.cipher,
            reaction_description=self.reaction_description
        )
        return AssociationGateway(association_id=association.id, user=association.user, cipher=association.cipher, reaction_description=association.reaction_description)

    def update(self):
        try:
            association = Association.objects.get(id=self.association_id)
            association.reaction_description = self.reaction_description
            association.save()
            return AssociationGateway(association_id=association.id, user=association.user, cipher=association.cipher, reaction_description=association.reaction_description)
        except Association.DoesNotExist:
            return None

    def delete(self):
        try:
            association = Association.objects.get(id=self.association_id)
            association.delete()
            return True
        except Association.DoesNotExist:
            return False


class UserGateway:
    def __init__(self, username=None, password=None, email=None, user=None):
        self.username = username
        self.password = password
        self.email = email
        self.user = user

    @classmethod
    def create(cls, username, password, email):
        user = User.objects.create_user(username=username, password=password, email=email)
        return cls(user=user)

    @classmethod
    def authenticate(cls, username, password):
        user = authenticate(username=username, password=password)
        if user is not None:
            return cls(user=user)
        return None

    def get_tokens(self):
        if self.user:
            refresh = RefreshToken.for_user(self.user)
            access_token = refresh.access_token
            return str(refresh), str(access_token)
        return None, None

    def to_dict(self):
        """Метод для представления пользователя в виде словаря."""
        if self.user:
            return {
                "id": self.user.id,
                "username": self.user.username,
                "email": self.user.email
            }
        return None

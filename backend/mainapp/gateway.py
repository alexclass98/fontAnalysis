from .models import Study, Cipher, Association, Reaction 
from django.contrib.auth import get_user_model, authenticate

User = get_user_model()

class StudyGateway:
    def __init__(self, study_id=None, cipher=None, user=None, result=None):
        self.study_id = study_id
        self.cipher = cipher
        self.user = user
        self.result = result

    @classmethod
    def get_by_id(cls, study_id):
        try:
            study = Study.objects.get(id=study_id)
            return cls(study_id=study.id, cipher=study.cipher, user=study.user, result=study.result)
        except Study.DoesNotExist:
            return None

    def create(self):
        study = Study.objects.create(
            cipher=self.cipher,
            user=self.user,
            result=self.result
        )
        return StudyGateway(study_id=study.id, cipher=study.cipher, user=study.user, result=study.result)

    def update(self):
        try:
            study = Study.objects.get(id=self.study_id)
            study.cipher = self.cipher
            study.user = self.user
            study.result = self.result
            study.save()
            return StudyGateway(study_id=study.id, cipher=study.cipher, user=study.user, result=study.result)
        except Study.DoesNotExist:
            return None

    def delete(self):
        try:
            study = Study.objects.get(id=self.study_id)
            study.delete()
            return True
        except Study.DoesNotExist:
            return False

class ReactionGateway:
    def __init__(self, reaction_id=None, name=None, description=None):
        self.reaction_id = reaction_id
        self.name = name
        self.description = description

    @classmethod
    def get_by_description(cls, description):
        try:
            reaction = Reaction.objects.filter(description__iexact=description).first()
            if reaction:
                 return cls(reaction_id=reaction.id, name=reaction.name, description=reaction.description)
            return None
        except Reaction.DoesNotExist: # Эта ветка, вероятно, никогда не будет достигнута из-за .first()
            return None

    @classmethod
    def get_or_create(cls, name, description):
        reaction, created = Reaction.objects.get_or_create(
            description=description,
            defaults={'name': name}
        )
        return reaction, created

    def create(self):
        reaction = Reaction.objects.create(name=self.name, description=self.description)
        return ReactionGateway(reaction_id=reaction.id, name=reaction.name, description=reaction.description)

    def update(self):
        try:
            reaction = Reaction.objects.get(id=self.reaction_id)
            reaction.name = self.name
            reaction.description = self.description
            reaction.save()
            return ReactionGateway(reaction_id=reaction.id, name=reaction.name, description=reaction.description)
        except Reaction.DoesNotExist:
            return None

    def delete(self):
        try:
            reaction = Reaction.objects.get(id=self.reaction_id)
            reaction.delete()
            return True
        except Reaction.DoesNotExist:
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
    def __init__(self, user=None):
        self.user = user

    @classmethod
    def create(cls, username, password, email, first_name=None, last_name=None):
        user = User.objects.create_user(
             username=username,
             password=password,
             email=email,
             first_name=first_name or '',
             last_name=last_name or ''
        )
        return cls(user=user)

    @classmethod
    def authenticate(cls, username, password):
        user = authenticate(username=username, password=password)
        if user is not None:
            return cls(user=user)
        return None

    @staticmethod
    def get_all_users():
        users = User.objects.all()
        return [UserGateway(user=u) for u in users]

    @classmethod
    def get_by_id(cls, user_id):
        try:
            user = User.objects.get(id=user_id)
            return cls(user=user)
        except User.DoesNotExist:
            return None

    def delete(self):
        if self.user:
            self.user.delete()
            return True
        return False

    def get_tokens(self):
        if self.user:
            # ИМПОРТ ПЕРЕМЕЩЕН ВНУТРЬ МЕТОДА
            from .serializers import CustomTokenObtainPairSerializer 
            refresh = CustomTokenObtainPairSerializer.get_token(self.user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            return refresh_token, access_token
        return None, None

    def to_dict(self):
        if self.user:
            return {
                "id": self.user.id,
                "username": self.user.username,
                "first_name": self.user.first_name,
                "last_name": self.user.last_name,
                "email": self.user.email,
            }
        return None
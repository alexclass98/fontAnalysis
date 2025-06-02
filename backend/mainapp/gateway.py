from .models import Study, Cipher, Association, Reaction, Administrator
from django.contrib.auth import get_user_model, authenticate
from django.core.exceptions import ObjectDoesNotExist
import logging

logger = logging.getLogger(__name__)
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
        except Reaction.DoesNotExist:
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

class AssociationGateway_Original: # Переименован, чтобы не конфликтовать
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
        return AssociationGateway_Original(association_id=association.id, user=association.user, cipher=association.cipher, reaction_description=association.reaction_description)

    def update(self):
        try:
            association = Association.objects.get(id=self.association_id)
            association.reaction_description = self.reaction_description
            association.save()
            return AssociationGateway_Original(association_id=association.id, user=association.user, cipher=association.cipher, reaction_description=association.reaction_description)
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

class AssociationGateway_RowData:
    def __init__(self, association_id=None, user_id=None, cipher_id=None,
                 reaction_description=None, reaction_lemmas=None,
                 font_weight=None, font_style=None, letter_spacing=None,
                 font_size=None, line_height=None, created_at=None):

        self.association_id = association_id
        self.user_id = user_id
        self.cipher_id = cipher_id
        self._cipher_result_cache = None
        
        self.reaction_description = reaction_description
        self.reaction_lemmas = reaction_lemmas
        self.font_weight = font_weight
        self.font_style = font_style
        self.letter_spacing = letter_spacing
        self.font_size = font_size
        self.line_height = line_height
        self.created_at = created_at

    def _load_from_model(self, model_instance):
        self.association_id = model_instance.id
        self.user_id = model_instance.user_id
        self.cipher_id = model_instance.cipher_id
        if model_instance.cipher:
            self._cipher_result_cache = model_instance.cipher.result
        self.reaction_description = model_instance.reaction_description
        self.reaction_lemmas = model_instance.reaction_lemmas
        self.font_weight = model_instance.font_weight
        self.font_style = model_instance.font_style
        self.letter_spacing = model_instance.letter_spacing
        self.font_size = model_instance.font_size
        self.line_height = model_instance.line_height
        self.created_at = model_instance.created_at

    def get_cipher_result(self):
        if self._cipher_result_cache is None and self.cipher_id:
            try:
                cipher_model = Cipher.objects.get(id=self.cipher_id)
                self._cipher_result_cache = cipher_model.result
            except Cipher.DoesNotExist:
                logger.warning(f"Cipher with id {self.cipher_id} not found for AssociationGateway_RowData id {self.association_id}")
                return None
        return self._cipher_result_cache
    
    def get_reaction_description(self):
        return self.reaction_description

    def insert(self):
        if self.association_id is not None:
            raise ValueError("Cannot insert an object that already has an ID.")
        
        user_instance = User.objects.get(id=self.user_id) if self.user_id else None
        cipher_instance = Cipher.objects.get(id=self.cipher_id) if self.cipher_id else None

        if not user_instance or not cipher_instance:
            raise ValueError("User or Cipher ID is missing or invalid for creating association.")

        model_instance = Association.objects.create(
            user=user_instance,
            cipher=cipher_instance,
            reaction_description=self.reaction_description,
            reaction_lemmas=self.reaction_lemmas,
            font_weight=self.font_weight,
            font_style=self.font_style,
            letter_spacing=self.letter_spacing,
            font_size=self.font_size,
            line_height=self.line_height
        )
        self._load_from_model(model_instance)
        return True

    def update(self):
        if self.association_id is None:
            raise ValueError("Cannot update an object without an ID.")
        try:
            model_instance = Association.objects.get(id=self.association_id)
            model_instance.reaction_description = self.reaction_description
            model_instance.reaction_lemmas = self.reaction_lemmas
            model_instance.save()
            self._load_from_model(model_instance)
            return True
        except Association.DoesNotExist:
            logger.error(f"AssociationGateway_RowData: Association with ID {self.association_id} not found for update.")
            return False

    def delete(self):
        if self.association_id is None:
            raise ValueError("Cannot delete an object without an ID.")
        try:
            rows_affected, _ = Association.objects.filter(id=self.association_id).delete()
            if rows_affected > 0:
                self.association_id = None
                return True
            return False
        except Exception as e:
            logger.error(f"AssociationGateway_RowData: Error deleting association with ID {self.association_id}: {e}")
            return False

class AssociationFinder_ForRowData:
    @staticmethod
    def find_all_valid_for_graph():
        associations_qs = Association.objects.select_related('cipher').filter(
            reaction_description__isnull=False
        ).exclude(reaction_description__exact='')
        
        gateway_objects = []
        for assoc_model in associations_qs:
            if assoc_model.cipher and assoc_model.cipher.result and assoc_model.reaction_description:
                gateway_obj = AssociationGateway_RowData()
                gateway_obj._load_from_model(assoc_model)
                gateway_objects.append(gateway_obj)
        return gateway_objects

    @staticmethod
    def find_by_id(association_id):
        try:
            assoc_model = Association.objects.select_related('cipher').get(id=association_id)
            gateway_obj = AssociationGateway_RowData()
            gateway_obj._load_from_model(assoc_model)
            return gateway_obj
        except Association.DoesNotExist:
            return None
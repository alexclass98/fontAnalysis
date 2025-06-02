# mainapp/tests.py

import json
from unittest.mock import patch, call

from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import Study, Cipher, Association, Administrator, UserProfile

User = get_user_model()

FONT_WEIGHT_VALUES = [fw[0] for fw in Association.FontWeight.choices]
FONT_STYLE_VALUES = [fs[0] for fs in Association.FontStyle.choices]
LETTER_SPACING_VALUES = [0, 10]
FONT_SIZE_VALUES = [12, 16, 20]
LINE_HEIGHT_VALUES = [1.2, 1.5, 1.8]


class UserViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        try:
            self.register_url = reverse('user-register') 
            self.login_url = reverse('user-login')       
            self.users_list_url = reverse('user-list-get')                              
            self.user_detail_url_template = 'user-detail-delete'                   
        except Exception as e:
            print(f"CRITICAL ERROR in UserViewTests.setUp resolving URLs: {e}")
            print("PLEASE CHECK YOUR URLS.PY AND THE URL NAMES USED IN TESTS!")
            raise

        self.user_data_for_registration = {
            'username': 'testuser',
            'password': 'testpassword123',
            'email': 'test@example.com',
            'first_name': 'Test',
            'last_name': 'User',
            'gender': UserProfile.Gender.MALE,
            'age': 30,
            'education_level': UserProfile.EducationLevel.MASTER,
            'specialty': 'IT'
        }
        
        self.admin_user = User.objects.create_superuser('admin', 'admin@example.com', 'adminpass')
        Administrator.objects.create(user=self.admin_user)

        self.regular_user_data = {
            'username': 'regular', 
            'email': 'regular@example.com', 
            'password': 'regularpass'
        }
        self.regular_user = User.objects.create_user(**self.regular_user_data)
        profile = self.regular_user.profile
        profile.gender = UserProfile.Gender.FEMALE
        profile.age = 25
        profile.education_level = UserProfile.EducationLevel.BACHELOR
        profile.specialty = 'Designer'
        profile.save()


    def test_register_user_success(self):
        response = self.client.post(self.register_url, self.user_data_for_registration, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['username'], self.user_data_for_registration['username'])
        self.assertTrue(User.objects.filter(username=self.user_data_for_registration['username']).exists())
        created_user = User.objects.get(username=self.user_data_for_registration['username'])
        self.assertTrue(UserProfile.objects.filter(user=created_user).exists())
        self.assertEqual(created_user.profile.gender, self.user_data_for_registration['gender'])
        self.assertEqual(created_user.profile.age, self.user_data_for_registration['age'])


    def test_register_user_invalid_data(self):
        data = self.user_data_for_registration.copy()
        del data['password'] 
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)

    def test_login_user_success(self):
        login_data = {'username': self.regular_user_data['username'], 'password': self.regular_user_data['password']}
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('access', response.data)
        self.assertEqual(response.data['user']['username'], self.regular_user_data['username'])
        self.assertFalse(response.data['is_admin'])
        self.assertEqual(response.data['user']['profile']['gender'], self.regular_user.profile.gender)

    def test_login_admin_user_success(self):
        login_data = {'username': self.admin_user.username, 'password': 'adminpass'}
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data['is_admin'])

    def test_login_user_invalid_credentials(self):
        login_data = {'username': 'nonexistentuser', 'password': 'wrongpassword'}
        response = self.client.post(self.login_url, login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_users_list_as_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.users_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsInstance(response.data, list)
        self.assertTrue(len(response.data) >= 2) 

    def test_get_users_list_as_regular_user_forbidden(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(self.users_list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_users_list_unauthenticated(self):
        response = self.client.get(self.users_list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED) 

    def test_delete_user_as_admin_success(self):
        self.client.force_authenticate(user=self.admin_user)
        user_to_delete_url = reverse(self.user_detail_url_template, kwargs={'user_id': self.regular_user.pk})
        response = self.client.delete(user_to_delete_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertFalse(User.objects.filter(pk=self.regular_user.pk).exists())

    def test_delete_self_as_admin_fail(self):
        self.client.force_authenticate(user=self.admin_user)
        self_delete_url = reverse(self.user_detail_url_template, kwargs={'user_id': self.admin_user.pk})
        response = self.client.delete(self_delete_url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_delete_user_as_regular_user_forbidden(self):
        self.client.force_authenticate(user=self.regular_user)
        user_to_delete_url = reverse(self.user_detail_url_template, kwargs={'user_id': self.admin_user.pk})
        response = self.client.delete(user_to_delete_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_non_existent_user(self):
        self.client.force_authenticate(user=self.admin_user)
        non_existent_user_url = reverse(self.user_detail_url_template, kwargs={'user_id': 9999})
        response = self.client.delete(non_existent_user_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_get_single_user_not_implemented_or_wrong_method_for_list_view(self):
        self.client.force_authenticate(user=self.admin_user)
        detail_url_for_get_test = reverse(self.user_detail_url_template, kwargs={'user_id': self.regular_user.pk})
        response = self.client.get(detail_url_for_get_test)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)


class RandomCipherViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('rand_user', password='testpassword')
        self.client.force_authenticate(user=self.user)
        try:
            self.random_cipher_url = reverse('cipher-random') 
        except Exception as e:
            print(f"CRITICAL ERROR in RandomCipherViewTests.setUp resolving URLs: {e}")
            print("PLEASE CHECK YOUR URLS.PY AND THE URL NAMES USED IN TESTS!")
            raise

        self.cipher1 = Cipher.objects.create(result="Arial")
        self.cipher2 = Cipher.objects.create(result="Times New Roman")
        
        Association.objects.create(
            user=self.user, 
            cipher=self.cipher1,
            font_weight=FONT_WEIGHT_VALUES[0], 
            font_style=FONT_STYLE_VALUES[0],
            letter_spacing=LETTER_SPACING_VALUES[0],
            font_size=FONT_SIZE_VALUES[0],
            line_height=LINE_HEIGHT_VALUES[0],
            reaction_description="seen"
        )

    def test_get_random_cipher_unauthenticated(self):
        self.client.logout()
        response = self.client.post(self.random_cipher_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_random_cipher_success_new_combination(self):
        response = self.client.post(self.random_cipher_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('cipher_id', response.data)

    @patch('mainapp.views.Cipher.objects.all')
    @patch('mainapp.models.Cipher.objects.get_or_create')
    def test_get_random_cipher_creates_popular_if_none_exist(self, mock_get_or_create, mock_cipher_all):
        created_cipher_instance = Cipher(id=100, result="Comic Sans")
        mock_cipher_all.side_effect = [[], [created_cipher_instance]] 
        mock_get_or_create.return_value = (created_cipher_instance, True)
            
        response = self.client.post(self.random_cipher_url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn('cipher_id', response.data)
        self.assertEqual(response.data['result'], "Comic Sans")
        mock_get_or_create.assert_called()

    def test_get_random_cipher_all_seen(self):
        Cipher.objects.all().delete()
        single_cipher = Cipher.objects.create(result="TestFontOnly")
        
        Association.objects.create(
            user=self.user, cipher=single_cipher,
            font_weight=Association.FontWeight.REGULAR,
            font_style=Association.FontStyle.NORMAL,
            letter_spacing=0, font_size=16, line_height=1.5
        )
        data_flags_to_limit_combinations = {
            'vary_weight': False, 'vary_style': False, 'vary_spacing': False,
            'vary_size': False, 'vary_leading': False
        }
        response = self.client.post(self.random_cipher_url, data_flags_to_limit_combinations, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertTrue(response.data.get('all_seen', False))


@patch('mainapp.views.get_lemmas')
class StudyViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('study_user', password='testpassword')
        self.client.force_authenticate(user=self.user)
        self.study_url = reverse('study-save')

        self.cipher = Cipher.objects.create(result="Study Cipher")
        self.valid_study_data_item = {
            "cipher_id": self.cipher.id,
            "reaction_description": "Это моя реакция",
            "font_weight": FONT_WEIGHT_VALUES[0],
            "font_style": FONT_STYLE_VALUES[0],
            "letter_spacing": LETTER_SPACING_VALUES[0],
            "font_size": FONT_SIZE_VALUES[0],
            "line_height": LINE_HEIGHT_VALUES[0]
        }

    def test_save_study_unauthenticated(self, mock_get_lemmas):
        self.client.logout()
        response = self.client.post(self.study_url, [self.valid_study_data_item], format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_save_study_success_single_item(self, mock_get_lemmas):
        mock_get_lemmas.return_value = "это мой реакция"
        response = self.client.post(self.study_url, [self.valid_study_data_item], format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(len(response.data['saved']), 1)
        self.assertIn('association_id', response.data['saved'][0])
        self.assertTrue(Association.objects.filter(user=self.user, cipher=self.cipher).exists())
        mock_get_lemmas.assert_called_once_with("Это моя реакция")

    def test_save_study_data_not_a_list(self, mock_get_lemmas):
        response = self.client.post(self.study_url, {"key": "value"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], "Ожидается список объектов исследования.")

    def test_save_study_item_skipped(self, mock_get_lemmas):
        skipped_item = self.valid_study_data_item.copy()
        skipped_item["reaction_description"] = "[skipped]"
        response = self.client.post(self.study_url, [skipped_item], format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED) 
        self.assertEqual(len(response.data['saved']), 0)
        self.assertEqual(len(response.data['errors']), 0)
        self.assertFalse(Association.objects.filter(user=self.user, cipher=self.cipher).exists())
        mock_get_lemmas.assert_not_called()

    def test_save_study_item_missing_cipher_id(self, mock_get_lemmas):
        invalid_item = self.valid_study_data_item.copy()
        del invalid_item["cipher_id"]
        response = self.client.post(self.study_url, [invalid_item], format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(response.data['errors']), 1)
        self.assertEqual(response.data['errors'][0]['error'], "Поле 'cipher_id' (базовый шрифт) обязательно")

    def test_save_study_item_invalid_font_style(self, mock_get_lemmas):
        invalid_item = self.valid_study_data_item.copy()
        invalid_item["font_style"] = "invalid_style_value_not_in_choices"
        response = self.client.post(self.study_url, [invalid_item], format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(response.data['errors']), 1)
        self.assertEqual(response.data['errors'][0]['error'], "Недопустимые значения weight или style")

    def test_save_study_item_cipher_not_found(self, mock_get_lemmas):
        invalid_item = self.valid_study_data_item.copy()
        invalid_item["cipher_id"] = 999 
        response = self.client.post(self.study_url, [invalid_item], format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(len(response.data['errors']), 1)
        self.assertEqual(response.data['errors'][0]['error'], f"Базовый шрифт с ID 999 не найден")

    def test_save_study_duplicate_reaction(self, mock_get_lemmas):
        mock_get_lemmas.return_value = "это мой реакция"
        response1 = self.client.post(self.study_url, [self.valid_study_data_item], format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED, response1.data)
        self.assertTrue(Association.objects.filter(user=self.user, cipher=self.cipher).exists())
        
        response2 = self.client.post(self.study_url, [self.valid_study_data_item], format='json')
        
        self.assertEqual(response2.status_code, status.HTTP_400_BAD_REQUEST, response2.data)
        self.assertEqual(len(response2.data['errors']), 1)
        self.assertEqual(response2.data['errors'][0]['error'], "Повторная реакция на ту же вариацию")
        self.assertTrue(response2.data['errors'][0]['skipped'])
        
        self.assertEqual(mock_get_lemmas.call_count, 2)
        expected_calls = [call("Это моя реакция"), call("Это моя реакция")]
        mock_get_lemmas.assert_has_calls(expected_calls, any_order=False)


class GraphViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.graph_url = reverse('graph-data')

        self.user1 = User.objects.create_user('g_user1', password='p')
        self.user2 = User.objects.create_user('g_user2', password='p')
        
        self.cipher_arial = Cipher.objects.create(result="G_Arial")
        self.cipher_times = Cipher.objects.create(result="G_Times")

        Association.objects.create(
            user=self.user1, cipher=self.cipher_arial, reaction_description="Happy", reaction_lemmas="happy",
            font_weight=FONT_WEIGHT_VALUES[0], font_style=FONT_STYLE_VALUES[0], 
            letter_spacing=LETTER_SPACING_VALUES[0], font_size=FONT_SIZE_VALUES[0], line_height=LINE_HEIGHT_VALUES[0]
        )
        Association.objects.create(
            user=self.user2, cipher=self.cipher_arial, reaction_description="Happy", reaction_lemmas="happy",
            font_weight=FONT_WEIGHT_VALUES[1%len(FONT_WEIGHT_VALUES)],
            font_style=FONT_STYLE_VALUES[1%len(FONT_STYLE_VALUES)], 
            letter_spacing=LETTER_SPACING_VALUES[1%len(LETTER_SPACING_VALUES)], 
            font_size=FONT_SIZE_VALUES[1%len(FONT_SIZE_VALUES)], 
            line_height=LINE_HEIGHT_VALUES[1%len(LINE_HEIGHT_VALUES)]
        )
        Association.objects.create(
            user=self.user1, cipher=self.cipher_times, reaction_description="Sad", reaction_lemmas="sad",
            font_weight=FONT_WEIGHT_VALUES[0], font_style=FONT_STYLE_VALUES[0], 
            letter_spacing=LETTER_SPACING_VALUES[0], font_size=FONT_SIZE_VALUES[0], line_height=LINE_HEIGHT_VALUES[0]
        )
        Association.objects.create( 
            user=self.user1, cipher=self.cipher_times, reaction_description="", reaction_lemmas="",
            font_weight=FONT_WEIGHT_VALUES[1%len(FONT_WEIGHT_VALUES)],
            font_style=FONT_STYLE_VALUES[0], 
            letter_spacing=LETTER_SPACING_VALUES[0], 
            font_size=FONT_SIZE_VALUES[0], 
            line_height=LINE_HEIGHT_VALUES[0]
        )

    def test_get_graph_data_default_aggregation(self):
        response = self.client.get(self.graph_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        data = json.loads(response.content)
        self.assertEqual(len(data), 2)
        
        arial_happy_item = next(item for item in data if item['name'] == "G_Arial" and item['description'] == "Happy")
        self.assertEqual(arial_happy_item['count'], 2)

        times_sad_item = next(item for item in data if item['name'] == "G_Times" and item['description'] == "Sad")
        self.assertEqual(times_sad_item['count'], 1)

    def test_get_graph_data_aggregate_by_lemma(self):
        response = self.client.get(self.graph_url, {'aggregate_by_lemma': 'true'})
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        data = json.loads(response.content)
        self.assertEqual(len(data), 2)
        
        arial_happy_lemma_item = next(item for item in data if item['name'] == "G_Arial" and item['description'] == "happy")
        self.assertEqual(arial_happy_lemma_item['count'], 2)

        times_sad_lemma_item = next(item for item in data if item['name'] == "G_Times" and item['description'] == "sad")
        self.assertEqual(times_sad_lemma_item['count'], 1)

    def test_get_graph_data_empty(self):
        Association.objects.all().delete()
        response = self.client.get(self.graph_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        data = json.loads(response.content)
        self.assertEqual(len(data), 0)


@patch('mainapp.views.get_lemmas')
class AssociationSearchViewTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('search_user', password='testpassword')
        self.client.force_authenticate(user=self.user)
        self.search_url = reverse('association-search')

        self.cipher1 = Cipher.objects.create(result="SearchA")
        self.cipher2 = Cipher.objects.create(result="SearchB")

        Association.objects.create(
            user=self.user, cipher=self.cipher1, reaction_description="Очень веселый день", reaction_lemmas="очень веселый день",
            font_weight=FONT_WEIGHT_VALUES[0], 
            font_style=FONT_STYLE_VALUES[0],
            letter_spacing=10, 
            font_size=16, 
            line_height=1.5
        )
        Association.objects.create(
            user=self.user, cipher=self.cipher1, reaction_description="Просто веселый", reaction_lemmas="просто веселый",
            font_weight=FONT_WEIGHT_VALUES[1 % len(FONT_WEIGHT_VALUES)], 
            font_style=FONT_STYLE_VALUES[1 % len(FONT_STYLE_VALUES)],
            letter_spacing=0, 
            font_size=12, 
            line_height=1.2
        )
        Association.objects.create(
            user=self.user, cipher=self.cipher2, reaction_description="Тоже веселый", reaction_lemmas="тоже веселый",
            font_weight=FONT_WEIGHT_VALUES[0], 
            font_style=FONT_STYLE_VALUES[0],   
            letter_spacing=10, 
            font_size=16, 
            line_height=1.5
        )
        Association.objects.create(
            user=self.user, cipher=self.cipher1, reaction_description="Немного грустный", reaction_lemmas="немного грустный",
            font_weight=FONT_WEIGHT_VALUES[1 % len(FONT_WEIGHT_VALUES)], 
            font_style=FONT_STYLE_VALUES[1 % len(FONT_STYLE_VALUES)],   
            letter_spacing=5, 
            font_size=12, 
            line_height=1.2 
        )
        Association.objects.create(
            user=self.user, cipher=self.cipher1, reaction_description="Именно этот текст", reaction_lemmas="именно этот текст",
            font_weight=FONT_WEIGHT_VALUES[0], 
            font_style=FONT_STYLE_VALUES[0],   
            letter_spacing=0, 
            font_size=20, 
            line_height=1.8
        )

    def test_search_unauthenticated(self, mock_get_lemmas):
        self.client.logout()
        response = self.client.post(self.search_url, {"reaction_description": "веселый"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_search_no_term(self, mock_get_lemmas):
        response = self.client.post(self.search_url, {"reaction_description": ""}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['error'], "Необходимо указать текст реакции для поиска.")

    def test_search_by_lemma_match_exact_variation_success(self, mock_get_lemmas):
        mock_get_lemmas.return_value = "веселый"
        search_data = {"reaction_description": "веселый", "match_exact_variation": True, "search_by_lemma": True}
        response = self.client.post(self.search_url, search_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 3) 
        for item in response.data:
            self.assertEqual(item['score'], 1)
            self.assertFalse(item['aggregated_by_font_only'])
            self.assertIn("веселый", item['details']['reaction_lemmas'].lower())
        mock_get_lemmas.assert_called_with("веселый")

    def test_search_by_description_no_lemma_match_exact_variation_success(self, mock_get_lemmas):
        search_data = {"reaction_description": "Именно этот текст", "match_exact_variation": True, "search_by_lemma": False}
        response = self.client.post(self.search_url, search_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['score'], 1)
        self.assertEqual(response.data[0]['details']['reaction_description'], "Именно этот текст")
        self.assertFalse(response.data[0]['aggregated_by_font_only'])
        mock_get_lemmas.assert_not_called()

    def test_search_by_lemma_aggregate_by_font_only_success(self, mock_get_lemmas):
        mock_get_lemmas.return_value = "веселый"
        search_data = {"reaction_description": "веселый", "match_exact_variation": False, "search_by_lemma": True}
        response = self.client.post(self.search_url, search_data, format='json')

        # print(f"DEBUG: Status Code: {response.status_code}")
        # print(f"DEBUG: Response Data for aggregate_by_font_only: {response.data}") 

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIsInstance(response.data, list, f"Response.data is not a list: {response.data}")
        
        for item_idx, item_val in enumerate(response.data):
            self.assertIsInstance(item_val, dict, f"Item at index {item_idx} is not a dict: {item_val}")
            self.assertIn('details', item_val, f"Item at index {item_idx} does not have 'details' key: {item_val}")
            self.assertIsInstance(item_val['details'], dict, f"'details' in item at index {item_idx} is not a dict: {item_val['details']}")
            
            self.assertIn('cipher_name', item_val['details'], f"'details' in item at index {item_idx} does not have 'cipher_name' key: {item_val['details']}")
            self.assertIsInstance(item_val['details']['cipher_name'], str, f"'cipher_name' in 'details' at index {item_idx} is not a string: {item_val['details']['cipher_name']}")

        self.assertEqual(len(response.data), 2, f"Expected 2 items in response, got {len(response.data)}")
        
        font_a_group = next((item for item in response.data if item['details']['cipher_name'] == "SearchA"), None)
        font_b_group = next((item for item in response.data if item['details']['cipher_name'] == "SearchB"), None)

        self.assertIsNotNone(font_a_group, "FontA group not found in response")
        self.assertIsNotNone(font_b_group, "FontB group not found in response")

        if font_a_group:
            self.assertEqual(font_a_group['score'], 2)
            self.assertEqual(font_a_group['percentage'], 100.0)
            self.assertTrue(font_a_group['aggregated_by_font_only'])

        if font_b_group:
            self.assertEqual(font_b_group['score'], 1)
            self.assertEqual(font_b_group['percentage'], 50.0)
            self.assertTrue(font_b_group['aggregated_by_font_only'])
        
        mock_get_lemmas.assert_called_with("веселый")

    def test_search_not_found(self, mock_get_lemmas):
        mock_get_lemmas.return_value = "несуществующий"
        search_data = {"reaction_description": "несуществующий текст"}
        response = self.client.post(self.search_url, search_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['error'], "Ассоциации не найдены.")
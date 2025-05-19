# locustfile.py
from locust import HttpUser, task, between, events
import random
import json

class AnonymousUser(HttpUser):
    weight = 1 
    wait_time = between(2, 8)

    @task(2)
    def load_homepage(self):
        self.client.get("/")

    @task(1)
    def view_graph_data(self):
        self.client.get("/api/graph/")


class RegisteredUser(HttpUser):
    weight = 3
    wait_time = between(1, 5)
    
    def on_start(self):
        self.username = f"locust_user_{random.randint(1000, 99999)}"
        self.password = "locust_password123"
        self.email = f"{self.username}@example.com"
        self.access_token = None

        login_payload = {
            "username": "test@test.com", 
            "password": "password"      
        }
        
        with self.client.post("/api/users/login/", json=login_payload, catch_response=True, name="/api/users/login") as response:
            if response.status_code == 200:
                try:
                    self.access_token = response.json()["access"]
                    self.client.headers["Authorization"] = f"Bearer {self.access_token}"
                    response.success()
                except (json.JSONDecodeError, KeyError):
                    response.failure(f"Login response JSON error or missing 'access' key: {response.text[:100]}")
            else:
                response.failure(f"Login failed with {response.status_code}: {response.text[:100]}")

    @task(3)
    def get_random_cipher(self):
        if not self.access_token:
            return 
        
        payload = { 
            "vary_weight": random.choice([True, False]),
            "vary_style": random.choice([True, False])
        }
        with self.client.post("/api/ciphers/random/", json=payload, catch_response=True, name="/api/ciphers/random") as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Get random cipher failed with {response.status_code}: {response.text[:100]}")

    @task(1)
    def save_studies(self):
        if not self.access_token:
            return

        existing_cipher_ids = list(range(1, 11)) 
        if not existing_cipher_ids: return

        study_data = []
        num_studies_to_send = random.randint(1, 3)
        for _ in range(num_studies_to_send):
            study_data.append({
                "cipher_id": random.choice(existing_cipher_ids),
                "reaction_description": f"Reaction {random.randint(1,100)} from {self.username}",
                "font_weight": random.choice([100, 400, 700]),
                "font_style": random.choice(["normal", "italic"]),
                "letter_spacing": random.choice([0, 10]),
                "font_size": random.choice([12, 16, 20]),
                "line_height": random.choice([1.2, 1.5, 1.8])
            })
        
        with self.client.post("/api/studies/", json=study_data, catch_response=True, name="/api/studies (save)") as response:
            if response.status_code in [201, 207]:
                response.success()
            else:
                response.failure(f"Save studies failed with {response.status_code}: {response.text[:100]}")

    @task(2)
    def search_associations(self):
        if not self.access_token:
            return
        
        search_payload = {
            "reaction_description": random.choice(["веселый", "грустный", "интересный", "шрифт"]),
            "match_exact_variation": random.choice([True, False]),
            "search_by_lemma": random.choice([True, False])
        }
        with self.client.post("/api/associations/search/", json=search_payload, catch_response=True, name="/api/associations/search") as response:
            if response.status_code == 200 or response.status_code == 404:
                response.success()
            else:
                response.failure(f"Search associations failed with {response.status_code}: {response.text[:100]}")
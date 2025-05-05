from locust import HttpUser, task, between

class WebsiteUser(HttpUser):
    # Время ожидания между запросами
    wait_time = between(1, 5)

    @task(1)  # Задача с весом 1
    def load_homepage(self):
        """Тест загрузки главной страницы."""
        self.client.get("http://localhost:3000/")

    @task(2)
    def load_about(self):
        self.client.get("http://localhost:3000/test")

    @task(3)  # Задача с весом 3
    def submit_form(self):
        data = {"login": "user@zed.rio", "password": "123"}
        self.client.post("http://localhost:3000/login", data=data)

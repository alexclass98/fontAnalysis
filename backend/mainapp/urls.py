# mainapp/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path('login/', views.login, name='login'),
    path("random-cipher", views.random_cipher, name="random-cipher"),
    path("save-study", views.save_study, name="save-study"),
    path('save-association/', views.save_association, name='save-association'),
    path('users/', views.get_users, name='get_users'),
    path('user/<int:user_id>/', views.delete_user, name='delete_user'),
]

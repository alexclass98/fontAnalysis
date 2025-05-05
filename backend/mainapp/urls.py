from django.urls import path
from .views import UserView, CipherView, StudyView, AssociationView, GraphView

urlpatterns = [
    path('register/', UserView.as_view(), {'action': 'register'}, name='register'),
    path('login/', UserView.as_view(), {'action': 'login'}, name='login'),
    path("random-cipher", CipherView.as_view(), name="random-cipher"),
    path("save-study", StudyView.as_view(), name="save-study"),
    path('save-association/', AssociationView.as_view(), name='save-association'),
    path('users/', UserView.as_view(), name='get_users'),
    path('graph-data/', GraphView.as_view(), name='graph-data'),
    path('user/<int:user_id>/', UserView.as_view(), name='delete_user'),
]
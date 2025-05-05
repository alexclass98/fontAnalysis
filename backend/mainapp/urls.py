from django.urls import path
from .views import UserView, RandomCipherView, StudyView, GraphView, FindFontByReactionView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('users/register/', UserView.as_view(), {'action': 'register'}, name='user-register'),
    path('users/login/', UserView.as_view(), {'action': 'login'}, name='user-login'),
    path('users/', UserView.as_view(), name='user-list-get'),
    path('users/<int:user_id>/', UserView.as_view(), name='user-detail-delete'),
    path('ciphers/random/', RandomCipherView.as_view(), name='cipher-random'),
    path('studies/', StudyView.as_view(), name='study-save'),
    path('graph/', GraphView.as_view(), name='graph-data'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('fonts/find-by-reaction/', FindFontByReactionView.as_view(), name='font-find-by-reaction'),
]
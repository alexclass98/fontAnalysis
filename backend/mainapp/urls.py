from django.urls import path
from .views import (
    UserView, RandomCipherView, StudyView, GraphView, AssociationSearchView, 
    NLPAnalysisView, AllAssociationsNLPAnalysisView, AllAssociationsForNLPView,
    filtered_associations_for_nlp, fast_grouped_associations
)
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
    path('associations/search/', AssociationSearchView.as_view(), name='association-search'),
    path('nlp/analyze-text/', NLPAnalysisView.as_view(), name='nlp-analyze-text'),
    path('nlp/analyze-all-associations/', AllAssociationsNLPAnalysisView.as_view(), name='nlp-analyze-all-associations'),
    path('nlp/all-associations-full/', AllAssociationsForNLPView.as_view(), name='all_associations_nlp_full'),
    path('nlp/filtered-associations/', filtered_associations_for_nlp, name='filtered_associations_nlp'),
]
urlpatterns += [
    path('nlp/fast-grouped/', fast_grouped_associations, name='fast_grouped_associations'),
]
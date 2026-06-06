from django.urls import path

from . import views

urlpatterns = [
    path("", views.catalog, name="catalog"),
    path("login/", views.login_user, name="login"),
    path("signup/", views.signup_user, name="signup"),
    path("logout/", views.logout_user, name="logout"),
    path("game/<int:game_id>/", views.game_detail, name="game_detail"),
    path("library/", views.library, name="library"),
    path("wishlist/", views.wishlist, name="wishlist"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("dashboard/add-game/", views.add_game, name="add_game"),
]

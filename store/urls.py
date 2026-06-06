from django.urls import path

from . import views

urlpatterns = [
    path("", views.catalog, name="catalog"),
    path("login/", views.login, name="login"),
    path("signup/", views.signup, name="signup"),
    path("logout/", views.logout, name="logout"),
    path("game/<int:game_id>/", views.game_detail, name="game_detail"),
    path("library/", views.library, name="library"),
    path("wishlist/", views.wishlist, name="wishlist"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("dashboard/add-game/", views.add_game, name="add_game"),
    path(
        "api/wishlist/toggle/<int:game_id>/",
        views.api_toggle_wishlist,
        name="api_toggle_wishlist",
    ),
    path(
        "api/purchase/<int:game_id>/", views.api_purchase_game, name="api_purchase_game"
    ),
    path(
        "api/review/<int:game_id>/", views.api_submit_review, name="api_submit_review"
    ),
    path(
        "api/developer/follow/<int:developer_id>/",
        views.api_toggle_follow,
        name="api_toggle_follow",
    ),
]

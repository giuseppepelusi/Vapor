import json

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db.models import Avg
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .models import Game, Genre, Purchase, Review, UserProfile, Wishlist


def catalog(request):
    games = Game.objects.all().order_by("-created_at")
    genres = Genre.objects.all()

    search_query = request.GET.get("search", "")
    genre_filter = request.GET.get("genre", "")

    if search_query:
        games = games.filter(title__icontains=search_query)
    if genre_filter:
        games = games.filter(genres__id=genre_filter)

    context = {
        "games": games,
        "genres": genres,
        "search_query": search_query,
        "selected_genre": genre_filter,
    }
    return render(request, "catalog.html", context)


def game_detail(request, game_id):
    game = get_object_or_404(Game, id=game_id)
    reviews = Review.objects.filter(game=game).order_by("-created_at")

    average_rating = reviews.aggregate(Avg("rating"))["rating__avg"]
    if average_rating:
        average_rating = round(average_rating, 1)

    is_purchased = False
    is_wishlisted = False
    is_following = False

    if request.user.is_authenticated:
        is_purchased = Purchase.objects.filter(player=request.user, game=game).exists()
        is_wishlisted = Wishlist.objects.filter(player=request.user, game=game).exists()

        developer_profile = get_object_or_404(UserProfile, user=game.developer)
        is_following = request.user.userprofile.following.filter(
            id=developer_profile.id
        ).exists()

    context = {
        "game": game,
        "reviews": reviews,
        "average_rating": average_rating,
        "is_purchased": is_purchased,
        "is_wishlisted": is_wishlisted,
        "is_following": is_following,
    }
    return render(request, "game_detail.html", context)


def login_user(request):
    if request.user.is_authenticated:
        return redirect("catalog")

    error_message = None
    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            return redirect("catalog")
        else:
            error_message = "Invalid username or password."

    return render(request, "login.html", {"error": error_message})


def signup_user(request):
    if request.user.is_authenticated:
        return redirect("catalog")

    error_message = None
    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()
        role = request.POST.get("role", "player")

        if User.objects.filter(username=username).exists():
            error_message = "This username is already taken."
        else:
            user = User.objects.create_user(username=username, password=password)
            is_dev = role == "developer"
            UserProfile.objects.create(user=user, is_developer=is_dev)

            login(request, user)
            return redirect("catalog")

    return render(request, "signup.html", {"error": error_message})


def logout_user(request):
    logout(request)
    return redirect("catalog")


@login_required
def library(request):
    purchases = Purchase.objects.filter(player=request.user).select_related("game")
    games = [purchase.game for purchase in purchases]

    return render(request, "library.html", {"games": games})


@login_required
def wishlist(request):
    wishlist_items = Wishlist.objects.filter(player=request.user).select_related("game")
    games = [item.game for item in wishlist_items]

    return render(request, "wishlist.html", {"games": games})


@login_required
def dashboard(request):
    if not request.user.userprofile.is_developer:
        return redirect("catalog")

    my_games = Game.objects.filter(developer=request.user).order_by("-created_at")

    return render(request, "dashboard.html", {"games": my_games})


@login_required
def add_game(request):
    if not request.user.userprofile.is_developer:
        return redirect("catalog")

    error_message = None
    genres = Genre.objects.all()

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        description = request.POST.get("description", "").strip()
        price = request.POST.get("price", 0.0)
        requirements = request.POST.get("requirements", "").strip()
        cover_image = request.FILES.get("cover_image")
        genre_ids = request.POST.getlist("genres")

        if not title or not description or not genre_ids:
            error_message = (
                "Please fill in all required fields and select at least one genre."
            )
        else:
            game = Game.objects.create(
                title=title,
                description=description,
                price=price,
                system_requirements=requirements,
                cover_image=cover_image,
                developer=request.user,
            )
            game.genres.set(genre_ids)
            return redirect("dashboard")

    return render(request, "add_game.html", {"genres": genres, "error": error_message})


@login_required
@require_POST
def api_toggle_wishlist(request, game_id):
    game = get_object_or_404(Game, id=game_id)

    if Purchase.objects.filter(player=request.user, game=game).exists():
        return JsonResponse(
            {"status": "error", "message": "Game already purchased."}, status=400
        )

    wishlist_item = Wishlist.objects.filter(player=request.user, game=game).first()
    if wishlist_item:
        wishlist_item.delete()
        return JsonResponse({"status": "removed"})
    else:
        Wishlist.objects.create(player=request.user, game=game)
        return JsonResponse({"status": "added"})


@login_required
@require_POST
def api_purchase_game(request, game_id):
    game = get_object_or_404(Game, id=game_id)

    if Purchase.objects.filter(player=request.user, game=game).exists():
        return JsonResponse(
            {"status": "error", "message": "Game already purchased."}, status=400
        )

    Purchase.objects.create(player=request.user, game=game)
    Wishlist.objects.filter(player=request.user, game=game).delete()

    return JsonResponse(
        {"status": "success", "message": "Game purchased successfully."}
    )


@login_required
@require_POST
def api_submit_review(request, game_id):
    game = get_object_or_404(Game, id=game_id)

    if not Purchase.objects.filter(player=request.user, game=game).exists():
        return JsonResponse(
            {"status": "error", "message": "You must own the game to review it."},
            status=403,
        )

    try:
        data = json.loads(request.body)
        rating = int(data.get("rating"))
        comment = data.get("comment", "").strip()
    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse(
            {"status": "error", "message": "Invalid data format."}, status=400
        )

    if not (1 <= rating <= 5):
        return JsonResponse(
            {"status": "error", "message": "Rating must be between 1 and 5."},
            status=400,
        )

    Review.objects.update_or_create(
        player=request.user, game=game, defaults={"rating": rating, "comment": comment}
    )

    return JsonResponse(
        {"status": "success", "message": "Review submitted successfully."}
    )


@login_required
@require_POST
def api_toggle_follow(request, developer_id):
    developer_user = get_object_or_404(User, id=developer_id)
    developer_profile = get_object_or_404(
        UserProfile, user=developer_user, is_developer=True
    )
    user_profile = request.user.userprofile

    if developer_profile == user_profile:
        return JsonResponse(
            {"status": "error", "message": "You cannot follow yourself."}, status=400
        )

    if user_profile.following.filter(id=developer_profile.id).exists():
        user_profile.following.remove(developer_profile)
        return JsonResponse({"status": "unfollowed"})
    else:
        user_profile.following.add(developer_profile)
        return JsonResponse({"status": "followed"})

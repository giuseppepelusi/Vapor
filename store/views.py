import json

from django.contrib import messages
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
    max_price = request.GET.get("max_price", "")

    if search_query:
        games = games.filter(title__icontains=search_query)

    if genre_filter:
        games = games.filter(genres__id=genre_filter)

    if max_price and max_price.isdigit():
        games = games.filter(price__lte=int(max_price))

    followed_games = Game.objects.none()
    if request.user.is_authenticated:
        try:
            user_profile = request.user.profile
            followed_developers = user_profile.following.all()
            if followed_developers.exists():
                followed_games = games.filter(
                    developer__profile__in=followed_developers
                ).distinct()
        except AttributeError:
            pass

    if (
        request.headers.get("x-requested-with") == "XMLHttpRequest"
        or request.GET.get("format") == "json"
    ):

        def serialize_games(games_queryset):
            return [
                {
                    "id": game.id,
                    "title": game.title,
                    "price": float(game.price),
                    "cover_image_url": game.cover_image.url
                    if game.cover_image
                    else None,
                    "developer_username": game.developer.username,
                    "genres": [g.name for g in game.genres.all()],
                }
                for game in games_queryset
            ]

        return JsonResponse(
            {
                "games": serialize_games(games),
                "followed_games": serialize_games(followed_games)
                if request.user.is_authenticated
                else [],
            }
        )

    context = {
        "games": games,
        "genres": genres,
        "followed_games": followed_games if followed_games.exists() else None,
        "search_query": search_query,
        "selected_genre": genre_filter,
        "max_price": max_price,
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
        is_following = request.user.profile.following.filter(
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

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()

        user = authenticate(request, username=username, password=password)
        if user is not None:
            login(request, user)
            messages.success(request, f"Welcome back, {user.username}!")
            return redirect("catalog")
        else:
            messages.error(request, "Invalid username or password.")

    return render(request, "login.html")


def signup_user(request):
    if request.user.is_authenticated:
        return redirect("catalog")

    if request.method == "POST":
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "").strip()
        role = request.POST.get("role", "player")

        if User.objects.filter(username=username).exists():
            messages.error(request, "This username is already taken.")
        else:
            user = User.objects.create_user(username=username, password=password)
            is_dev = role == "developer"
            UserProfile.objects.create(user=user, is_developer=is_dev)

            login(request, user)
            messages.success(request, "Account created successfully! Welcome to Vapor.")
            return redirect("catalog")

    return render(request, "signup.html")


def logout_user(request):
    logout(request)
    messages.success(request, "You have been logged out successfully.")
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
    if not request.user.profile.is_developer:
        messages.error(request, "Access denied. You are not registered as a developer.")
        return redirect("catalog")

    my_games = Game.objects.filter(developer=request.user).order_by("-created_at")

    return render(request, "dashboard.html", {"games": my_games})


@login_required
def add_game(request):
    if not request.user.profile.is_developer:
        messages.error(request, "Access denied. Only developers can add games.")
        return redirect("catalog")

    genres = Genre.objects.all()

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        description = request.POST.get("description", "").strip()
        price = request.POST.get("price", 0.0)
        requirements = request.POST.get("requirements", "").strip()
        cover_image = request.FILES.get("cover_image")
        genre_ids = request.POST.getlist("genres")

        if not title or not description or not genre_ids:
            messages.warning(
                request,
                "Please fill in all required fields and select at least one genre.",
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
            messages.success(
                request, f'"{title}" has been successfully added to the store!'
            )
            return redirect("dashboard")

    return render(request, "add_game.html", {"genres": genres})


@login_required
@require_POST
def api_toggle_wishlist(request, game_id):
    game = get_object_or_404(Game, id=game_id)

    if Purchase.objects.filter(player=request.user, game=game).exists():
        return JsonResponse({"status": "error"}, status=400)

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
        return JsonResponse({"status": "error"}, status=400)

    Purchase.objects.create(player=request.user, game=game)
    Wishlist.objects.filter(player=request.user, game=game).delete()

    return JsonResponse({"status": "success"})


@login_required
@require_POST
def api_submit_review(request, game_id):
    game = get_object_or_404(Game, id=game_id)

    if not Purchase.objects.filter(player=request.user, game=game).exists():
        return JsonResponse({"status": "error"}, status=403)

    try:
        data = json.loads(request.body)
        rating = int(data.get("rating"))
        comment = data.get("comment", "").strip()
    except (ValueError, TypeError, json.JSONDecodeError):
        return JsonResponse({"status": "error"}, status=400)

    if not (1 <= rating <= 5):
        return JsonResponse({"status": "error"}, status=400)

    review, created = Review.objects.update_or_create(
        player=request.user, game=game, defaults={"rating": rating, "comment": comment}
    )

    return JsonResponse(
        {
            "status": "success",
            "review": {
                "id": review.id,
                "player_username": request.user.username,
                "rating": review.rating,
                "comment": review.comment,
                "created_at": review.created_at.strftime("%b %d, %Y"),
            },
        }
    )


@login_required
@require_POST
def api_toggle_follow(request, developer_id):
    developer_user = get_object_or_404(User, id=developer_id)
    developer_profile = get_object_or_404(
        UserProfile, user=developer_user, is_developer=True
    )
    user_profile = request.user.profile

    if developer_profile == user_profile:
        return JsonResponse({"status": "error"}, status=400)

    if user_profile.following.filter(id=developer_profile.id).exists():
        user_profile.following.remove(developer_profile)
        return JsonResponse({"status": "unfollowed"})
    else:
        user_profile.following.add(developer_profile)
        return JsonResponse({"status": "followed"})

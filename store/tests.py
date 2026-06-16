import json

from django.contrib.auth.models import User
from django.db.models import Count
from django.test import TestCase
from django.urls import reverse

from .models import Game, Genre, UserProfile


def make_user(username, is_developer=False):
    user = User.objects.create_user(username=username, password="password")
    UserProfile.objects.create(user=user, is_developer=is_developer)
    return user


def make_game(developer, title, price, genres):
    game = Game.objects.create(
        developer=developer,
        title=title,
        price=price,
        description="A game.",
        system_requirements="Nothing",
    )
    game.genres.set(genres)
    return game


class SuggestedGamesTest(TestCase):
    def setUp(self):
        self.developer = make_user("developer", is_developer=True)

        self.action = Genre.objects.create(name="Action")
        self.rpg = Genre.objects.create(name="RPG")
        self.survival = Genre.objects.create(name="Survival")

        self.target = make_game(
            self.developer, "Target Game", 19.99, [self.action, self.rpg]
        )

    def get_suggested(self, game):
        genre_ids = game.genres.values_list("id", flat=True)
        return (
            Game.objects.filter(genres__id__in=genre_ids)
            .exclude(id=game.id)
            .annotate(shared_genres_count=Count("genres"))
            .order_by("-shared_genres_count", "-created_at")
            .distinct()[:4]
        )

    def test_related_games_appear_in_suggestions(self):
        game_a = make_game(self.developer, "Action RPG", 9.99, [self.action, self.rpg])
        game_b = make_game(self.developer, "Action Game", 4.99, [self.action])

        suggestions = list(self.get_suggested(self.target))

        self.assertNotIn(self.target, suggestions)
        self.assertIn(game_a, suggestions)
        self.assertIn(game_b, suggestions)

    def test_no_suggestions_when_no_related_games_exist(self):
        suggestions = list(self.get_suggested(self.target))

        self.assertEqual(len(suggestions), 0)

    def test_suggestions_capped_at_four(self):
        for i in range(6):
            make_game(self.developer, f"Action Game {i}", 5.00, [self.action])

        suggestions = list(self.get_suggested(self.target))

        self.assertLessEqual(len(suggestions), 4)

    def test_unrelated_game_excluded_from_suggestions(self):
        related = make_game(self.developer, "Another RPG", 9.99, [self.rpg])
        unrelated = make_game(self.developer, "Survival Island", 2.99, [self.survival])

        suggestions = list(self.get_suggested(self.target))

        self.assertIn(related, suggestions)
        self.assertNotIn(unrelated, suggestions)


class CatalogSearchTest(TestCase):
    def setUp(self):
        self.developer = make_user("developer", is_developer=True)

        adventure = Genre.objects.create(name="Adventure")
        shooter = Genre.objects.create(name="Shooter")

        self.game_one = make_game(self.developer, "Shadow Run", 14.99, [adventure])
        self.game_two = make_game(self.developer, "Steel Horizon", 29.99, [shooter])

        self.url = reverse("catalog")

    def test_search_with_matching_title_returns_correct_game(self):
        response = self.client.get(self.url, {"search": "Shadow", "format": "json"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/json")

        data = json.loads(response.content)

        self.assertIn("games", data)
        self.assertEqual(len(data["games"]), 1)
        self.assertEqual(data["games"][0]["title"], "Shadow Run")

    def test_search_with_no_match_returns_empty_list(self):
        response = self.client.get(
            self.url, {"search": "xyznotexist", "format": "json"}
        )

        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content)

        self.assertIn("games", data)
        self.assertEqual(len(data["games"]), 0)

    def test_empty_search_returns_all_games(self):
        response = self.client.get(self.url, {"search": "", "format": "json"})

        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content)

        self.assertIn("games", data)
        self.assertEqual(len(data["games"]), 2)

    def test_whitespace_search_returns_no_games(self):
        response = self.client.get(self.url, {"search": "   ", "format": "json"})

        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content)

        self.assertIn("games", data)
        self.assertEqual(len(data["games"]), 0)

    def test_game_object_contains_required_fields(self):
        response = self.client.get(self.url, {"search": "Shadow", "format": "json"})

        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content)
        game = data["games"][0]

        for field in [
            "id",
            "title",
            "price",
            "cover_image_url",
            "developer_username",
            "genres",
        ]:
            self.assertIn(field, game)

        self.assertIsInstance(game["price"], float)
        self.assertIsInstance(game["genres"], list)

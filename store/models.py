from django.contrib.auth.models import User
from django.db import models


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    is_developer = models.BooleanField(default=False)
    following = models.ManyToManyField(
        "self", symmetrical=False, blank=True, related_name="followers"
    )

    def __str__(self):
        return (
            f"{self.user.username} ({'Developer' if self.is_developer else 'Player'})"
        )


class Genre(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Game(models.Model):
    developer = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="published_games"
    )
    title = models.CharField(max_length=200)
    price = models.DecimalField(max_digits=6, decimal_places=2)
    description = models.TextField()
    system_requirements = models.TextField()
    cover_image = models.ImageField(upload_to="covers/", blank=True, null=True)
    genres = models.ManyToManyField(Genre, related_name="games")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Purchase(models.Model):
    player = models.ForeignKey(User, on_delete=models.CASCADE, related_name="purchases")
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="sales")
    purchased_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (
            "player",
            "game",
        )


class Wishlist(models.Model):
    player = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="wishlist_items"
    )
    game = models.ForeignKey(
        Game, on_delete=models.CASCADE, related_name="wishlisted_by"
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("player", "game")


class Review(models.Model):
    player = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reviews")
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name="reviews")
    rating = models.IntegerField()
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("player", "game")

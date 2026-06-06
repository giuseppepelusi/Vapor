from django.contrib import admin

from .models import Game, Genre, Purchase, Review, UserProfile, Wishlist

admin.site.register(UserProfile)
admin.site.register(Genre)
admin.site.register(Game)
admin.site.register(Purchase)
admin.site.register(Wishlist)
admin.site.register(Review)

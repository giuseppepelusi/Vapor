from django.contrib import admin
from django.contrib.auth.models import Group

from .models import Game, Genre, Purchase, Review, UserProfile, Wishlist

admin.site.unregister(Group)

admin.site.register(UserProfile)
admin.site.register(Genre)
admin.site.register(Game)
admin.site.register(Purchase)
admin.site.register(Wishlist)
admin.site.register(Review)

admin.site.site_header = admin.site.site_title = admin.site.index_title = (
    "Vapor Admin Panel"
)

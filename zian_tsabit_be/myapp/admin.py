from django.contrib import admin
from .models import Book, Project, Update, GarageSale

admin.site.register(Book)
admin.site.register(Project)
admin.site.register(Update)
admin.site.register(GarageSale)

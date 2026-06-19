from django.urls import path

from . import views

urlpatterns = [
    path("", views.expenses_list, name="expenses-list"),
    path("<int:expense_id>/", views.expense_detail, name="expense-detail"),
    path("<int:expense_id>/approve/", views.expense_approve, name="expense-approve"),
    path("<int:expense_id>/reject/", views.expense_reject, name="expense-reject"),
    path("categories/", views.categories_list, name="expense-categories-list"),
    path("categories/<int:category_id>/", views.category_detail, name="expense-category-detail"),
]

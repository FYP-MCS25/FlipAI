from django.http import JsonResponse
from django.shortcuts import render


def home(request):
    """
    Home page with links to API documentation
    """
    return render(request, 'home.html')

import hmac
import time
import re
import secrets
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)

GOOGLE_CHALLENGE_TTL_SECONDS = 300
GOOGLE_CHALLENGE_CACHE_PREFIX = 'google_auth_challenge:'


class GoogleChallengeSerializer(serializers.Serializer):
    state = serializers.CharField(max_length=128)
    nonce = serializers.CharField(max_length=256)


class GoogleSignInSerializer(serializers.Serializer):
    id_token = serializers.CharField()
    state = serializers.CharField(max_length=128)


def _build_unique_username(email: str) -> str:
    User = get_user_model()
    local_part = email.split('@', 1)[0].lower()
    base = re.sub(r'[^a-z0-9_]+', '_', local_part).strip('_') or 'user'
    username = base
    suffix = 1

    while User.objects.filter(username=username).exists():
        suffix += 1
        username = f"{base}_{suffix}"

    return username


def _challenge_key(state: str) -> str:
    return f"{GOOGLE_CHALLENGE_CACHE_PREFIX}{state}"


class GoogleChallengeView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {'detail': 'GOOGLE_OAUTH_CLIENT_ID is not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        state = secrets.token_urlsafe(24)
        nonce = secrets.token_urlsafe(32)

        cache.set(
            _challenge_key(state),
            nonce,
            timeout=GOOGLE_CHALLENGE_TTL_SECONDS,
        )

        return Response(
            {
                'state': state,
                'nonce': nonce,
                'client_id': settings.GOOGLE_OAUTH_CLIENT_ID,
                'expires_in': GOOGLE_CHALLENGE_TTL_SECONDS,
            },
            status=status.HTTP_200_OK,
        )


class GoogleSignInView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleSignInSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not settings.GOOGLE_OAUTH_CLIENT_ID:
            return Response(
                {'detail': 'GOOGLE_OAUTH_CLIENT_ID is not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        google_token = serializer.validated_data['id_token']
        state = serializer.validated_data['state']

        expected_nonce = cache.get(_challenge_key(state))
        if not expected_nonce:
            return Response(
                {'detail': 'Expired or invalid authentication state.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            try:
                token_info = id_token.verify_oauth2_token(
                    google_token,
                    google_requests.Request(),
                    settings.GOOGLE_OAUTH_CLIENT_ID,
                )
            except ValueError as e:
                # If the token is "too early" (clock skew), wait 5 seconds and retry once
                if "Token used too early" in str(e):
                    time.sleep(5)
                    token_info = id_token.verify_oauth2_token(
                        google_token,
                        google_requests.Request(),
                        settings.GOOGLE_OAUTH_CLIENT_ID,
                    )
                else:
                    raise e
        except ValueError as e:
            logger.error(f"Google Token Verification Failed: {str(e)}")
            return Response(
                {'detail': 'Invalid Google token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_nonce = token_info.get('nonce')
        if not token_nonce or not hmac.compare_digest(str(token_nonce), str(expected_nonce)):
            return Response(
                {'detail': 'Nonce verification failed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cache.delete(_challenge_key(state))

        issuer = token_info.get('iss')
        if issuer not in ('accounts.google.com', 'https://accounts.google.com'):
            return Response(
                {'detail': 'Invalid token issuer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not token_info.get('email_verified', False):
            return Response(
                {'detail': 'Google account email is not verified.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = token_info.get('email')
        if not email:
            return Response(
                {'detail': 'No email found in Google token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        User = get_user_model()
        user = User.objects.filter(email=email).first()
        if user is None:
            user = User.objects.create(
                username=_build_unique_username(email),
                email=email,
                first_name=token_info.get('given_name', ''),
                last_name=token_info.get('family_name', ''),
                last_login=timezone.now(), 
            )
            # Enforce Google-only login for application users.
            user.set_unusable_password()
            user.save(update_fields=['password'])
        else:
            updated = False
            first_name = token_info.get('given_name', '')
            last_name = token_info.get('family_name', '')

            if first_name and user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updated = True
            if not user.has_usable_password():
                pass
            else:
                user.set_unusable_password()
                updated = True

            if updated:
                user.save()

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                },
            },
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response(
            {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    class InputSerializer(serializers.Serializer):
        refresh = serializers.CharField()

    def post(self, request):
        serializer = self.InputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            token = RefreshToken(serializer.validated_data['refresh'])
            token.blacklist()
        except Exception:
            return Response(
                {'detail': 'Invalid refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)
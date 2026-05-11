from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


@override_settings(GOOGLE_OAUTH_CLIENT_ID='test-google-client-id.apps.googleusercontent.com')
class GoogleAuthTests(APITestCase):
    def test_google_challenge_returns_nonce_and_state(self):
        response = self.client.get('/api/v1/auth/google-challenge/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('state', response.data)
        self.assertIn('nonce', response.data)
        self.assertIn('client_id', response.data)

    @patch('api.auth_views.id_token.verify_oauth2_token')
    def test_google_sign_in_creates_user_and_returns_tokens(self, mock_verify_token):
        challenge_response = self.client.get('/api/v1/auth/google-challenge/')
        state = challenge_response.data['state']
        nonce = challenge_response.data['nonce']

        mock_verify_token.return_value = {
            'iss': 'https://accounts.google.com',
            'email_verified': True,
            'email': 'new.user@example.com',
            'given_name': 'New',
            'family_name': 'User',
            'nonce': nonce,
        }

        response = self.client.post(
            '/api/v1/auth/google-sign-in/',
            {'id_token': 'valid-token', 'state': state},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

        User = get_user_model()
        created_user = User.objects.get(email='new.user@example.com')
        self.assertFalse(created_user.has_usable_password())

    @patch('api.auth_views.id_token.verify_oauth2_token')
    def test_google_sign_in_rejects_nonce_mismatch(self, mock_verify_token):
        challenge_response = self.client.get('/api/v1/auth/google-challenge/')
        state = challenge_response.data['state']

        mock_verify_token.return_value = {
            'iss': 'https://accounts.google.com',
            'email_verified': True,
            'email': 'new.user@example.com',
            'nonce': 'wrong-nonce',
        }

        response = self.client.post(
            '/api/v1/auth/google-sign-in/',
            {'id_token': 'valid-token', 'state': state},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_endpoint_requires_authentication(self):
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

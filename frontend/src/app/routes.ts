import { createBrowserRouter, redirect } from "react-router";
import { authAPI, clearAuthTokens, getAccessToken } from "../apiService";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { Dashboard } from "./components/Dashboard";

async function hasValidSession(): Promise<boolean> {
  if (!getAccessToken()) {
    return false;
  }

  try {
    await authAPI.me();
    return true;
  } catch {
    try {
      await authAPI.refreshToken();
      await authAPI.me();
      return true;
    } catch {
      clearAuthTokens();
      return false;
    }
  }
}

async function requireAuth() {
  const authenticated = await hasValidSession();
  if (!authenticated) {
    throw redirect('/login');
  }
  return null;
}

async function redirectIfAuthenticated() {
  const authenticated = await hasValidSession();
  if (authenticated) {
    throw redirect('/dashboard');
  }
  return null;
}

export const router = createBrowserRouter([
  {
    path: "/",
    loader: requireAuth,
    Component: Dashboard,
  },
  {
    path: "/login",
    loader: redirectIfAuthenticated,
    Component: Login,
  },
  {
    path: "/signup",
    loader: redirectIfAuthenticated,
    Component: Signup,
  },
  {
    path: "/dashboard",
    loader: requireAuth,
    Component: Dashboard,
  },
]);

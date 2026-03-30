import { createBrowserRouter } from "react-router";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { Dashboard } from "./components/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    // TODO(auth): Route to login or dashboard based on real session state once auth guard is implemented.
    Component: Dashboard,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
]);

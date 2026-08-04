export {
  useAuthStore,
  selectIsAuthenticated,
  selectStatus,
  selectUser,
  type AuthStatus,
} from './lib/auth.store.js';

export {
  formErrorMessage,
  useCurrentUser,
  useForgotPassword,
  useLogin,
  useLogout,
  useRegister,
  useResetPassword,
  useSessionBootstrap,
} from './lib/use-auth.js';

export { ProtectedRoute, PublicOnlyRoute } from './lib/protected-route.js';
export { AuthLayout, type AuthLayoutProps } from './lib/auth-layout.js';

export { LoginPage } from './lib/pages/login-page.js';
export { RegisterPage } from './lib/pages/register-page.js';
export { ForgotPasswordPage } from './lib/pages/forgot-password-page.js';
export { ResetPasswordPage } from './lib/pages/reset-password-page.js';

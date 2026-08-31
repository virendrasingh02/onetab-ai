export {
  useAuthStore,
  selectIsAuthenticated,
  selectStatus,
  selectUser,
  type AuthStatus,
} from './lib/auth.store.js';

export {
  useAccountStore,
  selectAccounts,
  selectActiveAccount,
  selectActiveAccountId,
  getActiveAccount,
  type Account,
  type AccountWorkspace,
} from './lib/account-store.js';

export {
  useAccounts,
  useAddAccount,
  useSignUpAccount,
  useSwitchAccount,
  useRemoveAccount,
  useLinkedAccountWorkspaces,
  type AddAccountInput,
  type SignUpAccountInput,
} from './lib/use-account-switcher.js';

export {
  formErrorMessage,
  redirectPathFromAuthState,
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
export { DesktopAuthCallbackPage } from './lib/pages/desktop-auth-callback-page.js';
export { MobileDeviceConfirmPage } from './lib/pages/mobile-device-confirm-page.js';
export { MobileDevicePairPage } from './lib/pages/mobile-device-pair-page.js';

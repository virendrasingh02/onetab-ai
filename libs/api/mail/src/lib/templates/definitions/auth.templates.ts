import type { EmailTemplateDefinition } from '@org/types';
import {
  EmailAlert,
  EmailButton,
  EmailCode,
  EmailHeading,
  EmailSecurityNotice,
  EmailText,
} from '../../components/index.js';

export const AUTH_TEMPLATES: EmailTemplateDefinition[] = [
  {
    templateKey: 'AUTH_WELCOME',
    name: 'Welcome & Account Created',
    category: 'AUTHENTICATION',
    description: 'Sent when a new user registers an account on the platform.',
    subject: 'Welcome to {{appName || "OneTab AI"}}, {{user.firstName || "there"}}!',
    previewText: 'Your account is ready. Get started collaborating with your team.',
    htmlBody: `
      ${EmailHeading('Welcome to {{appName || "OneTab AI"}}!')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Your account has been created successfully. You can now collaborate in workspaces, chat with teammates, build AI agents, and run projects seamlessly.')}
      ${EmailButton('Get Started', '{{appUrl || "http://localhost:4200"}}')}
      ${EmailText('If you have any questions or need help setting up your team, reach out to support at {{supportEmail || "support@onetab.ai"}}.', 'muted')}
    `,
    textBody: `Welcome to {{appName || "OneTab AI"}}!\n\nHi {{user.firstName || "there"}},\n\nYour account has been created successfully. Get started at: {{appUrl || "http://localhost:4200"}}\n\nNeed help? Contact {{supportEmail || "support@onetab.ai"}}.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'user.email', type: 'string', description: 'User email address', sampleValue: 'alex@example.com' },
        { name: 'appUrl', type: 'url', description: 'Main application URL', sampleValue: 'https://app.onetab.ai' },
      ],
      samplePayload: {
        user: { firstName: 'Alex', email: 'alex@example.com' },
        appUrl: 'https://app.onetab.ai',
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_EMAIL_VERIFICATION',
    name: 'Verify Email Address',
    category: 'AUTHENTICATION',
    description: 'Sent to confirm email ownership during signup or email update.',
    subject: 'Confirm your email address for {{appName || "OneTab AI"}}',
    previewText: 'Confirm your email address to complete your account setup.',
    htmlBody: `
      ${EmailHeading('Confirm your email address')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Please click the button below to verify your email address. This link is single-use and will expire in {{expiresInMinutes || "24"}} hours.')}
      ${EmailButton('Verify Email Address', '{{verifyUrl}}')}
      ${EmailText('Or paste this link into your browser:', 'muted')}
      ${EmailText('{{verifyUrl}}', 'muted')}
      ${EmailSecurityNotice('If you did not sign up for {{appName || "OneTab AI"}}, you can safely ignore this email.')}
    `,
    textBody: `Confirm your email address\n\nHi {{user.firstName || "there"}},\n\nPlease verify your email by opening this link:\n{{verifyUrl}}\n\nThis link expires in {{expiresInMinutes || "24"}} hours. If you did not sign up, please ignore this email.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'verifyUrl', type: 'url', description: 'Verification URL', sampleValue: 'https://app.onetab.ai/verify-email?token=xyz' },
        { name: 'expiresInMinutes', type: 'number', description: 'Expiration in minutes', sampleValue: 1440 },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        verifyUrl: 'https://app.onetab.ai/verify-email?token=xyz',
        expiresInMinutes: 1440,
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_OTP',
    name: 'One-Time Password (OTP)',
    category: 'AUTHENTICATION',
    description: 'Dispatches secure one-time passcode for authentication or verification.',
    subject: 'Your {{appName || "OneTab AI"}} verification code: {{otp.code}}',
    previewText: 'Your verification code is {{otp.code}}. Valid for {{otp.expiresIn || "10 minutes"}}.',
    htmlBody: `
      ${EmailHeading('Your Verification Code')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Use the following single-use passcode to complete your sign-in or verification:')}
      ${EmailCode('{{otp.code}}', 'Expires in {{otp.expiresIn || "10 minutes"}}')}
      ${EmailAlert('Do not share this code with anyone. Platform staff will never ask for your code.', 'warning')}
      ${EmailSecurityNotice('If you did not request this verification code, someone may be attempting to access your account. Please check your account security.')}
    `,
    textBody: `Your Verification Code\n\nHi {{user.firstName || "there"}},\n\nYour one-time verification code is: {{otp.code}}\nThis code expires in {{otp.expiresIn || "10 minutes"}}.\n\nNever share this code with anyone. If you did not request this, please secure your account.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'otp.code', type: 'string', description: '6-digit OTP code', sampleValue: '849201' },
        { name: 'otp.expiresIn', type: 'string', description: 'Human readable expiration', sampleValue: '10 minutes' },
        { name: 'security.loginUrl', type: 'url', description: 'Login URL', sampleValue: 'https://app.onetab.ai/login' },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        otp: { code: '849201', expiresIn: '10 minutes' },
        security: { loginUrl: 'https://app.onetab.ai/login' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_RESEND_OTP',
    name: 'Resend One-Time Password',
    category: 'AUTHENTICATION',
    description: 'Dispatched when a user requests a fresh OTP code.',
    subject: 'New verification code: {{otp.code}}',
    previewText: 'Your new verification code is {{otp.code}}.',
    htmlBody: `
      ${EmailHeading('New Verification Code')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('As requested, here is your new single-use verification code:')}
      ${EmailCode('{{otp.code}}', 'Expires in {{otp.expiresIn || "10 minutes"}}')}
      ${EmailAlert('Your previous code has been invalidated.', 'info')}
      ${EmailSecurityNotice('If you did not request a new code, please secure your account immediately.')}
    `,
    textBody: `New Verification Code\n\nHi {{user.firstName || "there"}},\n\nYour new one-time code is: {{otp.code}}\nValid for {{otp.expiresIn || "10 minutes"}}.\n\nPrevious codes have expired.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'otp.code', type: 'string', description: '6-digit OTP code', sampleValue: '519342' },
        { name: 'otp.expiresIn', type: 'string', description: 'Expiration', sampleValue: '10 minutes' },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        otp: { code: '519342', expiresIn: '10 minutes' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_MAGIC_LINK',
    name: 'Magic Login Link',
    category: 'AUTHENTICATION',
    description: 'Passwordless sign-in link emailed to the user.',
    subject: 'Your sign-in link for {{appName || "OneTab AI"}}',
    previewText: 'Click to sign in instantly without a password.',
    htmlBody: `
      ${EmailHeading('Sign in to {{appName || "OneTab AI"}}')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Click the button below to sign in directly to your account. This single-use link is valid for {{expiresInMinutes || "15"}} minutes.')}
      ${EmailButton('Sign In to Account', '{{magicLinkUrl}}')}
      ${EmailText('Or copy and paste this URL into your browser:', 'muted')}
      ${EmailText('{{magicLinkUrl}}', 'muted')}
      ${EmailSecurityNotice('For security, this link can only be used once. If you did not request this link, you can safely ignore it.')}
    `,
    textBody: `Sign in to {{appName || "OneTab AI"}}\n\nHi {{user.firstName || "there"}},\n\nUse this link to sign in:\n{{magicLinkUrl}}\n\nValid for {{expiresInMinutes || "15"}} minutes. Single use only.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'magicLinkUrl', type: 'url', description: 'Magic login link URL', sampleValue: 'https://app.onetab.ai/magic-sign-in?token=abc' },
        { name: 'expiresInMinutes', type: 'number', description: 'TTL minutes', sampleValue: 15 },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        magicLinkUrl: 'https://app.onetab.ai/magic-sign-in?token=abc',
        expiresInMinutes: 15,
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_PASSWORD_RESET',
    name: 'Password Reset Request',
    category: 'AUTHENTICATION',
    description: 'Sent when a user requests to reset their forgotten password.',
    subject: 'Reset your {{appName || "OneTab AI"}} password',
    previewText: 'Follow the link to reset your password. Valid for {{expiresInMinutes || "60"}} minutes.',
    htmlBody: `
      ${EmailHeading('Reset your password')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('We received a request to reset the password for your account. Click the button below to choose a new password:')}
      ${EmailButton('Reset Password', '{{resetUrl}}')}
      ${EmailText('This link will expire in {{expiresInMinutes || "60"}} minutes and can only be used once.', 'muted')}
      ${EmailSecurityNotice('If you did not request a password reset, no action is needed. Your existing password remains secure.')}
    `,
    textBody: `Reset your password\n\nHi {{user.firstName || "there"}},\n\nTo reset your password, visit:\n{{resetUrl}}\n\nThis link expires in {{expiresInMinutes || "60"}} minutes.\n\nIf you did not request this, you can ignore this email.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'resetUrl', type: 'url', description: 'Password reset URL', sampleValue: 'https://app.onetab.ai/reset-password?token=xyz' },
        { name: 'expiresInMinutes', type: 'number', description: 'Expiration in minutes', sampleValue: 60 },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        resetUrl: 'https://app.onetab.ai/reset-password?token=xyz',
        expiresInMinutes: 60,
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_PASSWORD_RESET_CONFIRMATION',
    name: 'Password Reset Confirmation',
    category: 'AUTHENTICATION',
    description: 'Sent to confirm that a password has been successfully reset.',
    subject: 'Your password was successfully reset',
    previewText: 'Your account password has been updated.',
    htmlBody: `
      ${EmailHeading('Password Reset Successful')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailAlert('Your account password was successfully reset. You can now sign in with your new password.', 'success')}
      ${EmailButton('Sign In', '{{loginUrl || "http://localhost:4200/login"}}')}
      ${EmailSecurityNotice('If you did not perform this password change, your account may be compromised. Please contact support immediately.')}
    `,
    textBody: `Password Reset Successful\n\nHi {{user.firstName || "there"}},\n\nYour account password was successfully reset. Sign in at: {{loginUrl || "http://localhost:4200/login"}}.\n\nIf you did not perform this reset, contact support immediately.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'loginUrl', type: 'url', description: 'Login URL', sampleValue: 'https://app.onetab.ai/login' },
      ],
      samplePayload: { user: { firstName: 'Alex' }, loginUrl: 'https://app.onetab.ai/login' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_PASSWORD_CHANGED',
    name: 'Password Changed Alert',
    category: 'AUTHENTICATION',
    description: 'Alert sent whenever the account password is changed.',
    subject: 'Security Alert: Your password was changed',
    previewText: 'Your account password was updated recently.',
    htmlBody: `
      ${EmailHeading('Your password has been changed')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('This is a confirmation that the password for your {{appName || "OneTab AI"}} account was changed on {{formatDate timestamp}} at {{time || "just now"}}.')}
      ${EmailSecurityNotice('If you changed your password, no further action is needed. If you did NOT change your password, please reset your password immediately.')}
      ${EmailButton('Secure My Account', '{{securityUrl || "http://localhost:4200/settings/security"}}')}
    `,
    textBody: `Security Alert: Your password has been changed\n\nHi {{user.firstName || "there"}},\n\nYour password was changed on {{formatDate timestamp}}.\n\nIf you did not do this, please secure your account immediately:\n{{securityUrl || "http://localhost:4200/settings/security"}}`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'timestamp', type: 'date', description: 'Change timestamp', sampleValue: '2026-10-07T12:00:00Z' },
        { name: 'securityUrl', type: 'url', description: 'Security settings URL', sampleValue: 'https://app.onetab.ai/settings/security' },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        timestamp: '2026-10-07T12:00:00Z',
        securityUrl: 'https://app.onetab.ai/settings/security',
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_NEW_DEVICE_LOGIN',
    name: 'Login from New Device',
    category: 'AUTHENTICATION',
    description: 'Alert sent when a sign-in is detected from an unrecognized browser or device.',
    subject: 'New sign-in detected on your {{appName || "OneTab AI"}} account',
    previewText: 'A login from a new device was detected: {{device.name || "Unknown device"}}.',
    htmlBody: `
      ${EmailHeading('New sign-in detected')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('We noticed a sign-in to your account from a new device or location:')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px;">
        <div><strong>Device:</strong> {{device.name || "Browser / Web App"}}</div>
        <div><strong>IP Address:</strong> {{device.ip || "Unknown"}}</div>
        <div><strong>Location:</strong> {{device.location || "Unknown location"}}</div>
        <div><strong>Time:</strong> {{formatDate timestamp}} {{time}}</div>
      </div>
      ${EmailSecurityNotice('If this was you, you can ignore this alert. If you do not recognize this activity, change your password and revoke active sessions.')}
      ${EmailButton('Review Active Sessions', '{{securityUrl || "http://localhost:4200/settings/security"}}')}
    `,
    textBody: `New sign-in detected\n\nDevice: {{device.name || "Web App"}}\nIP: {{device.ip || "Unknown"}}\nLocation: {{device.location || "Unknown"}}\nTime: {{formatDate timestamp}}\n\nIf this was not you, review active sessions immediately:\n{{securityUrl || "http://localhost:4200/settings/security"}}`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'device.name', type: 'string', description: 'Device description', sampleValue: 'Chrome on macOS' },
        { name: 'device.ip', type: 'string', description: 'IP address', sampleValue: '198.51.100.42' },
        { name: 'device.location', type: 'string', description: 'City/Country', sampleValue: 'San Francisco, CA, USA' },
        { name: 'timestamp', type: 'date', description: 'Login timestamp', sampleValue: '2026-10-07T12:00:00Z' },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        device: { name: 'Chrome on macOS', ip: '198.51.100.42', location: 'San Francisco, CA, USA' },
        timestamp: '2026-10-07T12:00:00Z',
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_SUSPICIOUS_LOGIN',
    name: 'Suspicious Login Attempt',
    category: 'AUTHENTICATION',
    description: 'High-priority alert triggered when a login attempt matches risk flags.',
    subject: 'URGENT: Suspicious activity detected on your account',
    previewText: 'We blocked or detected unusual access to your account.',
    htmlBody: `
      ${EmailHeading('Suspicious login attempt detected')}
      ${EmailAlert('Our automated security systems flagged an unusual sign-in attempt to your account.', 'danger')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('We detected sign-in activity that differs significantly from your usual location or device habits:')}
      <div style="margin: 16px 0; padding: 14px 18px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; font-size: 13px; color: #991b1b;">
        <div><strong>IP:</strong> {{suspicious.ip || "Unknown"}}</div>
        <div><strong>Location:</strong> {{suspicious.location || "Unknown"}}</div>
        <div><strong>Risk Reason:</strong> {{suspicious.reason || "Unrecognized network"}}</div>
      </div>
      ${EmailButton('Secure Account Now', '{{securityUrl || "http://localhost:4200/settings/security"}}', { color: '#dc2626' })}
      ${EmailSecurityNotice('If you did not initiate this login, reset your password immediately and review connected devices.')}
    `,
    textBody: `URGENT: Suspicious activity detected\n\nIP: {{suspicious.ip}}\nLocation: {{suspicious.location}}\nReason: {{suspicious.reason}}\n\nSecure your account immediately:\n{{securityUrl || "http://localhost:4200/settings/security"}}`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'suspicious.ip', type: 'string', description: 'IP address', sampleValue: '203.0.113.195' },
        { name: 'suspicious.location', type: 'string', description: 'Location', sampleValue: 'Moscow, Russia' },
        { name: 'suspicious.reason', type: 'string', description: 'Risk score or reason', sampleValue: 'Impossible travel velocity' },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        suspicious: { ip: '203.0.113.195', location: 'Moscow, Russia', reason: 'Impossible travel velocity' },
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_2FA_ENABLED',
    name: 'Two-Factor Authentication Enabled',
    category: 'AUTHENTICATION',
    description: 'Confirmation email sent when 2FA is activated.',
    subject: 'Two-factor authentication has been enabled',
    previewText: 'Your account is now protected by two-factor authentication.',
    htmlBody: `
      ${EmailHeading('Two-factor authentication enabled')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailAlert('Two-factor authentication (2FA) is now active for your account. You will be prompted for an authenticator code or backup key whenever you sign in.', 'success')}
      ${EmailText('Make sure you have saved your emergency backup codes in a secure location in case you lose access to your primary authenticator device.')}
      ${EmailSecurityNotice('If you did not enable 2FA on your account, please contact administrator support immediately.')}
    `,
    textBody: `Two-factor authentication enabled\n\nHi {{user.firstName || "there"}},\n\n2FA is now active for your account. Store your backup codes safely.\nIf you did not enable this, contact support immediately.`,
    variablesSchema: {
      variables: [{ name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' }],
      samplePayload: { user: { firstName: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_2FA_DISABLED',
    name: 'Two-Factor Authentication Disabled',
    category: 'AUTHENTICATION',
    description: 'Security alert sent when 2FA is turned off.',
    subject: 'Warning: Two-factor authentication was disabled',
    previewText: '2FA protection has been removed from your account.',
    htmlBody: `
      ${EmailHeading('Two-factor authentication was turned off')}
      ${EmailAlert('Two-factor authentication has been disabled on your account. Your account is now protected by password or magic link only.', 'warning')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('If you disabled 2FA intentionally, you can re-enable it anytime from your Account Security settings.')}
      ${EmailSecurityNotice('If you did NOT disable two-factor authentication, your account may have been accessed by an unauthorized party. Change your password immediately.')}
      ${EmailButton('Re-Enable 2FA', '{{securityUrl || "http://localhost:4200/settings/security"}}')}
    `,
    textBody: `Warning: Two-factor authentication disabled\n\nHi {{user.firstName || "there"}},\n\n2FA was disabled on your account. If you did not do this, change your password immediately:\n{{securityUrl || "http://localhost:4200/settings/security"}}`,
    variablesSchema: {
      variables: [{ name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' }],
      samplePayload: { user: { firstName: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_ACCOUNT_LOCKED',
    name: 'Account Locked Due to Failed Attempts',
    category: 'AUTHENTICATION',
    description: 'Sent when an account is temporarily locked after consecutive failed attempts.',
    subject: 'Your account has been temporarily locked',
    previewText: 'Too many consecutive failed sign-in attempts detected.',
    htmlBody: `
      ${EmailHeading('Account temporarily locked')}
      ${EmailAlert('Your account has been locked for {{lockDuration || "30 minutes"}} after {{failedAttempts || "5"}} consecutive failed sign-in attempts.', 'danger')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('To protect your data against unauthorized brute-force attempts, access has been restricted. You can unlock your account by resetting your password below:')}
      ${EmailButton('Unlock & Reset Password', '{{unlockUrl}}')}
      ${EmailSecurityNotice('If you did not attempt to sign in recently, someone else may be trying to guess your credentials.')}
    `,
    textBody: `Account temporarily locked\n\nHi {{user.firstName || "there"}},\n\nYour account is locked for {{lockDuration || "30 minutes"}} after multiple failed sign-in attempts.\n\nUnlock your account:\n{{unlockUrl}}`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'lockDuration', type: 'string', description: 'Lock duration', sampleValue: '30 minutes' },
        { name: 'failedAttempts', type: 'number', description: 'Failed attempt count', sampleValue: 5 },
        { name: 'unlockUrl', type: 'url', description: 'Unlock URL', sampleValue: 'https://app.onetab.ai/unlock?token=xyz' },
      ],
      samplePayload: {
        user: { firstName: 'Alex' },
        lockDuration: '30 minutes',
        failedAttempts: 5,
        unlockUrl: 'https://app.onetab.ai/unlock?token=xyz',
      },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_ACCOUNT_UNLOCKED',
    name: 'Account Unlocked',
    category: 'AUTHENTICATION',
    description: 'Confirmation email sent when account lock is lifted.',
    subject: 'Your account has been unlocked',
    previewText: 'You can now sign in to your account again.',
    htmlBody: `
      ${EmailHeading('Your account is now unlocked')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailAlert('The temporary security lock on your account has been lifted. You can now sign in normally.', 'success')}
      ${EmailButton('Sign In to Account', '{{loginUrl || "http://localhost:4200/login"}}')}
    `,
    textBody: `Your account is now unlocked\n\nHi {{user.firstName || "there"}},\n\nThe security lock has expired. Sign in at:\n{{loginUrl || "http://localhost:4200/login"}}`,
    variablesSchema: {
      variables: [{ name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' }],
      samplePayload: { user: { firstName: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_EMAIL_CHANGED',
    name: 'Email Address Changed Notification',
    category: 'AUTHENTICATION',
    description: 'Sent to the previous email address when the user changes their primary email.',
    subject: 'Your account email address was changed',
    previewText: 'Your account email was updated to {{newEmail}}.',
    htmlBody: `
      ${EmailHeading('Email address updated')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('The primary email address associated with your account was changed from this address to:')}
      <div style="margin: 16px 0; font-family: monospace; font-size: 15px; font-weight: 600; color: #0f172a;">
        {{newEmail}}
      </div>
      ${EmailSecurityNotice('If you made this change, no action is needed. If you did NOT change your email address, someone has taken over your account. Contact security immediately at {{supportEmail || "security@onetab.ai"}}.')}
    `,
    textBody: `Email address updated\n\nHi {{user.firstName || "there"}},\n\nYour account email was updated to {{newEmail}}.\n\nIf you did NOT make this change, contact security immediately: {{supportEmail || "security@onetab.ai"}}.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'newEmail', type: 'string', description: 'New email address', sampleValue: 'alex.new@example.com' },
      ],
      samplePayload: { user: { firstName: 'Alex' }, newEmail: 'alex.new@example.com' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_PHONE_CHANGED',
    name: 'Phone Number Changed Notification',
    category: 'AUTHENTICATION',
    description: 'Sent when the phone number on file is modified.',
    subject: 'Your verified phone number was updated',
    previewText: 'The phone number on your account was modified.',
    htmlBody: `
      ${EmailHeading('Phone number updated')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('The phone number on your {{appName || "OneTab AI"}} account was updated recently.')}
      ${EmailSecurityNotice('If you did not authorize this change, please review your account security settings immediately.')}
    `,
    textBody: `Phone number updated\n\nHi {{user.firstName || "there"}},\n\nThe phone number on your account was updated. If you did not authorize this, review your account security immediately.`,
    variablesSchema: {
      variables: [{ name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' }],
      samplePayload: { user: { firstName: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_ACCOUNT_RECOVERY',
    name: 'Account Recovery Request',
    category: 'AUTHENTICATION',
    description: 'Sent when a user initiates emergency account recovery.',
    subject: 'Account recovery instructions for {{appName || "OneTab AI"}}',
    previewText: 'Use this emergency recovery link to regain access to your account.',
    htmlBody: `
      ${EmailHeading('Account Recovery Request')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('An account recovery session was initiated. Click the button below to verify your identity and restore access:')}
      ${EmailButton('Recover My Account', '{{recoveryUrl}}')}
      ${EmailText('This link is valid for {{expiresInHours || "24"}} hours.', 'muted')}
      ${EmailSecurityNotice('If you did not initiate this recovery request, please ignore this email or contact platform support.')}
    `,
    textBody: `Account Recovery Request\n\nHi {{user.firstName || "there"}},\n\nUse this link to recover your account:\n{{recoveryUrl}}\n\nValid for {{expiresInHours || "24"}} hours.`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'recoveryUrl', type: 'url', description: 'Recovery link', sampleValue: 'https://app.onetab.ai/recovery?token=xyz' },
      ],
      samplePayload: { user: { firstName: 'Alex' }, recoveryUrl: 'https://app.onetab.ai/recovery?token=xyz' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_ACCOUNT_DELETION_REQUESTED',
    name: 'Account Deletion Requested',
    category: 'AUTHENTICATION',
    description: 'Sent when a user requests permanent account deletion, detailing the grace period.',
    subject: 'Important: Account deletion requested for {{appName || "OneTab AI"}}',
    previewText: 'Your account is scheduled for deletion on {{deletionDate}}.',
    htmlBody: `
      ${EmailHeading('Account deletion requested')}
      ${EmailAlert('A request was received to permanently delete your account and all associated personal data.', 'warning')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('Your account will be permanently deleted on {{formatDate deletionDate}}. Until that time, you can cancel this request at any time by signing in to your account.')}
      ${EmailButton('Cancel Deletion & Keep Account', '{{cancelUrl || "http://localhost:4200/cancel-deletion"}}')}
    `,
    textBody: `Account deletion requested\n\nHi {{user.firstName || "there"}},\n\nYour account is scheduled for deletion on {{formatDate deletionDate}}.\n\nCancel deletion:\n{{cancelUrl || "http://localhost:4200/cancel-deletion"}}`,
    variablesSchema: {
      variables: [
        { name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' },
        { name: 'deletionDate', type: 'date', description: 'Scheduled deletion date', sampleValue: '2026-11-07T00:00:00Z' },
      ],
      samplePayload: { user: { firstName: 'Alex' }, deletionDate: '2026-11-07T00:00:00Z' },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
  {
    templateKey: 'AUTH_ACCOUNT_DELETION_COMPLETED',
    name: 'Account Deletion Completed',
    category: 'AUTHENTICATION',
    description: 'Confirmation email sent when an account and its data have been purged.',
    subject: 'Your account has been deleted',
    previewText: 'Your account and data have been removed from {{appName || "OneTab AI"}}.',
    htmlBody: `
      ${EmailHeading('Account deletion completed')}
      ${EmailText('Hi {{user.firstName || "there"}},')}
      ${EmailText('This confirms that your account and associated personal information have been permanently removed from our systems in accordance with our Privacy Policy.')}
      ${EmailText('We are sorry to see you go. If you ever wish to return in the future, you are welcome to sign up for a new account at any time.')}
    `,
    textBody: `Account deletion completed\n\nHi {{user.firstName || "there"}},\n\nYour account has been permanently removed. Thank you for having been with us.`,
    variablesSchema: {
      variables: [{ name: 'user.firstName', type: 'string', description: 'User first name', sampleValue: 'Alex' }],
      samplePayload: { user: { firstName: 'Alex' } },
    },
    status: 'ACTIVE',
    version: 1,
    isSystemTemplate: true,
    isDefault: true,
  },
];

export { MatrixModule } from './lib/matrix.module.js';
export { MatrixAdminService } from './lib/matrix-admin.service.js';
export { MatrixAuthService } from './lib/matrix-auth.service.js';
export {
  MatrixSyncService,
  type AppserviceTransaction,
  type MatrixTimelineEvent,
} from './lib/matrix-sync.service.js';
export { NotificationBridgeService } from './lib/notification-bridge.service.js';
export {
  matrixEnvSchema,
  readMatrixConfig,
  toMatrixLocalpart,
  toMatrixUserId,
  type MatrixConfig,
  type MatrixEnv,
} from './lib/matrix.config.js';

export enum Permission {
  // User management
  UserRead = 'user.read',
  UserWrite = 'user.write',
  UserBlock = 'user.block',

  // Role management
  RoleRead = 'role.read',
  RoleWrite = 'role.write',

  // Product management
  ProductRead = 'product.read',
  ProductWrite = 'product.write',

  // Order management
  OrderRead = 'order.read',
  OrderWrite = 'order.write',

  // Dashboard / Reports
  DashboardView = 'dashboard.view',

  // Settings
  SettingsRead = 'settings.read',
  SettingsWrite = 'settings.write',

  // Design
  DesignWrite = 'design.write',
}

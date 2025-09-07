
export type AppRole =
  | "factory_manager"    // מנהל מפעל
  | "production_manager" // מנהל יצור
  | "secretary"          // מזכירה
  | "driver";            // נהג

export const RolePermissions = {
  factory_manager: {
    viewReceipts: true,
    editReceipts: true,
    viewProduction: true,
    editProduction: true,
    viewOrders: true,
    editOrders: true,
    viewLoadingPlan: true,
    editLoadingPlan: true,
    viewReports: true,
    editUsers: true,
  },
  production_manager: {
    viewReceipts: true,
    editReceipts: true,
    viewProduction: true,
    editProduction: true,
    viewOrders: true,
    editOrders: true,
    viewLoadingPlan: true,
    editLoadingPlan: true,
    viewReports: false,
    editUsers: false,
  },
  secretary: {
    viewReceipts: true,
    editReceipts: true,
    viewProduction: true,
    editProduction: false,
    viewOrders: true,
    editOrders: true,
    viewLoadingPlan: true,
    editLoadingPlan: false,
    viewReports: false,
    editUsers: false,
  },
  driver: {
    viewReceipts: false,
    editReceipts: false,
    viewProduction: false,
    editProduction: false,
    viewOrders: true,
    editOrders: false,
    viewLoadingPlan: true,
    editLoadingPlan: true,
    viewReports: false,
    editUsers: false,
  },
} as const;
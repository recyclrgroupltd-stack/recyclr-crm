export type PermissionMode = "default" | "allow" | "deny";
export type PermissionMap = Record<string, boolean>;

export type PermissionOverride = {
  permission_key: string;
  is_allowed: boolean;
};

export type StoredUser = {
  id: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_active?: boolean;
  role?:
    | "admin"
    | "manager"
    | "sales"
    | "operations"
    | "driver"
    | "finance"
    | "staff"
    | "admin_1"
    | "admin_2"
    | "ops";
  permissions?: {
    can_edit_leads?: boolean;
    can_edit_customers?: boolean;
    can_edit_sites?: boolean;
    can_edit_services?: boolean;
    can_edit_pricing?: boolean;
    can_manage_users?: boolean;
    can_edit_hauliers?: boolean;
    can_view_expenses?: boolean;
    can_approve_expenses?: boolean;
    permission_map?: PermissionMap;
  };
  overrides?: PermissionOverride[];
  profile?: {
    company_email?: string;
    company_phone?: string;
    job_title?: string;
    auto_assign_customers?: boolean;
    mailbox_enabled?: boolean;
    mailbox_password?: string;
    mailbox_has_password?: boolean;
    about_me?: string;
    photo_data?: string;
    updated_at?: string | null;
  };
};

export const PERMISSION_REGISTRY: Record<string, { label: string; category: string }> = {
  "dashboard.view": { label: "View Dashboard", category: "Core" },
  "email.use": { label: "Use CRM Email", category: "Core" },
  "calendar.view": { label: "View Calendars", category: "Core" },
  "calendar.edit": { label: "Edit Own Calendar", category: "Core" },
  "leads.view": { label: "View Leads", category: "Sales" },
  "leads.edit": { label: "Edit Leads", category: "Sales" },
  "quotes.view": { label: "View Quotes", category: "Sales" },
  "quotes.edit": { label: "Edit Quotes", category: "Sales" },
  "customers.view": { label: "View Customers", category: "Customers" },
  "customers.edit": { label: "Edit Customers", category: "Customers" },
  "sites.view": { label: "View Sites", category: "Customers" },
  "sites.edit": { label: "Edit Sites", category: "Customers" },
  "services.view": { label: "View Services", category: "Customers" },
  "services.edit": { label: "Edit Services", category: "Customers" },
  "jobs.view": { label: "View Jobs", category: "Operations" },
  "jobs.edit": { label: "Update Jobs", category: "Operations" },
  "containers.view": { label: "View Containers", category: "Operations" },
  "containers.edit": { label: "Manage Containers", category: "Operations" },
  "pricing.view": { label: "View Pricebook", category: "Finance" },
  "pricing.edit": { label: "Manage Pricebook", category: "Finance" },
  "purchase_orders.view": { label: "View Purchase Orders", category: "Finance" },
  "purchase_orders.edit": { label: "Create Purchase Orders", category: "Finance" },
  "purchase_orders.approve": { label: "Approve Purchase Orders", category: "Finance" },
  "expenses.view": { label: "Submit/View Expenses", category: "Finance" },
  "expenses.approve": { label: "Approve Expenses", category: "Finance" },
  "hauliers.view": { label: "View Hauliers", category: "Suppliers" },
  "hauliers.edit": { label: "Manage Hauliers", category: "Suppliers" },
  "reporting.view": { label: "View Reporting", category: "Reporting" },
  "staff.view": { label: "View Staff", category: "Team" },
  "staff.manage": { label: "Manage Staff Roles", category: "Team" },
  "company_settings.manage": { label: "Manage Company Settings", category: "Admin" },
};

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem("recyclrUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem("recyclrUser", JSON.stringify(user));
}

export function getAuthHeaders(extraHeaders?: Record<string, string>) {
  const user = getStoredUser();
  const fallbackUsername =
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("staff_username") || localStorage.getItem("username") || "";
  const username = user?.username || fallbackUsername;
  const sessionToken =
    typeof window === "undefined" ? "" : localStorage.getItem("staff_token") || "";

  if (!username) {
    return extraHeaders || {};
  }

  return {
    "X-Staff-Username": username,
    ...(sessionToken ? { "X-Staff-Session-Token": sessionToken } : {}),
    ...(extraHeaders || {}),
  };
}

export function hasPermission(user: StoredUser | null, key: string) {
  const explicit = user?.permissions?.permission_map?.[key];
  if (typeof explicit === "boolean") return explicit;

  if (key === "expenses.view") return Boolean(user);
  if (key === "expenses.approve") {
    return ["admin", "manager", "finance", "admin_1", "admin_2"].includes(user?.role || "");
  }

  return false;
}

export function getOverrideMode(user: StoredUser | null, key: string): PermissionMode {
  const override = user?.overrides?.find((item) => item.permission_key === key);
  if (!override) return "default";
  return override.is_allowed ? "allow" : "deny";
}

export function canEditLeads(user: StoredUser | null) {
  return hasPermission(user, "leads.edit");
}

export function canViewLeads(user: StoredUser | null) {
  return hasPermission(user, "leads.view");
}

export function canEditCustomers(user: StoredUser | null) {
  return hasPermission(user, "customers.edit");
}

export function canViewCustomers(user: StoredUser | null) {
  return hasPermission(user, "customers.view");
}

export function canEditSites(user: StoredUser | null) {
  return hasPermission(user, "sites.edit");
}

export function canViewSites(user: StoredUser | null) {
  return hasPermission(user, "sites.view");
}

export function canEditServices(user: StoredUser | null) {
  return hasPermission(user, "services.edit");
}

export function canViewServices(user: StoredUser | null) {
  return hasPermission(user, "services.view");
}

export function canEditPricing(user: StoredUser | null) {
  return hasPermission(user, "pricing.edit");
}

export function canManageUsers(user: StoredUser | null) {
  return hasPermission(user, "staff.manage");
}

export function canViewStaff(user: StoredUser | null) {
  return hasPermission(user, "staff.view");
}

export function canEditHauliers(user: StoredUser | null) {
  return hasPermission(user, "hauliers.edit");
}

export function canViewPricing(user: StoredUser | null) {
  return hasPermission(user, "pricing.view");
}

export function canViewHauliers(user: StoredUser | null) {
  return hasPermission(user, "hauliers.view");
}

export function canViewQuotes(user: StoredUser | null) {
  return hasPermission(user, "quotes.view");
}

export function canEditQuotes(user: StoredUser | null) {
  return hasPermission(user, "quotes.edit");
}

export function canViewDashboard(user: StoredUser | null) {
  return hasPermission(user, "dashboard.view");
}

export function canViewReporting(user: StoredUser | null) {
  return hasPermission(user, "reporting.view");
}

export function canViewPurchaseOrders(user: StoredUser | null) {
  return hasPermission(user, "purchase_orders.view");
}

export function canEditPurchaseOrders(user: StoredUser | null) {
  return hasPermission(user, "purchase_orders.edit");
}

export function canApprovePurchaseOrders(user: StoredUser | null) {
  return hasPermission(user, "purchase_orders.approve");
}

export function canViewExpenses(user: StoredUser | null) {
  return hasPermission(user, "expenses.view");
}

export function canApproveExpenses(user: StoredUser | null) {
  return hasPermission(user, "expenses.approve");
}

export function roleLabel(user: StoredUser | null) {
  if (!user) return "Staff";

  switch (user.role) {
    case "admin":
    case "admin_1":
      return "Admin";
    case "manager":
    case "admin_2":
      return "Manager";
    case "sales":
      return "Sales";
    case "operations":
    case "ops":
      return "Operations";
    case "driver":
      return "Driver";
    case "finance":
      return "Finance";
    default:
      return "Staff";
  }
}

export function getPermissionGroups() {
  const grouped: Record<string, Array<{ key: string; label: string }>> = {};

  for (const [key, config] of Object.entries(PERMISSION_REGISTRY)) {
    if (!grouped[config.category]) {
      grouped[config.category] = [];
    }

    grouped[config.category].push({
      key,
      label: config.label,
    });
  }

  return grouped;
}

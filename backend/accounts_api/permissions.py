PERMISSION_REGISTRY = {
    "dashboard.view": {"label": "View Dashboard", "category": "Core"},
    "email.use": {"label": "Use CRM Email", "category": "Core"},
    "calendar.view": {"label": "View Calendars", "category": "Core"},
    "calendar.edit": {"label": "Edit Own Calendar", "category": "Core"},
    "ai.view": {"label": "View AI Assistant", "category": "Core"},
    "ai.use": {"label": "Use AI Assistant", "category": "Core"},
    "leads.view": {"label": "View Leads", "category": "Sales"},
    "leads.edit": {"label": "Edit Leads", "category": "Sales"},
    "quotes.view": {"label": "View Quotes", "category": "Sales"},
    "quotes.edit": {"label": "Edit Quotes", "category": "Sales"},
    "customers.view": {"label": "View Customers", "category": "Customers"},
    "customers.edit": {"label": "Edit Customers", "category": "Customers"},
    "sites.view": {"label": "View Sites", "category": "Customers"},
    "sites.edit": {"label": "Edit Sites", "category": "Customers"},
    "services.view": {"label": "View Services", "category": "Customers"},
    "services.edit": {"label": "Edit Services", "category": "Customers"},
    "jobs.view": {"label": "View Jobs", "category": "Operations"},
    "jobs.edit": {"label": "Update Jobs", "category": "Operations"},
    "containers.view": {"label": "View Containers", "category": "Operations"},
    "containers.edit": {"label": "Manage Containers", "category": "Operations"},
    "pricing.view": {"label": "View Pricebook", "category": "Finance"},
    "pricing.edit": {"label": "Manage Pricebook", "category": "Finance"},
    "purchase_orders.view": {"label": "View Purchase Orders", "category": "Finance"},
    "purchase_orders.edit": {"label": "Create Purchase Orders", "category": "Finance"},
    "purchase_orders.approve": {"label": "Approve Purchase Orders", "category": "Finance"},
    "expenses.view": {"label": "Submit/View Expenses", "category": "Finance"},
    "expenses.approve": {"label": "Approve Expenses", "category": "Finance"},
    "hauliers.view": {"label": "View Hauliers", "category": "Suppliers"},
    "hauliers.edit": {"label": "Manage Hauliers", "category": "Suppliers"},
    "reporting.view": {"label": "View Reporting", "category": "Reporting"},
    "staff.view": {"label": "View Staff", "category": "Team"},
    "staff.manage": {"label": "Manage Staff Roles", "category": "Team"},
    "company_settings.manage": {"label": "Manage Company Settings", "category": "Admin"},
}

ROLE_ALIASES = {
    "admin_1": "admin",
    "admin_2": "manager",
    "ops": "operations",
}


def normalise_role(role: str) -> str:
    return ROLE_ALIASES.get((role or "").strip(), (role or "staff").strip()) or "staff"


def _permission_map(*allowed_keys: str) -> dict:
    allowed = set(allowed_keys)
    return {key: key in allowed for key in PERMISSION_REGISTRY.keys()}


ROLE_DEFAULT_PERMISSIONS = {
    "admin": {key: True for key in PERMISSION_REGISTRY.keys()},
    "manager": _permission_map(
        "dashboard.view",
        "email.use",
        "calendar.view",
        "calendar.edit",
        "ai.view",
        "ai.use",
        "leads.view",
        "leads.edit",
        "quotes.view",
        "quotes.edit",
        "customers.view",
        "customers.edit",
        "sites.view",
        "sites.edit",
        "services.view",
        "services.edit",
        "jobs.view",
        "jobs.edit",
        "containers.view",
        "containers.edit",
        "pricing.view",
        "pricing.edit",
        "purchase_orders.view",
        "purchase_orders.edit",
        "purchase_orders.approve",
        "expenses.view",
        "expenses.approve",
        "hauliers.view",
        "hauliers.edit",
        "reporting.view",
        "staff.view",
    ),
    "sales": _permission_map(
        "dashboard.view",
        "email.use",
        "calendar.view",
        "calendar.edit",
        "ai.view",
        "ai.use",
        "leads.view",
        "leads.edit",
        "quotes.view",
        "quotes.edit",
        "customers.view",
        "customers.edit",
        "sites.view",
        "services.view",
        "jobs.view",
        "expenses.view",
        "reporting.view",
        "staff.view",
    ),
    "operations": _permission_map(
        "dashboard.view",
        "email.use",
        "calendar.view",
        "calendar.edit",
        "ai.view",
        "ai.use",
        "quotes.view",
        "customers.view",
        "customers.edit",
        "sites.view",
        "sites.edit",
        "services.view",
        "services.edit",
        "jobs.view",
        "jobs.edit",
        "containers.view",
        "containers.edit",
        "purchase_orders.view",
        "purchase_orders.edit",
        "expenses.view",
        "hauliers.view",
        "hauliers.edit",
        "reporting.view",
        "staff.view",
    ),
    "driver": _permission_map(
        "dashboard.view",
        "email.use",
        "calendar.view",
        "calendar.edit",
        "ai.view",
        "jobs.view",
        "jobs.edit",
        "expenses.view",
        "staff.view",
    ),
    "finance": _permission_map(
        "dashboard.view",
        "email.use",
        "calendar.view",
        "ai.view",
        "quotes.view",
        "customers.view",
        "pricing.view",
        "pricing.edit",
        "purchase_orders.view",
        "purchase_orders.edit",
        "purchase_orders.approve",
        "expenses.view",
        "expenses.approve",
        "reporting.view",
        "staff.view",
    ),
    "staff": _permission_map(
        "dashboard.view",
        "email.use",
        "calendar.view",
        "calendar.edit",
        "ai.view",
        "expenses.view",
        "staff.view",
    ),
}


def build_permissions_for_role(role: str) -> dict:
    base = {key: False for key in PERMISSION_REGISTRY.keys()}
    role_defaults = ROLE_DEFAULT_PERMISSIONS.get(
        normalise_role(role), ROLE_DEFAULT_PERMISSIONS["staff"]
    )
    base.update(role_defaults)
    return base


def apply_overrides_to_permissions(permission_map: dict, overrides) -> dict:
    merged = dict(permission_map)
    for override in overrides:
        if override.permission_key in merged:
            merged[override.permission_key] = bool(override.is_allowed)
    return merged


def has_permission_map(permission_map: dict, permission_key: str) -> bool:
    return bool(permission_map.get(permission_key, False))


def permission_categories() -> dict:
    grouped = {}
    for key, config in PERMISSION_REGISTRY.items():
        category = config["category"]
        if category not in grouped:
            grouped[category] = []
        grouped[category].append(
            {
                "key": key,
                "label": config["label"],
            }
        )
    return grouped

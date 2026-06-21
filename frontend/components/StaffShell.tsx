"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canManageUsers,
  canViewCustomers,
  canViewDashboard,
  canViewHauliers,
  canViewLeads,
  canViewPricing,
  canViewPurchaseOrders,
  canViewQuotes,
  canViewReporting,
  canViewServices,
  canViewSites,
  canViewStaff,
  canViewExpenses,
  clearStaffSession,
  getAuthHeaders,
  getStoredUser,
  roleLabel,
} from "../lib/auth";

type StaffShellProps = {
  title: string;
  children: ReactNode;
};

type NavItem = {
  label: string;
  href: string;
  icon: string;
};

type NotificationItem = {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  purchase_order_id: number | null;
  purchase_order_number: string;
  target_url?: string;
  source_type?: string;
  source_id?: number | null;
};

type ChatUser = {
  id: number;
  username: string;
  name: string;
  email: string;
  initials: string;
};

type StaffSearchUser = {
  id: number;
  username?: string;
  role?: string;
  profile?: {
    job_title?: string;
    company_email?: string;
    company_phone?: string;
  };
};

type GlobalSearchCustomer = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  town?: string;
  county?: string;
  postcode?: string;
  sites?: Array<{
    site_name?: string;
    address_line_1?: string;
    address_line_2?: string;
    town?: string;
    county?: string;
    postcode?: string;
  }>;
};

type ChatCustomer = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  postcode?: string;
};

type ChatMessage = {
  id: number;
  body: string;
  sender_id: number | null;
  sender: ChatUser | null;
  mention_ids: number[];
  created_at: string;
};

type ChatConversation = {
  id: number;
  title: string;
  custom_title: string;
  is_group: boolean;
  is_everyone: boolean;
  is_pinned: boolean;
  participants: ChatUser[];
  last_message: ChatMessage | null;
  unread_count: number;
  is_muted: boolean;
  muted_until: string;
  messages?: ChatMessage[];
  updated_at: string;
};

const coreItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "D" },
  { label: "CRM Map", href: "/core-map", icon: "M" },
  { label: "Change Log", href: "/change-log", icon: "A" },
];

const salesItems: NavItem[] = [
  { label: "Leads", href: "/leads", icon: "L" },
  { label: "Quotes", href: "/quotes", icon: "Q" },
  { label: "Contract Signing", href: "/contract-signing", icon: "S" },
];

const customerItems: NavItem[] = [
  { label: "Customers", href: "/customers", icon: "C" },
  { label: "My Customers", href: "/my-customers", icon: "M" },
  { label: "Sites", href: "/sites", icon: "S" },
  { label: "Services", href: "/services", icon: "*" },
];

const operationsItems: NavItem[] = [
  { label: "Jobs", href: "/jobs", icon: "J" },
];

const supplierItems: NavItem[] = [
  { label: "Haulier Pricing", href: "/haulier-pricing", icon: "H" },
];

const financeItems: NavItem[] = [
  { label: "Pricing", href: "/pricing", icon: "$" },
  { label: "Expenses", href: "/expenses", icon: "E" },
  { label: "Purchase Orders", href: "/purchase-orders", icon: "P" },
  { label: "Reporting", href: "/reporting", icon: "R" },
];

const teamItems: NavItem[] = [
  { label: "Staff", href: "/staff", icon: "U" },
];

const settingsItems: NavItem[] = [
  { label: "Company Details", href: "/settings/company-details", icon: "C" },
];

const containerItems: NavItem[] = [
  { label: "Containers", href: "/containers", icon: "B" },
  { label: "Maintenance", href: "/containers/maintenance", icon: "M" },
];

function formatNotificationDate(value: string) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function NavSection({
  title,
  items,
  pathname,
  collapsed,
}: {
  title: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  function isItemActive(item: NavItem) {
    const hasNestedItem = items.some((other) => other.href !== item.href && other.href.startsWith(`${item.href}/`));
    return pathname === item.href || (!hasNestedItem && pathname.startsWith(`${item.href}/`));
  }

  const sectionActive = items.some((item) => isItemActive(item));
  const [manuallyOpen, setManuallyOpen] = useState(true);
  const open = collapsed || sectionActive || manuallyOpen;

  return (
    <div className="space-y-1.5">
      {!collapsed ? (
        <button
          type="button"
          onClick={() => setManuallyOpen((current) => !current)}
          className="flex w-full items-center justify-between px-3 pb-1 pt-3 text-left text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 hover:text-white"
        >
          <span>{title}</span>
          <span className={`text-xs transition ${open ? "rotate-90" : ""}`}>{">"}</span>
        </button>
      ) : (
        <div className="h-3" />
      )}
      {open ? items.map((item) => {
        const active = isItemActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            className={`flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition ${
              active
                ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30"
                : "text-slate-200 hover:bg-white/10 hover:text-white"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] ${active ? "bg-white/15" : "bg-white/5"}`}>
              {item.icon}
            </span>
            {!collapsed ? <span className="whitespace-nowrap">{item.label}</span> : null}
          </Link>
        );
      }) : null}
    </div>
  );
}

function SettingsSection({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const settingsActive = pathname.startsWith("/settings");
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const open = !collapsed && (settingsActive || manuallyOpen);

  return (
    <div className="space-y-1.5">
      {!collapsed ? (
        <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Settings
        </div>
      ) : (
        <div className="h-3" />
      )}
      <button
        type="button"
        onClick={() => setManuallyOpen((current) => !current)}
        title={collapsed ? "Settings" : undefined}
        className={`flex h-9 w-full items-center justify-between rounded-md px-3 text-sm font-medium transition ${
          settingsActive
            ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30"
            : "text-slate-200 hover:bg-white/10 hover:text-white"
        } ${collapsed ? "justify-center px-0" : ""}`}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-[11px]">G</span>
          {!collapsed ? "Settings" : null}
        </span>
        {!collapsed ? <span className={`text-xs transition ${open ? "rotate-90" : ""}`}>{">"}</span> : null}
      </button>
      {open ? (
        <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
          {settingsItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ContainersSection({ pathname, collapsed }: { pathname: string; collapsed: boolean }) {
  const containersActive = pathname.startsWith("/containers");
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const open = !collapsed && (containersActive || manuallyOpen);

  return (
    <div className="space-y-1.5">
      {!collapsed ? (
        <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Containers
        </div>
      ) : (
        <div className="h-3" />
      )}
      <button
        type="button"
        onClick={() => setManuallyOpen((current) => !current)}
        title={collapsed ? "Containers" : undefined}
        className={`flex h-9 w-full items-center justify-between rounded-md px-3 text-sm font-medium transition ${
          containersActive
            ? "bg-violet-600 text-white shadow-lg shadow-violet-950/30"
            : "text-slate-200 hover:bg-white/10 hover:text-white"
        } ${collapsed ? "justify-center px-0" : ""}`}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-[11px]">B</span>
          {!collapsed ? "Containers" : null}
        </span>
        {!collapsed ? <span className={`text-xs transition ${open ? "rotate-90" : ""}`}>{">"}</span> : null}
      </button>
      {open ? (
        <div className="ml-4 space-y-1 border-l border-white/10 pl-3">
          {containerItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function StaffShell({ title, children }: StaffShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [authResolved, setAuthResolved] = useState(false);
  const [username, setUsername] = useState("");
  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [globalCustomers, setGlobalCustomers] = useState<GlobalSearchCustomer[]>([]);
  const [globalStaff, setGlobalStaff] = useState<StaffSearchUser[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [calendarRequestCount, setCalendarRequestCount] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [chatCustomers, setChatCustomers] = useState<ChatCustomer[]>([]);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMode, setChatMode] = useState<"inbox" | "new">("inbox");
  const [newChatTitle, setNewChatTitle] = useState("");
  const [newChatParticipantIds, setNewChatParticipantIds] = useState<number[]>([]);
  const [chatMembersOpen, setChatMembersOpen] = useState(false);
  const [memberAddIds, setMemberAddIds] = useState<number[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [chatError, setChatError] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [targetChatMessageId, setTargetChatMessageId] = useState<number | null>(null);
  const [chatMenu, setChatMenu] = useState<{
    conversation: ChatConversation;
    x: number;
    y: number;
  } | null>(null);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const handledChatTargetRef = useRef("");
  const currentUser = getStoredUser();
  const canSearchStaff = canViewStaff(currentUser);

  const visibleNavSections = useMemo(() => {
    function canViewItem(item: NavItem) {
        if (item.href === "/dashboard") return canViewDashboard(currentUser);
        if (item.href === "/core-map") return canViewDashboard(currentUser);
        if (item.href === "/change-log") return canViewReporting(currentUser);
        if (item.href === "/leads") return canViewLeads(currentUser);
        if (item.href === "/quotes") return canViewQuotes(currentUser);
        if (item.href === "/contract-signing") return canViewQuotes(currentUser);
        if (item.href === "/customers") return canViewCustomers(currentUser);
        if (item.href === "/my-customers") return canViewCustomers(currentUser);
        if (item.href === "/sites") return canViewSites(currentUser);
        if (item.href === "/services") return canViewServices(currentUser);
        if (item.href === "/jobs") return canViewServices(currentUser);
        if (item.href === "/pricing") return canViewPricing(currentUser);
        if (item.href === "/expenses") return canViewExpenses(currentUser);
        if (item.href === "/haulier-pricing") return canViewHauliers(currentUser);
        if (item.href === "/purchase-orders") return canViewPurchaseOrders(currentUser);
        if (item.href === "/reporting") return canViewReporting(currentUser);
        if (item.href === "/staff") return canViewStaff(currentUser);
        if (item.href === "/containers") return canViewServices(currentUser);
        if (item.href === "/containers/maintenance") return canViewServices(currentUser);
        if (item.href === "/settings/company-details") return canManageUsers(currentUser);
        return true;
    }

    return [
      { title: "Core", items: coreItems },
      { title: "Sales", items: salesItems },
      { title: "Customers", items: customerItems },
      { title: "Operations", items: operationsItems },
      { title: "Containers", items: containerItems },
      { title: "Suppliers", items: supplierItems },
      { title: "Finance", items: financeItems },
      { title: "Team", items: teamItems },
      { title: "Settings", items: settingsItems },
    ]
      .map((section) => ({
        ...section,
        items: section.items.filter(canViewItem),
      }))
      .filter((section) => section.items.length > 0);
  }, [currentUser]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedToken = window.localStorage.getItem("staff_token");
      const storedUsername =
        window.localStorage.getItem("staff_username") ||
        window.localStorage.getItem("username") ||
        "";
      if (!storedToken || storedToken === "staff-session-active" || !storedUsername) {
        clearStaffSession();
        router.replace("/login");
        return;
      }
      setUsername(storedUsername);
      setAuthResolved(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [router]);

  const loadNotifications = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [response, calendarResponse] = await Promise.all([
        fetch("http://127.0.0.1:8000/api/purchase-orders/notifications/", { headers }),
        fetch("http://127.0.0.1:8000/api/staff-calendar/summary/", { headers }),
      ]);
      const data = await response.json();
      if (response.ok && data.success) {
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(Number(data.unread_count || 0));
      }
      const calendarData = await calendarResponse.json();
      if (calendarResponse.ok && calendarData.success) {
        setCalendarRequestCount(Number(calendarData.pending_request_count || 0));
      }
    } catch (error) {
      console.error("Failed to load notifications", error);
    }
  }, []);

  const staffHeader = useCallback(
    () => getAuthHeaders(),
    []
  );

  const loadChatSummary = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/staff-chat/summary/", {
        headers: staffHeader(),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setChatUnreadCount(Number(data.unread_count || 0));
      }
    } catch (error) {
      console.error("Failed to load chat summary", error);
    }
  }, [staffHeader]);

  const loadChatUsers = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/staff-chat/users/", {
        headers: staffHeader(),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setChatUsers(Array.isArray(data.users) ? data.users : []);
      }
    } catch (error) {
      console.error("Failed to load chat users", error);
    }
  }, [staffHeader]);

  const loadChatCustomers = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/customers/");
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setChatCustomers(data);
      }
    } catch (error) {
      console.error("Failed to load chat customers", error);
    }
  }, []);

  useEffect(() => {
    const term = searchText.trim();
    if (term.length < 2 || (!searchFocused && document.activeElement?.tagName !== "INPUT")) return;

    let cancelled = false;

    async function loadGlobalSearchData() {
      try {
        const requests: Promise<Response>[] = [
          fetch("http://127.0.0.1:8000/api/customers/", {
            headers: getAuthHeaders(),
          }),
        ];

        if (canSearchStaff) {
          requests.push(
            fetch("http://127.0.0.1:8000/api/auth/staff/", {
              headers: getAuthHeaders(),
            })
          );
        }

        const [customersResponse, staffResponse] = await Promise.all(requests);
        const customersData = await customersResponse.json();
        const staffData = staffResponse ? await staffResponse.json() : { staff: [] };

        if (cancelled) return;
        setGlobalCustomers(Array.isArray(customersData) ? customersData : []);
        setGlobalStaff(Array.isArray(staffData.staff) ? staffData.staff : []);
      } catch (error) {
        if (cancelled) return;
        console.error("Global search failed", error);
        setGlobalCustomers([]);
        setGlobalStaff([]);
      }
    }

    const timeout = window.setTimeout(loadGlobalSearchData, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [canSearchStaff, searchFocused, searchText]);

  const loadChatConversations = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/staff-chat/conversations/", {
        headers: staffHeader(),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setChatConversations(Array.isArray(data.conversations) ? data.conversations : []);
      }
    } catch (error) {
      console.error("Failed to load chat conversations", error);
    }
  }, [staffHeader]);

  async function openChatConversation(conversationId: number) {
    try {
      setChatError("");
      setChatMenu(null);
      const response = await fetch(`http://127.0.0.1:8000/api/staff-chat/conversations/${conversationId}/`, {
        headers: staffHeader(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not open conversation.");
      setActiveChat(data.conversation);
      setChatMembersOpen(false);
      setMemberAddIds([]);
      setMemberSearch("");
      await loadChatConversations();
      await loadChatSummary();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not open conversation.");
    }
  }

  async function sendChatMessage() {
    if (!activeChat || !chatMessage.trim()) return;
    try {
      setChatError("");
      const response = await fetch(`http://127.0.0.1:8000/api/staff-chat/conversations/${activeChat.id}/send/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...staffHeader(),
        },
        body: JSON.stringify({ body: chatMessage }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not send message.");
      setChatMessage("");
      await openChatConversation(activeChat.id);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not send message.");
    }
  }

  async function createChatConversation() {
    if (newChatParticipantIds.length === 0) {
      setChatError("Choose at least one staff member.");
      return;
    }
    try {
      setChatError("");
      const response = await fetch("http://127.0.0.1:8000/api/staff-chat/conversations/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...staffHeader(),
        },
        body: JSON.stringify({
          participant_ids: newChatParticipantIds,
          title: newChatTitle,
          is_group: newChatParticipantIds.length > 1 || Boolean(newChatTitle.trim()),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not create chat.");
      setNewChatParticipantIds([]);
      setNewChatTitle("");
      setChatMode("inbox");
      setActiveChat(data.conversation);
      setChatMembersOpen(false);
      setMemberAddIds([]);
      setMemberSearch("");
      await loadChatConversations();
      await loadChatSummary();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not create chat.");
    }
  }

  async function runChatConversationAction(
    conversation: ChatConversation,
    action: "read" | "unread" | "hide" | "mute"
  ) {
    if (action === "hide" && conversation.is_everyone) {
      setChatMenu(null);
      setChatError("The Everyone thread is permanent and cannot be deleted.");
      return;
    }
    try {
      setChatError("");
      const response = await fetch(`http://127.0.0.1:8000/api/staff-chat/conversations/${conversation.id}/${action}/`, {
        method: "POST",
        headers: staffHeader(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not update chat.");
      setChatMenu(null);
      if (action === "hide" && activeChat?.id === conversation.id) {
        setActiveChat(null);
        setChatMessage("");
      }
      await loadChatConversations();
      await loadChatSummary();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not update chat.");
    }
  }

  function openChatContextMenu(event: ReactMouseEvent, conversation: ChatConversation) {
    event.preventDefault();
    setChatMenu({
      conversation,
      x: event.clientX,
      y: event.clientY,
    });
  }

  useEffect(() => {
    if (!authResolved || !username) return;
    const timeout = window.setTimeout(loadNotifications, 0);
    const interval = window.setInterval(loadNotifications, 20000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [authResolved, loadNotifications, username]);

  useEffect(() => {
    if (!authResolved || !username) return;
    const loadChat = () => {
      loadChatSummary();
      loadChatConversations();
      if (chatOpen) {
        loadChatUsers();
        loadChatCustomers();
      }
    };
    const timeout = window.setTimeout(loadChat, 0);
    const interval = window.setInterval(loadChat, 8000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [authResolved, chatOpen, loadChatConversations, loadChatCustomers, loadChatSummary, loadChatUsers, username]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setChatOpen(false);
        setChatMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (chatOpen) messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [activeChat?.messages, chatOpen]);

  useEffect(() => {
    if (!authResolved) return;
    const params = new URLSearchParams(window.location.search);
    const chatId = Number(params.get("chat"));
    const messageId = Number(params.get("message"));
    if (!chatId || !messageId) return;
    const key = `${chatId}:${messageId}`;
    if (handledChatTargetRef.current === key) return;
    handledChatTargetRef.current = key;
    setChatOpen(true);
    setTargetChatMessageId(messageId);
    openChatConversation(chatId);
  }, [authResolved, pathname]);

  useEffect(() => {
    if (!targetChatMessageId || !activeChat?.messages?.length) return;
    const element = document.getElementById(`staff-message-${targetChatMessageId}`);
    if (!element) return;
    element.scrollIntoView({ block: "center" });
    const timeout = window.setTimeout(() => setTargetChatMessageId(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [activeChat?.messages, targetChatMessageId]);

  useEffect(() => {
    function closeContextMenu() {
      setChatMenu(null);
    }
    document.addEventListener("click", closeContextMenu);
    return () => document.removeEventListener("click", closeContextMenu);
  }, []);

  useEffect(() => {
    if (!authResolved || !currentUser) return;
    const restrictedRoutes = [
      { path: "/dashboard", allowed: canViewDashboard(currentUser) },
      { path: "/change-log", allowed: canViewReporting(currentUser) },
      { path: "/leads", allowed: canViewLeads(currentUser) },
      { path: "/quotes", allowed: canViewQuotes(currentUser) },
      { path: "/customers", allowed: canViewCustomers(currentUser) },
      { path: "/my-customers", allowed: canViewCustomers(currentUser) },
      { path: "/sites", allowed: canViewSites(currentUser) },
      { path: "/services", allowed: canViewServices(currentUser) },
      { path: "/jobs", allowed: canViewServices(currentUser) },
      { path: "/pricing", allowed: canViewPricing(currentUser) },
      { path: "/expenses", allowed: canViewExpenses(currentUser) },
      { path: "/haulier-pricing", allowed: canViewHauliers(currentUser) },
      { path: "/contract-signing", allowed: canViewQuotes(currentUser) },
      { path: "/purchase-orders", allowed: canViewPurchaseOrders(currentUser) },
      { path: "/reporting", allowed: canViewReporting(currentUser) },
      { path: "/staff", allowed: canViewStaff(currentUser) },
      { path: "/settings", allowed: canManageUsers(currentUser) },
    ];
    const blocked = restrictedRoutes.find(
      (route) => (pathname === route.path || pathname.startsWith(`${route.path}/`)) && !route.allowed
    );
    if (blocked) router.replace("/dashboard");
  }, [authResolved, currentUser, pathname, router]);

  async function markNotificationRead(notificationId: number) {
    try {
      await fetch(`http://127.0.0.1:8000/api/purchase-orders/notifications/${notificationId}/read/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark notification read", error);
    }
  }

  async function markAllNotificationsRead() {
    try {
      await fetch("http://127.0.0.1:8000/api/purchase-orders/notifications/mark-all-read/", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      await loadNotifications();
    } catch (error) {
      console.error("Failed to mark all notifications read", error);
    }
  }

  function openNotification(item: NotificationItem) {
    markNotificationRead(item.id);
    if (item.target_url) {
      router.push(item.target_url);
      const target = new URL(item.target_url, window.location.origin);
      const chatId = Number(target.searchParams.get("chat"));
      const messageId = Number(target.searchParams.get("message"));
      if (chatId && messageId) {
        setChatOpen(true);
        setTargetChatMessageId(messageId);
        openChatConversation(chatId);
      }
    } else if (item.purchase_order_id) {
      router.push("/purchase-orders");
    }
    setNotificationsOpen(false);
  }

  function openCalendarRequests() {
    router.push("/calendar");
    setNotificationsOpen(false);
  }

  function logout() {
    window.localStorage.removeItem("staff_token");
    window.localStorage.removeItem("staff_username");
    window.localStorage.removeItem("username");
    window.localStorage.removeItem("staff_role");
    window.localStorage.removeItem("recyclrUser");
    router.replace("/login");
  }

  function normaliseSearch(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function globalCustomerHaystack(customer: GlobalSearchCustomer) {
    const siteText = (customer.sites || [])
      .map((site) =>
        [
          site.site_name,
          site.address_line_1,
          site.address_line_2,
          site.town,
          site.county,
          site.postcode,
        ].join(" ")
      )
      .join(" ");

    return [
      customer.customer_uid,
      customer.business_name,
      customer.contact_name,
      customer.email,
      customer.phone,
      customer.town,
      customer.county,
      customer.postcode,
      siteText,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function globalCustomerMatchDetail(customer: GlobalSearchCustomer, term: string) {
    const searchTerm = term.toLowerCase().trim();
    const matchingSite = (customer.sites || []).find((site) =>
      [site.site_name, site.address_line_1, site.address_line_2, site.town, site.county, site.postcode]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm)
    );

    if (matchingSite) {
      return [matchingSite.site_name, matchingSite.town, matchingSite.postcode].filter(Boolean).join(" - ");
    }

    return [customer.contact_name, customer.town, customer.postcode].filter(Boolean).join(" - ") || "Customer account";
  }

  const globalSearchTerm = searchText.trim();
  const normalGlobalSearchTerm = normaliseSearch(globalSearchTerm);
  const globalCustomerMatches = globalCustomers
    .filter((customer) => normalGlobalSearchTerm && normaliseSearch(globalCustomerHaystack(customer)).includes(normalGlobalSearchTerm))
    .sort((a, b) => a.business_name.localeCompare(b.business_name) || a.id - b.id)
    .slice(0, 6);
  const globalStaffMatches = globalStaff
    .filter((user) => {
      if (!normalGlobalSearchTerm) return false;
      const profile = user.profile || {};
      const haystack = [user.username, user.role, profile.job_title, profile.company_email, profile.company_phone]
        .filter(Boolean)
        .join(" ");
      return normaliseSearch(haystack).includes(normalGlobalSearchTerm);
    })
    .sort((a, b) => (a.username || "").localeCompare(b.username || ""))
    .slice(0, 4);
  const showGlobalSearchDropdown =
    searchFocused && globalSearchTerm.length >= 2 && (globalCustomerMatches.length > 0 || globalStaffMatches.length > 0);

  async function handleGlobalSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchText.trim();
    if (!term) return;

    if (canViewStaff(currentUser)) {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/auth/staff/", {
          headers: getAuthHeaders(),
        });
        const data = await response.json();
        const staff: StaffSearchUser[] = Array.isArray(data.staff) ? data.staff : [];
        const normalTerm = normaliseSearch(term);
        const matches = staff.filter((user) => {
          const profile = user.profile || {};
          const haystack = [
            user.username,
            user.role,
            profile.job_title,
            profile.company_email,
            profile.company_phone,
          ]
            .filter(Boolean)
            .join(" ");

          return normaliseSearch(haystack).includes(normalTerm);
        });

        if (matches.length === 1) {
          router.push(`/staff/${matches[0].id}`);
          return;
        }

        if (matches.length > 1) {
          router.push(`/staff?search=${encodeURIComponent(term)}`);
          return;
        }
      } catch (error) {
        console.error("Staff search failed", error);
      }
    }

    router.push(`/customers?search=${encodeURIComponent(term)}`);
  }

  function toggleChatParticipant(userId: number) {
    setNewChatParticipantIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  function toggleMemberAdd(userId: number) {
    setMemberAddIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  }

  async function addChatMembers() {
    if (!activeChat || memberAddIds.length === 0) return;

    try {
      setChatError("");
      const response = await fetch(`http://127.0.0.1:8000/api/staff-chat/conversations/${activeChat.id}/participants/add/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...staffHeader(),
        },
        body: JSON.stringify({ participant_ids: memberAddIds }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not add staff.");
      setActiveChat(data.conversation);
      setMemberAddIds([]);
      setMemberSearch("");
      await loadChatConversations();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not add staff.");
    }
  }

  async function removeChatMember(userId: number) {
    if (!activeChat) return;

    try {
      setChatError("");
      const response = await fetch(`http://127.0.0.1:8000/api/staff-chat/conversations/${activeChat.id}/participants/remove/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...staffHeader(),
        },
        body: JSON.stringify({ participant_id: userId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not remove staff.");
      if (data.conversation) {
        setActiveChat(data.conversation);
      } else {
        await openChatConversation(activeChat.id);
      }
      setMemberAddIds([]);
      setMemberSearch("");
      await loadChatConversations();
      await loadChatSummary();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not remove staff.");
    }
  }

  async function leaveChatThread() {
    if (!activeChat) return;

    try {
      setChatError("");
      const response = await fetch(`http://127.0.0.1:8000/api/staff-chat/conversations/${activeChat.id}/leave/`, {
        method: "POST",
        headers: staffHeader(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not leave thread.");
      setActiveChat(null);
      setChatMembersOpen(false);
      setMemberAddIds([]);
      await loadChatConversations();
      await loadChatSummary();
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Could not leave thread.");
    }
  }

  function formatChatDate(value: string) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return value;
    }
  }

  function getMentionSearch() {
    const cursor = chatTextareaRef.current?.selectionStart ?? chatMessage.length;
    const textBeforeCursor = chatMessage.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
    if (!match) return null;
    const start = textBeforeCursor.lastIndexOf("@");
    return {
      query: match[1].toLowerCase(),
      start,
      end: cursor,
    };
  }

  function getCustomerCommandSearch() {
    const cursor = chatTextareaRef.current?.selectionStart ?? chatMessage.length;
    const textBeforeCursor = chatMessage.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)\/([A-Za-z0-9_.-]*)$/);
    if (!match) return null;
    const start = textBeforeCursor.lastIndexOf("/");
    return {
      query: (match[1] || "").toLowerCase().trim(),
      start,
      end: cursor,
    };
  }

  function insertMention(user: ChatUser) {
    const mention = getMentionSearch();
    if (!mention) return;
    const nextMessage = `${chatMessage.slice(0, mention.start)}@${user.username} ${chatMessage.slice(mention.end)}`;
    setChatMessage(nextMessage);
    window.setTimeout(() => {
      const nextPosition = mention.start + user.username.length + 2;
      chatTextareaRef.current?.focus();
      chatTextareaRef.current?.setSelectionRange(nextPosition, nextPosition);
    }, 0);
  }

  function insertCustomerLink(customer: ChatCustomer) {
    const command = getCustomerCommandSearch();
    if (!command) return;
    const customerLabel = `${customer.customer_uid || `Customer ${customer.id}`} - ${customer.business_name}`;
    const insertText = `${customerLabel}: /customers/${customer.id} `;
    const nextMessage = `${chatMessage.slice(0, command.start)}${insertText}${chatMessage.slice(command.end)}`;
    setChatMessage(nextMessage);
    window.setTimeout(() => {
      const nextPosition = command.start + insertText.length;
      chatTextareaRef.current?.focus();
      chatTextareaRef.current?.setSelectionRange(nextPosition, nextPosition);
    }, 0);
  }

  function renderMessageBody(body: string) {
    const parts = body.split(/((?:https?:\/\/[^\s]+)|(?:\/customers\/\d+))/g);
    return parts.map((part, index) => {
      if (/^\/customers\/\d+$/.test(part)) {
        return (
          <Link key={`${part}-${index}`} href={part} className="font-bold underline">
            Open customer
          </Link>
        );
      }
      if (/^https?:\/\/[^\s]+$/.test(part)) {
        return (
          <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="font-bold underline">
            {part}
          </a>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  }

  function handleChatKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  }

  const availableChatUsers = chatUsers.filter((user) => user.username !== username);
  const activeParticipantIds = activeChat ? activeChat.participants.map((user) => user.id) : [];
  const addableChatUsers = chatUsers.filter((user) => activeChat && !activeParticipantIds.includes(user.id));
  const filteredAddableChatUsers = addableChatUsers
    .filter((user) => {
      const term = memberSearch.trim().toLowerCase();
      if (!term) return true;
      return `${user.name} ${user.username} ${user.email}`.toLowerCase().includes(term);
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.username.localeCompare(b.username))
    .slice(0, 20);
  const mentionSearch = getMentionSearch();
  const customerCommandSearch = getCustomerCommandSearch();
  const mentionUsers = chatUsers
    .filter((user) => user.username !== username)
    .filter((user) => {
      if (!mentionSearch) return false;
      const haystack = `${user.name} ${user.username} ${user.email}`.toLowerCase();
      return haystack.includes(mentionSearch.query);
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.username.localeCompare(b.username));
  const customerCommandResults = chatCustomers
    .filter((customer) => {
      if (!customerCommandSearch) return false;
      const haystack = `${customer.customer_uid} ${customer.business_name} ${customer.contact_name} ${customer.postcode || ""}`.toLowerCase();
      return !customerCommandSearch.query || haystack.includes(customerCommandSearch.query);
    })
    .sort((a, b) => a.business_name.localeCompare(b.business_name) || a.id - b.id)
    .slice(0, 12);
  const initials =
    username
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "JG";
  const profileHref = currentUser?.id ? `/staff/${currentUser.id}` : "/staff";
  const profilePhoto = currentUser?.profile?.photo_data || "";
  const profileSubtitle = currentUser?.profile?.job_title || roleLabel(currentUser);
  const notificationBadgeCount = unreadCount + calendarRequestCount;

  if (!authResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c0432] text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#12055a] text-white">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/10 bg-[#07032b] py-5 text-white transition-all duration-200 ${
          sidebarCollapsed ? "w-[72px] px-3" : "w-[240px] px-4"
        }`}
      >
        <Link href="/dashboard" className={`mb-6 block ${sidebarCollapsed ? "px-1" : ""}`}>
          <img
            src="/recyclrcore-logo.png"
            alt="RecyclrCore"
            className={`h-auto transition-all duration-200 ${sidebarCollapsed ? "w-[46px] max-w-none object-cover object-left" : "w-[165px]"}`}
          />
        </Link>
        <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
          {visibleNavSections.map((section) => (
            <NavSection
              key={section.title}
              title={section.title}
              items={section.items}
              pathname={pathname}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>
      </aside>

      <main
        className={`min-h-screen min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,#32108a_0,#14045f_42%,#0d0338_100%)] transition-all duration-200 ${
          sidebarCollapsed ? "pl-[72px]" : "pl-[240px]"
        }`}
      >
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#160663] px-5 py-3 shadow-lg shadow-violet-950/20">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-md text-xl text-white hover:bg-white/10"
              title={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
            >
              =
            </button>
            <form onSubmit={handleGlobalSearch} className="relative max-w-[470px] flex-1">
              <div className="flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 text-white">
                <span className="text-sm text-white/60">Search</span>
                <input
                  value={searchText}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Search customers, sites, services, staff..."
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/50"
                />
                <span className="text-xs text-white/45">Ctrl K</span>
              </div>
              {showGlobalSearchDropdown ? (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-lg border border-violet-100 bg-white text-slate-950 shadow-2xl">
                  {globalCustomerMatches.length ? (
                    <div className="border-b border-slate-100 py-2">
                      <div className="px-3 pb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">Customers</div>
                      {globalCustomerMatches.map((customer) => (
                        <button
                          key={`customer-${customer.id}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setSearchText("");
                            setSearchFocused(false);
                            router.push(`/customers/${customer.id}`);
                          }}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-violet-50"
                        >
                          <span className="shrink-0 rounded bg-violet-100 px-2 py-1 font-mono text-[11px] font-black text-violet-800">
                            {customer.customer_uid || `#${customer.id}`}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black">{customer.business_name || "Unnamed customer"}</span>
                            <span className="block truncate text-xs font-semibold text-slate-500">
                              {globalCustomerMatchDetail(customer, globalSearchTerm)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {globalStaffMatches.length ? (
                    <div className="py-2">
                      <div className="px-3 pb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">Staff</div>
                      {globalStaffMatches.map((user) => (
                        <button
                          key={`staff-${user.id}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setSearchText("");
                            setSearchFocused(false);
                            router.push(`/staff/${user.id}`);
                          }}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-violet-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black">{user.username || "Staff member"}</span>
                            <span className="block truncate text-xs font-semibold text-slate-500">
                              {[user.profile?.job_title, user.profile?.company_email].filter(Boolean).join(" - ") || user.role || "Staff"}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-[11px] font-black uppercase text-violet-800">
                            Staff
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <button
                    type="submit"
                    onMouseDown={(event) => event.preventDefault()}
                    className="flex w-full items-center justify-between border-t border-slate-100 px-3 py-2 text-left text-sm font-black text-violet-800 hover:bg-violet-50"
                  >
                    Search all customers for &quot;{globalSearchTerm}&quot;
                    <span>{">"}</span>
                  </button>
                </div>
              ) : null}
            </form>
            <div className="ml-auto flex items-center gap-3">
              <Link
                href="/email"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/15"
                title="Open email"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  <rect
                    x="4"
                    y="6"
                    width="16"
                    height="12"
                    rx="2.5"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.2"
                  />
                  <path
                    d="m5.5 8 6.5 5 6.5-5"
                    fill="none"
                    stroke="white"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.2"
                  />
                </svg>
              </Link>
              <Link
                href="/calendar"
                className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white hover:bg-white/15"
                title="Open calendar"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                  <path
                    d="M7 3.5v3M17 3.5v3M4.75 9.25h14.5"
                    fill="none"
                    stroke="white"
                    strokeLinecap="round"
                    strokeWidth="2.2"
                  />
                  <rect
                    x="4.75"
                    y="5.25"
                    width="14.5"
                    height="15"
                    rx="2.5"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M8 13h.01M12 13h.01M16 13h.01M8 16.5h.01M12 16.5h.01"
                    fill="none"
                    stroke="white"
                    strokeLinecap="round"
                    strokeWidth="2.8"
                  />
                </svg>
              </Link>
              <div className="relative" ref={chatRef}>
                <button
                  type="button"
                  onClick={() => {
                    setChatOpen((current) => !current);
                    setNotificationsOpen(false);
                    loadChatUsers();
                    loadChatCustomers();
                    loadChatConversations();
                    loadChatSummary();
                  }}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-sm font-bold text-white hover:bg-white/15"
                  title="Staff messages"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                    <path
                      d="M5 5.5h14a3 3 0 0 1 3 3v5.25a3 3 0 0 1-3 3H10.5L6.2 20.3a.7.7 0 0 1-1.15-.54v-3.05A3 3 0 0 1 2 13.75V8.5a3 3 0 0 1 3-3Z"
                      fill="white"
                    />
                    <circle cx="8.8" cy="11.2" r="1.55" fill="#160663" />
                    <circle cx="12" cy="11.2" r="1.55" fill="#160663" />
                    <circle cx="15.2" cy="11.2" r="1.55" fill="#160663" />
                  </svg>
                  {chatUnreadCount > 0 ? (
                    <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white ring-2 ring-[#160663]">
                      {chatUnreadCount > 9 ? "9+" : chatUnreadCount}
                    </span>
                  ) : null}
                </button>
                {chatOpen ? (
                  <div className="absolute right-0 top-12 z-50 flex h-[620px] w-[760px] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-2xl">
                    {chatMenu ? (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className="fixed z-[70] w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm shadow-2xl"
                        style={{ left: chatMenu.x, top: chatMenu.y }}
                      >
                        <button
                          type="button"
                          onClick={() => openChatConversation(chatMenu.conversation.id)}
                          className="block w-full px-3 py-2 text-left font-semibold text-slate-700 hover:bg-violet-50"
                        >
                          Open thread
                        </button>
                        <button
                          type="button"
                          onClick={() => runChatConversationAction(chatMenu.conversation, "read")}
                          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-violet-50"
                        >
                          Mark as read
                        </button>
                        <button
                          type="button"
                          onClick={() => runChatConversationAction(chatMenu.conversation, "unread")}
                          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-violet-50"
                        >
                          Mark as unread
                        </button>
                        <button
                          type="button"
                          onClick={() => runChatConversationAction(chatMenu.conversation, "mute")}
                          className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-violet-50"
                        >
                          Mute for 1 hour
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => runChatConversationAction(chatMenu.conversation, "hide")}
                          disabled={chatMenu.conversation.is_everyone}
                          className="block w-full px-3 py-2 text-left font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
                        >
                          Delete thread
                        </button>
                      </div>
                    ) : null}
                    <div className="flex w-[300px] flex-col border-r border-slate-200 bg-slate-50">
                      <div className="border-b border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold">Staff Messages</div>
                            <div className="text-xs text-slate-500">{chatUnreadCount} unread</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setChatMode(chatMode === "new" ? "inbox" : "new");
                              setChatError("");
                            }}
                            className="rounded-md bg-violet-700 px-3 py-2 text-xs font-bold text-white"
                          >
                            {chatMode === "new" ? "Inbox" : "New"}
                          </button>
                        </div>
                      </div>

                      {chatMode === "new" ? (
                        <div className="flex-1 overflow-y-auto p-4">
                          <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            Group name
                          </label>
                          <input
                            value={newChatTitle}
                            onChange={(event) => setNewChatTitle(event.target.value)}
                            placeholder="Optional for private chats"
                            className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-500"
                          />
                          <div className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            Staff
                          </div>
                          <div className="mt-2 space-y-2">
                            {availableChatUsers.length === 0 ? (
                              <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                                No other staff accounts found yet.
                              </div>
                            ) : (
                              availableChatUsers.map((user) => {
                                const selected = newChatParticipantIds.includes(user.id);
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => toggleChatParticipant(user.id)}
                                    className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm ${
                                      selected
                                        ? "border-violet-600 bg-violet-50 text-violet-950"
                                        : "border-slate-200 bg-white text-slate-800 hover:bg-slate-100"
                                    }`}
                                  >
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white">
                                      {user.initials}
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block truncate font-bold">{user.name}</span>
                                      <span className="block truncate text-xs text-slate-500">@{user.username}</span>
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={createChatConversation}
                            className="mt-4 h-10 w-full rounded-md bg-violet-700 text-sm font-bold text-white hover:bg-violet-800"
                          >
                            Start Chat
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 overflow-y-auto p-2">
                          <div className="px-2 pb-2 text-[11px] font-semibold text-slate-500">
                            Right-click a thread for more options.
                          </div>
                          {chatConversations.length === 0 ? (
                            <div className="m-2 rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                              No chats yet. Start one with New.
                            </div>
                          ) : (
                            chatConversations.map((conversation) => {
                              const active = activeChat?.id === conversation.id;
                              const hasUnread = conversation.unread_count > 0;
                              return (
                                <button
                                  key={conversation.id}
                                  type="button"
                                  onClick={() => openChatConversation(conversation.id)}
                                  onContextMenu={(event) => openChatContextMenu(event, conversation)}
                                  className={`mb-2 block w-full rounded-md border px-3 py-3 text-left ${
                                    active
                                      ? "border-violet-600 bg-violet-50"
                                      : hasUnread
                                        ? "border-violet-500 bg-violet-100 shadow-sm shadow-violet-200"
                                      : conversation.is_pinned
                                        ? "border-emerald-200 bg-emerald-50 hover:border-emerald-300"
                                        : "border-transparent bg-white hover:border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <div className={`truncate text-sm font-bold ${hasUnread ? "text-violet-950" : ""}`}>
                                          {conversation.title}
                                        </div>
                                        {hasUnread ? (
                                          <span className="rounded bg-violet-700 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                                            New
                                          </span>
                                        ) : null}
                                        {conversation.is_pinned ? (
                                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                                            Pinned
                                          </span>
                                        ) : null}
                                        {conversation.is_muted ? (
                                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                            Muted
                                          </span>
                                        ) : null}
                                      </div>
                                      <div className={`mt-1 truncate text-xs ${hasUnread ? "font-semibold text-violet-800" : "text-slate-500"}`}>
                                        {conversation.last_message?.body || "No messages yet"}
                                      </div>
                                    </div>
                                    {hasUnread ? (
                                      <span className="flex min-w-[54px] items-center justify-center rounded-full bg-violet-700 px-2 py-1 text-[11px] font-bold text-white">
                                        {conversation.unread_count} new
                                      </span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold">{activeChat?.title || "Choose a chat"}</div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                              {activeChat
                                ? activeChat.participants.map((user) => `@${user.username}`).join(", ")
                                : "Private chats, group chats, unread messages, and @mentions are available."}
                            </div>
                          </div>
                          {activeChat ? (
                            <button
                              type="button"
                              onClick={() => {
                                setChatMembersOpen((current) => !current);
                                setMemberAddIds([]);
                              }}
                              className="shrink-0 rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-50"
                            >
                              Members
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {chatError ? (
                        <div className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                          {chatError}
                        </div>
                      ) : null}

                      {activeChat && chatMembersOpen ? (
                        <div className="border-b border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-black">Thread Members</div>
                              <div className="mt-1 text-xs font-medium text-slate-500">
                                {activeChat.is_everyone
                                  ? "Everyone is automatic and cannot be changed."
                                  : "Add staff, remove staff, or leave this thread."}
                              </div>
                            </div>
                            {!activeChat.is_everyone ? (
                              <button
                                type="button"
                                onClick={leaveChatThread}
                                className="rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                              >
                                Leave Thread
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <div className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="text-xs font-black uppercase tracking-wide text-slate-400">Current</div>
                              <div className="mt-2 max-h-[132px] space-y-2 overflow-y-auto pr-1">
                                {activeChat.participants.map((user) => (
                                  <div key={user.id} className="flex min-h-9 items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5">
                                    <span className="min-w-0 truncate text-sm font-bold text-slate-950">{user.name}</span>
                                    {!activeChat.is_everyone && user.username !== username ? (
                                      <button
                                        type="button"
                                        onClick={() => removeChatMember(user.id)}
                                        className="shrink-0 rounded border border-red-100 bg-white px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-50"
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-md border border-slate-200 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-black uppercase tracking-wide text-slate-400">Add Staff</div>
                                <button
                                  type="button"
                                  onClick={addChatMembers}
                                  disabled={activeChat.is_everyone || memberAddIds.length === 0}
                                  className="rounded bg-violet-700 px-2 py-1 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                  Add
                                </button>
                              </div>
                              <input
                                value={memberSearch}
                                onChange={(event) => setMemberSearch(event.target.value)}
                                disabled={activeChat.is_everyone}
                                placeholder="Search staff..."
                                className="mt-2 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:border-violet-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                              />
                              <div className="mt-2 max-h-[132px] space-y-2 overflow-y-auto pr-1">
                                {activeChat.is_everyone ? (
                                  <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                                    Everyone already includes all active staff.
                                  </div>
                                ) : addableChatUsers.length === 0 ? (
                                  <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                                    No more staff to add.
                                  </div>
                                ) : filteredAddableChatUsers.length === 0 ? (
                                  <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                                    No staff match that search.
                                  </div>
                                ) : (
                                  filteredAddableChatUsers.map((user) => {
                                    const selected = memberAddIds.includes(user.id);
                                    return (
                                      <button
                                        key={user.id}
                                        type="button"
                                        onClick={() => toggleMemberAdd(user.id)}
                                        className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm ${
                                          selected
                                            ? "border-violet-600 bg-violet-50 text-violet-950"
                                            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                                        }`}
                                      >
                                        <span className={`h-4 w-4 rounded border ${selected ? "border-violet-700 bg-violet-700" : "border-slate-300"}`} />
                                        <span className="min-w-0">
                                          <span className="block truncate font-bold">{user.name}</span>
                                          <span className="block truncate text-xs text-slate-500">@{user.username}</span>
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex-1 overflow-y-auto p-4">
                        {!activeChat ? (
                          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
                            Select a conversation or start a new one.
                          </div>
                        ) : activeChat.messages?.length ? (
                          <div className="space-y-3">
                            {activeChat.messages.map((message) => {
                              const mine = message.sender?.username === username;
                              return (
                                <div
                                  key={message.id}
                                  id={`staff-message-${message.id}`}
                                  className={`flex scroll-mt-8 rounded-lg transition ${
                                    mine ? "justify-end" : "justify-start"
                                  } ${targetChatMessageId === message.id ? "bg-amber-100/80 p-2 ring-2 ring-amber-300" : ""}`}
                                >
                                  <div
                                    className={`max-w-[78%] rounded-lg px-3 py-2 text-sm ${
                                      mine
                                        ? "bg-violet-700 text-white"
                                        : "border border-slate-200 bg-slate-100 text-slate-950"
                                    }`}
                                  >
                                    <div className={`mb-1 text-xs font-bold ${mine ? "text-white/75" : "text-slate-500"}`}>
                                      {message.sender?.name || "Staff"} - {formatChatDate(message.created_at)}
                                    </div>
                                    <div className="whitespace-pre-wrap break-words">{renderMessageBody(message.body)}</div>
                                  </div>
                                </div>
                              );
                            })}
                            <div ref={messagesEndRef} />
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 text-sm text-slate-500">
                            No messages in this chat yet.
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-200 p-4">
                        <div className="mb-2 text-xs text-slate-500">
                          Tag staff with @ or share customers with /
                        </div>
                        {mentionSearch ? (
                          <div className="mb-3 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                            {mentionUsers.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-slate-500">No staff match that name.</div>
                            ) : (
                              mentionUsers.map((user) => (
                                <button
                                  key={user.id}
                                  type="button"
                                  onClick={() => insertMention(user)}
                                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-violet-50"
                                >
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white">
                                    {user.initials}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-slate-950">{user.name}</span>
                                    <span className="block truncate text-xs text-slate-500">@{user.username}</span>
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                        {customerCommandSearch ? (
                          <div className="mb-3 max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                            {customerCommandResults.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-slate-500">No customers match that search.</div>
                            ) : (
                              customerCommandResults.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => insertCustomerLink(customer)}
                                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-violet-50"
                                >
                                  <span className="rounded bg-violet-100 px-2 py-1 font-mono text-[11px] font-black text-violet-800">
                                    {customer.customer_uid || `#${customer.id}`}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold text-slate-950">
                                      {customer.business_name || "Unnamed customer"}
                                    </span>
                                    <span className="block truncate text-xs text-slate-500">
                                      {[customer.contact_name, customer.postcode].filter(Boolean).join(" - ") || "Customer account"}
                                    </span>
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                        <div className="flex items-end gap-2">
                          <textarea
                            ref={chatTextareaRef}
                            value={chatMessage}
                            onChange={(event) => setChatMessage(event.target.value)}
                            onKeyDown={handleChatKeyDown}
                            disabled={!activeChat}
                            placeholder="Type a message..."
                            rows={3}
                            className="min-h-[76px] flex-1 resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500 disabled:bg-slate-100"
                          />
                          <button
                            type="button"
                            onClick={sendChatMessage}
                            disabled={!activeChat || !chatMessage.trim()}
                            className="h-10 rounded-md bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                          >
                            Send
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="relative" ref={bellRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((current) => !current)}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white"
                >
                  <span className="relative block h-7 w-7">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                      <path
                        d="M9 20.25c.55.72 1.54 1.2 3 1.2s2.45-.48 3-1.2"
                        fill="none"
                        stroke="white"
                        strokeLinecap="round"
                        strokeWidth="2.4"
                      />
                      <path
                        d="M12 3.1c-3.35 0-5.75 2.7-5.75 6.28v3.9c0 .9-.38 1.75-1.05 2.34l-1.25 1.1c-.72.64-.27 1.83.7 1.83h14.7c.97 0 1.42-1.19.7-1.83l-1.25-1.1a3.12 3.12 0 0 1-1.05-2.34v-3.9C17.75 5.8 15.35 3.1 12 3.1Z"
                        fill="none"
                        stroke="white"
                        strokeLinejoin="round"
                        strokeWidth="2.4"
                      />
                      <path
                        d="M10.2 3.35a1.8 1.8 0 0 1 3.6 0"
                        fill="none"
                        stroke="white"
                        strokeLinecap="round"
                        strokeWidth="2.4"
                      />
                    </svg>
                    {notificationBadgeCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-[#160663]">
                        {notificationBadgeCount > 9 ? "9+" : notificationBadgeCount}
                      </span>
                    ) : null}
                  </span>
                </button>
                {notificationsOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-[380px] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <div className="text-sm font-bold">Notifications</div>
                        <div className="text-xs text-slate-500">{notificationBadgeCount} needing attention</div>
                      </div>
                      <button onClick={markAllNotificationsRead} className="text-xs font-semibold text-violet-700">
                        Mark PO read
                      </button>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                      {calendarRequestCount > 0 ? (
                        <button
                          type="button"
                          onClick={openCalendarRequests}
                          className="block w-full border-b border-amber-100 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold">Calendar requests</div>
                              <div className="mt-1 text-sm text-slate-600">
                                {calendarRequestCount} request{calendarRequestCount === 1 ? "" : "s"} waiting for you to accept or decline.
                              </div>
                              <div className="mt-2 text-xs font-semibold text-violet-700">Open your calendar</div>
                            </div>
                            <span className="rounded-full bg-red-500 px-2 py-1 text-xs font-black text-white">
                              {calendarRequestCount}
                            </span>
                          </div>
                        </button>
                      ) : null}
                      {notifications.length === 0 && calendarRequestCount === 0 ? (
                        <div className="p-4 text-sm text-slate-500">No notifications yet.</div>
                      ) : (
                        notifications.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => openNotification(item)}
                            className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-violet-50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold">{item.title}</div>
                                <div className="mt-1 text-sm text-slate-600">{item.message || "No message"}</div>
                                <div className="mt-2 text-xs text-slate-400">{formatNotificationDate(item.created_at)}</div>
                              </div>
                              {!item.is_read ? <span className="mt-1 h-2 w-2 rounded-full bg-violet-600" /> : null}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
              <Link
                href={profileHref}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-violet-600 text-sm font-bold text-white ring-1 ring-white/10 transition hover:ring-white/40"
                title="Open profile"
              >
                {profilePhoto ? (
                  <img src={profilePhoto} alt={`${username} profile`} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </Link>
              <Link href={profileHref} className="hidden leading-tight text-white transition hover:text-white/80 md:block">
                <div className="text-sm font-semibold">{username}</div>
                <div className="text-xs text-white/65">{profileSubtitle}</div>
              </Link>
              <Link href="/account/password" className="hidden rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white md:block">
                Password
              </Link>
              <button onClick={logout} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-violet-800">
                Log out
              </button>
            </div>
          </div>
        </div>
        <div className="p-5">{children}</div>
      </main>
    </div>
  );
}

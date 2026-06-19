"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAuthHeaders, StoredUser } from "../lib/auth";

type CalendarView = "day" | "week" | "month" | "year";

type CalendarEvent = {
  id: number;
  owner_id: number;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  created_by?: {
    id: number;
    username: string;
    name: string;
  } | null;
};

type CalendarRequest = {
  id: number;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: "pending" | "accepted" | "declined";
  requested_by: {
    id: number;
    username: string;
    name: string;
  };
};

type StaffCalendarProps = {
  staffUser: StoredUser;
  currentUser: StoredUser | null;
  onRequestCountChange?: (count: number) => void;
  initialDate?: string;
  targetEventId?: number | null;
};

type EventFormState = {
  id?: number;
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
};

type StaffMentionUser = {
  id: number;
  username: string;
  profile?: {
    job_title?: string;
    company_email?: string;
  };
};

type CalendarCustomer = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  postcode?: string;
};

const API_BASE = "http://127.0.0.1:8000/api/staff-calendar";
const DAY_MS = 24 * 60 * 60 * 1000;
const viewOptions: CalendarView[] = ["day", "week", "month", "year"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(value: Date) {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toDateTimeInput(value: Date) {
  return `${localDateKey(value)}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(value: Date, amount: number) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function startOfWeek(value: Date) {
  const day = startOfDay(value);
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

function sameDay(left: Date, right: Date) {
  return localDateKey(left) === localDateKey(right);
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatTimeRange(event: CalendarEvent | CalendarRequest) {
  if (event.all_day) return "All day";
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  return `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function rangeForView(view: CalendarView, anchor: Date) {
  if (view === "day") {
    const start = startOfDay(anchor);
    return { start, end: addDays(start, 1) };
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 7) };
  }
  if (view === "year") {
    const start = new Date(anchor.getFullYear(), 0, 1);
    return { start, end: new Date(anchor.getFullYear() + 1, 0, 1) };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  return { start, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
}

function newFormForDay(day: Date): EventFormState {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0);
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0);
  return {
    title: "",
    description: "",
    location: "",
    start_at: toDateTimeInput(start),
    end_at: toDateTimeInput(end),
    all_day: false,
  };
}

function formFromEvent(event: CalendarEvent): EventFormState {
  return {
    id: event.id,
    title: event.title,
    description: event.description || "",
    location: event.location || "",
    start_at: toDateTimeInput(new Date(event.start_at)),
    end_at: toDateTimeInput(new Date(event.end_at)),
    all_day: event.all_day,
  };
}

function isoFromInput(value: string) {
  return new Date(value).toISOString();
}

export default function StaffCalendar({ staffUser, currentUser, onRequestCountChange, initialDate, targetEventId }: StaffCalendarProps) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => (initialDate ? new Date(`${initialDate}T12:00:00`) : new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [requests, setRequests] = useState<CalendarRequest[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffMentionUser[]>([]);
  const [customers, setCustomers] = useState<CalendarCustomer[]>([]);
  const [form, setForm] = useState<EventFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  const isOwnCalendar = currentUser?.id === staffUser.id;
  const pendingRequests = requests.filter((item) => item.status === "pending");

  const loadCalendar = useCallback(async () => {
    try {
      setError("");
      const range = rangeForView(view, anchor);
      const response = await fetch(
        `${API_BASE}/staff/${staffUser.id}/events/?start=${range.start.toISOString()}&end=${range.end.toISOString()}`,
        { headers: getAuthHeaders() }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load calendar.");
      setEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load calendar.");
      setEvents([]);
    }
  }, [anchor, staffUser.id, view]);

  const loadRequests = useCallback(async () => {
    if (!isOwnCalendar) return;
    try {
      const response = await fetch(`${API_BASE}/requests/?status=pending`, { headers: getAuthHeaders() });
      const data = await response.json();
      if (response.ok && data.success) {
        const nextRequests = Array.isArray(data.requests) ? data.requests : [];
        setRequests(nextRequests);
        onRequestCountChange?.(nextRequests.length);
      }
    } catch {
      setRequests([]);
      onRequestCountChange?.(0);
    }
  }, [isOwnCalendar, onRequestCountChange]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (initialDate) {
      setAnchor(new Date(`${initialDate}T12:00:00`));
      setView("month");
    }
  }, [initialDate]);

  useEffect(() => {
    async function loadMentionData() {
      try {
        const [staffResponse, customersResponse] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/auth/staff/", { headers: getAuthHeaders() }),
          fetch("http://127.0.0.1:8000/api/customers/", { headers: getAuthHeaders() }),
        ]);
        const staffData = await staffResponse.json();
        const customersData = await customersResponse.json();
        setStaffDirectory(Array.isArray(staffData.staff) ? staffData.staff : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
      } catch {
        setStaffDirectory([]);
        setCustomers([]);
      }
    }

    loadMentionData();
  }, []);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = localDateKey(new Date(event.start_at));
      grouped.set(key, [...(grouped.get(key) || []), event]);
    });
    return grouped;
  }, [events]);

  useEffect(() => {
    if (!targetEventId || !events.length) return;
    const element = document.getElementById(`calendar-event-${targetEventId}`);
    if (element) element.scrollIntoView({ block: "center" });
  }, [events, targetEventId]);

  const title = useMemo(() => {
    if (view === "day") {
      return anchor.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    }
    if (view === "week") {
      const start = startOfWeek(anchor);
      return `${formatShortDate(start)} - ${formatShortDate(addDays(start, 6))}`;
    }
    if (view === "year") return String(anchor.getFullYear());
    return anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  }, [anchor, view]);

  function move(amount: number) {
    if (view === "day") setAnchor((current) => addDays(current, amount));
    if (view === "week") setAnchor((current) => addDays(current, amount * 7));
    if (view === "month") setAnchor((current) => addMonths(current, amount));
    if (view === "year") setAnchor((current) => new Date(current.getFullYear() + amount, current.getMonth(), 1));
  }

  function openFormForDay(day: Date) {
    setForm(newFormForDay(day));
    setMessage("");
    setError("");
  }

  function openFormFromEvent(event: CalendarEvent) {
    setForm(formFromEvent(event));
    setMessage("");
    setError("");
  }

  function getNotesCommand() {
    if (!form) return null;
    const cursor = notesRef.current?.selectionStart ?? form.description.length;
    const textBeforeCursor = form.description.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/(?:^|\s)@([A-Za-z0-9_.-]*)$/);
    if (mentionMatch) {
      return {
        type: "staff" as const,
        query: (mentionMatch[1] || "").toLowerCase(),
        start: textBeforeCursor.lastIndexOf("@"),
        end: cursor,
      };
    }
    const customerMatch = textBeforeCursor.match(/(?:^|\s)\/([A-Za-z0-9_.-]*)$/);
    if (customerMatch) {
      return {
        type: "customer" as const,
        query: (customerMatch[1] || "").toLowerCase(),
        start: textBeforeCursor.lastIndexOf("/"),
        end: cursor,
      };
    }
    return null;
  }

  function updateDescriptionWithInsert(start: number, end: number, insertText: string) {
    if (!form) return;
    const nextDescription = `${form.description.slice(0, start)}${insertText}${form.description.slice(end)}`;
    setForm({ ...form, description: nextDescription });
    window.setTimeout(() => {
      const nextPosition = start + insertText.length;
      notesRef.current?.focus();
      notesRef.current?.setSelectionRange(nextPosition, nextPosition);
    }, 0);
  }

  function insertStaffMention(user: StaffMentionUser) {
    const command = getNotesCommand();
    if (!command || command.type !== "staff") return;
    updateDescriptionWithInsert(command.start, command.end, `@${user.username} `);
  }

  function insertCustomerLink(customer: CalendarCustomer) {
    const command = getNotesCommand();
    if (!command || command.type !== "customer") return;
    const label = `${customer.customer_uid || `Customer ${customer.id}`} - ${customer.business_name || "Unnamed customer"}`;
    updateDescriptionWithInsert(command.start, command.end, `${label}: http://localhost:3000/customers/${customer.id} `);
  }

  async function saveForm() {
    if (!form) return;
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        start_at: isoFromInput(form.start_at),
        end_at: isoFromInput(form.end_at),
        all_day: form.all_day,
      };
      const url = form.id ? `${API_BASE}/events/${form.id}/` : `${API_BASE}/staff/${staffUser.id}/${isOwnCalendar ? "events" : "requests"}/`;
      const response = await fetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not save calendar item.");
      setMessage(data.message || (isOwnCalendar ? "Calendar updated." : "Calendar request sent."));
      setForm(null);
      await loadCalendar();
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save calendar item.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(eventId: number) {
    if (!window.confirm("Delete this calendar event?")) return;
    try {
      setError("");
      const response = await fetch(`${API_BASE}/events/${eventId}/`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not delete event.");
      setMessage(data.message || "Calendar event deleted.");
      await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete event.");
    }
  }

  const notesCommand = form ? getNotesCommand() : null;
  const staffMentionResults = staffDirectory
    .filter((user) => {
      if (!notesCommand || notesCommand.type !== "staff") return false;
      const haystack = `${user.username} ${user.profile?.job_title || ""} ${user.profile?.company_email || ""}`.toLowerCase();
      return !notesCommand.query || haystack.includes(notesCommand.query);
    })
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, 8);
  const customerLinkResults = customers
    .filter((customer) => {
      if (!notesCommand || notesCommand.type !== "customer") return false;
      const haystack = `${customer.customer_uid} ${customer.business_name} ${customer.contact_name} ${customer.postcode || ""}`.toLowerCase();
      return !notesCommand.query || haystack.includes(notesCommand.query);
    })
    .sort((a, b) => a.business_name.localeCompare(b.business_name) || a.id - b.id)
    .slice(0, 8);

  async function decideRequest(requestId: number, action: "accept" | "decline") {
    try {
      setError("");
      const response = await fetch(`${API_BASE}/requests/${requestId}/${action}/`, {
        method: "POST",
        headers: getAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not update request.");
      setMessage(data.message || "Calendar request updated.");
      await loadRequests();
      await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update request.");
    }
  }

  function renderEvent(event: CalendarEvent) {
    return (
      <div
        key={event.id}
        id={`calendar-event-${event.id}`}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        className={`rounded-md border p-2 text-xs text-slate-800 ${
          targetEventId === event.id
            ? "border-amber-300 bg-amber-50 ring-2 ring-amber-300"
            : "border-violet-100 bg-violet-50"
        }`}
      >
        <div className="font-black text-slate-950">{event.title}</div>
        <div className="mt-1 font-semibold text-slate-500">{formatTimeRange(event)}</div>
        {event.location ? <div className="mt-1 truncate text-slate-500">{event.location}</div> : null}
        {targetEventId === event.id && event.description ? (
          <div className="mt-2 whitespace-pre-wrap rounded bg-white/70 p-2 text-slate-700">{event.description}</div>
        ) : null}
        {isOwnCalendar ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                openFormFromEvent(event);
              }}
              className="font-bold text-violet-700"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                deleteEvent(event.id);
              }}
              className="font-bold text-red-700"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderMonth() {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

    return (
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="border-b border-slate-200 bg-slate-50 px-2 py-2 text-xs font-black uppercase text-slate-500">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const key = localDateKey(day);
          const dayEvents = eventsByDay.get(key) || [];
          const outside = day.getMonth() !== anchor.getMonth();
          return (
            <div
              key={key}
              onClick={() => openFormForDay(day)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openFormForDay(day);
              }}
              className={`min-h-[118px] border-b border-r border-slate-100 p-2 text-left align-top hover:bg-violet-50 ${
                outside ? "bg-slate-50 text-slate-400" : "bg-white text-slate-950"
              }`}
            >
              <div className={`mb-2 text-sm font-black ${sameDay(day, new Date()) ? "text-violet-700" : ""}`}>{day.getDate()}</div>
              <div className="space-y-1">{dayEvents.slice(0, 3).map(renderEvent)}</div>
              {dayEvents.length > 3 ? <div className="mt-1 text-xs font-bold text-violet-700">+{dayEvents.length - 3} more</div> : null}
            </div>
          );
        })}
      </div>
    );
  }

  function renderDayList(days: Date[]) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDay.get(localDateKey(day)) || [];
          return (
            <div key={localDateKey(day)} className="min-h-[220px] rounded-lg border border-slate-200 bg-white p-3">
              <button type="button" onClick={() => openFormForDay(day)} className="w-full text-left">
                <div className="text-xs font-black uppercase text-slate-400">{day.toLocaleDateString("en-GB", { weekday: "short" })}</div>
                <div className="mt-1 text-lg font-black text-slate-950">{formatShortDate(day)}</div>
              </button>
              <div className="mt-3 space-y-2">
                {dayEvents.length ? dayEvents.map(renderEvent) : <div className="rounded-md border border-dashed border-slate-200 p-3 text-sm text-slate-500">Nothing booked.</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderYear() {
    const months = Array.from({ length: 12 }, (_, index) => new Date(anchor.getFullYear(), index, 1));
    return (
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {months.map((month) => {
          const monthEvents = events.filter((event) => {
            const eventDate = new Date(event.start_at);
            return eventDate.getMonth() === month.getMonth() && eventDate.getFullYear() === month.getFullYear();
          });
          return (
            <button
              key={month.toISOString()}
              type="button"
              onClick={() => {
                setAnchor(month);
                setView("month");
              }}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left hover:border-violet-300 hover:bg-violet-50"
            >
              <div className="text-lg font-black text-slate-950">{month.toLocaleDateString("en-GB", { month: "long" })}</div>
              <div className="mt-2 text-sm font-semibold text-slate-500">
                {monthEvents.length} event{monthEvents.length === 1 ? "" : "s"}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const body = view === "month"
    ? renderMonth()
    : view === "week"
    ? renderDayList(Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index)))
    : view === "day"
    ? renderDayList([anchor])
    : renderYear();

  return (
    <div className="space-y-4 rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">{staffUser.username} Calendar</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {isOwnCalendar ? "Your calendar. You can add, edit, and review requests." : "Public calendar. Click a day to request time on their calendar."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setView(option)}
              className={`rounded-lg px-3 py-2 text-xs font-black uppercase ${
                view === option ? "bg-violet-700 text-white" : "bg-violet-50 text-violet-800 hover:bg-violet-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
        <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-violet-50">
            Prev
          </button>
          <button type="button" onClick={() => setAnchor(new Date())} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-violet-50">
            Today
          </button>
          <button type="button" onClick={() => move(1)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold hover:bg-violet-50">
            Next
          </button>
        </div>
        <div className="text-lg font-black">{title}</div>
        <button type="button" onClick={() => openFormForDay(new Date())} className="rounded-md bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">
          {isOwnCalendar ? "Add Event" : "Request Event"}
        </button>
      </div>

      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div> : null}
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div> : null}

      {isOwnCalendar ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-slate-950">Calendar Requests</div>
              <div className="text-xs font-semibold text-slate-500">{pendingRequests.length} pending</div>
            </div>
          </div>
          {pendingRequests.length ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {pendingRequests.map((item) => (
                <div key={item.id} className="rounded-lg border border-amber-100 bg-white p-3">
                  <div className="text-sm font-black">{item.title}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {formatShortDate(new Date(item.start_at))} · {formatTimeRange(item)} · requested by {item.requested_by.username}
                  </div>
                  {item.description ? <div className="mt-2 text-sm text-slate-600">{item.description}</div> : null}
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => decideRequest(item.id, "accept")} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                      Accept
                    </button>
                    <button type="button" onClick={() => decideRequest(item.id, "decline")} className="rounded-md bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700">
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-dashed border-amber-200 bg-white/70 p-3 text-sm font-semibold text-slate-500">
              No calendar requests waiting.
            </div>
          )}
        </div>
      ) : null}

      {body}

      {form ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-[#120a2e]/80 px-4 pt-20 backdrop-blur-sm" onClick={() => setForm(null)}>
          <div className="w-full max-w-2xl rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black">{form.id ? "Edit Event" : isOwnCalendar ? "Add Calendar Event" : `Request Time With ${staffUser.username}`}</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {isOwnCalendar ? "This will appear on your public staff calendar." : `${staffUser.username} can accept or decline this request.`}
                </p>
              </div>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-600">Title</span>
                <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-500" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Start</span>
                <input type="datetime-local" value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-500" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">End</span>
                <input type="datetime-local" value={form.end_at} onChange={(event) => setForm({ ...form, end_at: event.target.value })} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-500" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold text-slate-600">Location</span>
                <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none focus:border-violet-500" />
              </label>
              <label className="flex items-center gap-3 pt-7 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={form.all_day} onChange={(event) => setForm({ ...form, all_day: event.target.checked })} className="h-4 w-4" />
                All day
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-600">Notes</span>
                <textarea
                  ref={notesRef}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  rows={5}
                  placeholder="Type @ to tag staff or / to link a customer..."
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus:border-violet-500"
                />
                {notesCommand?.type === "staff" ? (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {staffMentionResults.length ? (
                      staffMentionResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => insertStaffMention(user)}
                          className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-violet-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-bold text-slate-950">{user.username}</span>
                            <span className="block truncate text-xs text-slate-500">
                              {user.profile?.job_title || user.profile?.company_email || "Staff"}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm font-semibold text-slate-500">No staff match that name.</div>
                    )}
                  </div>
                ) : null}
                {notesCommand?.type === "customer" ? (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {customerLinkResults.length ? (
                      customerLinkResults.map((customer) => (
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
                    ) : (
                      <div className="px-3 py-2 text-sm font-semibold text-slate-500">No customers match that search.</div>
                    )}
                  </div>
                ) : null}
              </label>
            </div>
            <div className="mt-5 flex justify-between gap-3">
              {form.id ? (
                <button type="button" onClick={() => deleteEvent(form.id as number)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100">
                  Delete
                </button>
              ) : <span />}
              <div className="flex gap-3">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="button" onClick={saveForm} disabled={saving || !form.title.trim() || !form.start_at || !form.end_at} className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {saving ? "Saving..." : form.id ? "Save Event" : isOwnCalendar ? "Add Event" : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

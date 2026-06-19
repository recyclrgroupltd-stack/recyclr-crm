"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import StaffCalendar from "../../../components/StaffCalendar";
import StaffShell from "../../../components/StaffShell";
import { getAuthHeaders, getStoredUser, roleLabel, setStoredUser, StoredUser } from "../../../lib/auth";

function initialsFor(username: string) {
  return (
    username
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "ST"
  );
}

function fieldValue(value?: string) {
  return value?.trim() || "Not set";
}

type EmailAttachment = {
  filename: string;
  content_type: string;
  data: string;
  size: number;
};

type CustomerSearchRow = {
  id: number;
  customer_uid: string;
  business_name: string;
  contact_name: string;
  postcode?: string;
};

type StaffRecipient = {
  id: number;
  username: string;
  profile?: {
    company_email?: string;
    job_title?: string;
  };
};

export default function StaffProfilePage() {
  const params = useParams();
  const staffId = Number(params.id);

  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [staffUser, setStaffUser] = useState<StoredUser | null>(null);
  const [aboutMe, setAboutMe] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailCcOpen, setEmailCcOpen] = useState(false);
  const [emailTo, setEmailTo] = useState<string[]>([]);
  const [emailCc, setEmailCc] = useState<string[]>([]);
  const [emailToEntry, setEmailToEntry] = useState("");
  const [emailCcEntry, setEmailCcEntry] = useState("");
  const [activeRecipientField, setActiveRecipientField] = useState<"to" | "cc" | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<EmailAttachment[]>([]);
  const [customers, setCustomers] = useState<CustomerSearchRow[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<StaffRecipient[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState("");
  const [calendarTargetEventId, setCalendarTargetEventId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const emailBodyRef = useRef<HTMLTextAreaElement | null>(null);

  const isOwnProfile = currentUser?.id === staffId;
  const profile = staffUser?.profile || {};
  const title = staffUser?.username ? `${staffUser.username} Profile` : "Staff Profile";
  const profileInitials = initialsFor(staffUser?.username || "");

  const canSaveOwnProfile = useMemo(() => isOwnProfile && Boolean(staffUser), [isOwnProfile, staffUser]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setCalendarInitialDate(query.get("date") || "");
    setCalendarTargetEventId(Number(query.get("event")) || null);
  }, []);

  useEffect(() => {
    if (!currentUser || !staffUser) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("calendar") === "1" && !isOwnProfile) {
      setCalendarOpen(true);
    }
  }, [currentUser, isOwnProfile, staffUser]);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!staffId) return;

      try {
        setLoading(true);
        setError("");

        const response = await fetch(`http://127.0.0.1:8000/api/auth/profile/${staffId}/`, {
          headers: getAuthHeaders(),
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load staff profile.");
        }

        setStaffUser(data.user);
        setAboutMe(data.user?.profile?.about_me || "");
        setPhotoData(data.user?.profile?.photo_data || "");
        setEmailTo(data.user?.profile?.company_email ? [data.user.profile.company_email] : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load staff profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [staffId]);

  useEffect(() => {
    if (!emailOpen) return;

    async function loadComposeData() {
      try {
        const [customersResponse, staffResponse] = await Promise.all([
          fetch("http://127.0.0.1:8000/api/customers/", {
            headers: getAuthHeaders(),
          }),
          fetch("http://127.0.0.1:8000/api/auth/staff/", {
            headers: getAuthHeaders(),
          }),
        ]);
        const customersData = await customersResponse.json();
        const staffData = await staffResponse.json();
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setStaffDirectory(Array.isArray(staffData.staff) ? staffData.staff : []);
      } catch {
        setCustomers([]);
        setStaffDirectory([]);
      }
    }

    loadComposeData();
  }, [emailOpen]);

  function parseEmails(value: string) {
    return value
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function looksLikeEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function normaliseEmailList(values: string[]) {
    return Array.from(new Set(values.map((item) => item.trim()).filter((item) => item && looksLikeEmail(item))));
  }

  function addRecipients(field: "to" | "cc", values: string[]) {
    const cleanValues = normaliseEmailList(values);
    if (!cleanValues.length) return;

    if (field === "to") {
      setEmailTo((current) => normaliseEmailList([...current, ...cleanValues]));
      setEmailToEntry("");
    } else {
      setEmailCc((current) => normaliseEmailList([...current, ...cleanValues]));
      setEmailCcEntry("");
    }
  }

  function commitRecipientEntry(field: "to" | "cc") {
    const value = field === "to" ? emailToEntry : emailCcEntry;
    const addresses = parseEmails(value);
    const validAddresses = addresses.filter(looksLikeEmail);
    const invalidText = addresses.filter((item) => !looksLikeEmail(item)).join(", ");

    if (validAddresses.length) {
      if (field === "to") {
        setEmailTo((current) => normaliseEmailList([...current, ...validAddresses]));
        setEmailToEntry(invalidText);
      } else {
        setEmailCc((current) => normaliseEmailList([...current, ...validAddresses]));
        setEmailCcEntry(invalidText);
      }
    }
  }

  function removeRecipient(field: "to" | "cc", email: string) {
    if (field === "to") {
      setEmailTo((current) => current.filter((item) => item !== email));
    } else {
      setEmailCc((current) => current.filter((item) => item !== email));
    }
  }

  function handleRecipientKeyDown(event: KeyboardEvent<HTMLInputElement>, field: "to" | "cc") {
    if (["Enter", "Tab", ",", ";"].includes(event.key)) {
      const value = field === "to" ? emailToEntry : emailCcEntry;
      if (value.trim()) {
        event.preventDefault();
        commitRecipientEntry(field);
      }
    }
  }

  function insertRecipient(email: string) {
    if (!activeRecipientField) return;
    addRecipients(activeRecipientField, [email]);
    setActiveRecipientField(null);
  }

  function recipientChips(field: "to" | "cc") {
    const recipients = field === "to" ? emailTo : emailCc;
    const entry = field === "to" ? emailToEntry : emailCcEntry;
    const setEntry = field === "to" ? setEmailToEntry : setEmailCcEntry;

    return (
      <div
        className="mt-2 flex min-h-[48px] w-full flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-slate-950"
        onClick={() => setActiveRecipientField(field)}
      >
        {recipients.map((email) => (
          <span
            key={`${field}-${email}`}
            className="relative inline-flex max-w-full items-center rounded-md border border-violet-200 bg-white py-1 pl-2 pr-7 text-xs font-bold text-violet-950 shadow-sm"
          >
            <span className="max-w-[260px] truncate">{email}</span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeRecipient(field, email);
              }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black leading-none text-white shadow hover:bg-red-600"
              aria-label={`Remove ${email}`}
            >
              x
            </button>
          </span>
        ))}
        <input
          value={entry}
          onFocus={() => setActiveRecipientField(field)}
          onBlur={() => commitRecipientEntry(field)}
          onKeyDown={(event) => handleRecipientKeyDown(event, field)}
          onChange={(event) => {
            setEntry(event.target.value);
            setActiveRecipientField(field);
          }}
          placeholder={recipients.length ? "Add another..." : "name@recyclrgroup.co.uk, someone@example.com"}
          className="min-w-[180px] flex-1 bg-transparent px-1 py-1 text-sm font-semibold outline-none placeholder:text-slate-400"
        />
      </div>
    );
  }

  function recipientFieldSuggestions(field: "to" | "cc") {
    if (activeRecipientField !== field || recipientSuggestions.length === 0) return null;

    return (
      <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
        {recipientSuggestions.map((user) => {
          const email = user.profile?.company_email || "";

          return (
            <button
              key={user.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertRecipient(email)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-violet-50"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-950">{user.username}</span>
                <span className="block truncate text-xs text-slate-500">{email}</span>
              </span>
              {user.profile?.job_title ? (
                <span className="shrink-0 rounded-full bg-violet-100 px-2 py-1 text-[11px] font-black uppercase text-violet-800">
                  {user.profile.job_title}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  const recipientQuery = activeRecipientField === "to"
    ? emailToEntry.trim().toLowerCase()
    : activeRecipientField === "cc"
    ? emailCcEntry.trim().toLowerCase()
    : "";

  const recipientSuggestions = staffDirectory
    .filter((user) => {
      if (!activeRecipientField) return false;
      const email = user.profile?.company_email || "";
      if (!email) return false;
      if (emailTo.includes(email) || emailCc.includes(email)) return false;
      const haystack = `${user.username} ${email} ${user.profile?.job_title || ""}`.toLowerCase();
      return !recipientQuery || haystack.includes(recipientQuery);
    })
    .sort((a, b) => a.username.localeCompare(b.username))
    .slice(0, 8);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  async function saveOwnProfile() {
    if (!canSaveOwnProfile) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("http://127.0.0.1:8000/api/auth/profile/me/", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          about_me: aboutMe,
          photo_data: photoData,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save profile.");
      }

      setStaffUser(data.user);
      setCurrentUser(data.user);
      setStoredUser(data.user);
      setMessage(data.message || "Profile saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function sendStaffEmail() {
    if (!staffUser) return;

    try {
      setEmailSending(true);
      setEmailError("");
      setEmailMessage("");

      const response = await fetch("http://127.0.0.1:8000/api/communications/staff/send/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          recipient_id: staffUser.id,
          to_emails: normaliseEmailList([...emailTo, ...parseEmails(emailToEntry)]),
          cc_emails: normaliseEmailList([...emailCc, ...parseEmails(emailCcEntry)]),
          subject: emailSubject,
          body: emailBody,
          attachments: emailAttachments.map((attachment) => ({
            filename: attachment.filename,
            content_type: attachment.content_type,
            data: attachment.data,
          })),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send email.");
      }

      setEmailMessage(data.message || "Email sent successfully.");
      setEmailSubject("");
      setEmailBody("");
      setEmailTo(profile.company_email ? [profile.company_email] : []);
      setEmailCc([]);
      setEmailToEntry("");
      setEmailCcEntry("");
      setEmailCcOpen(false);
      setEmailAttachments([]);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setEmailSending(false);
    }
  }

  function getCustomerSearch() {
    const cursor = emailBodyRef.current?.selectionStart ?? emailBody.length;
    const textBeforeCursor = emailBody.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)\/([A-Za-z0-9_.-]*)$/);
    if (!match) return null;
    const start = textBeforeCursor.lastIndexOf("/");
    return {
      query: (match[1] || "").toLowerCase().trim(),
      start,
      end: cursor,
    };
  }

  function insertCustomerLink(customer: CustomerSearchRow) {
    const command = getCustomerSearch();
    if (!command) return;
    const label = `${customer.customer_uid || `Customer ${customer.id}`} - ${customer.business_name}`;
    const insertText = `${label}: http://localhost:3000/customers/${customer.id} `;
    const nextBody = `${emailBody.slice(0, command.start)}${insertText}${emailBody.slice(command.end)}`;
    setEmailBody(nextBody);
    window.setTimeout(() => {
      const nextPosition = command.start + insertText.length;
      emailBodyRef.current?.focus();
      emailBodyRef.current?.setSelectionRange(nextPosition, nextPosition);
    }, 0);
  }

  function handleEmailAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setEmailAttachments((current) => [
          ...current,
          {
            filename: file.name,
            content_type: file.type || "application/octet-stream",
            data: typeof reader.result === "string" ? reader.result : "",
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    event.target.value = "";
  }

  function removeEmailAttachment(filename: string, index: number) {
    setEmailAttachments((current) => current.filter((item, itemIndex) => item.filename !== filename || itemIndex !== index));
  }

  const customerSearch = emailOpen ? getCustomerSearch() : null;
  const customerResults = customers
    .filter((customer) => {
      if (!customerSearch) return false;
      const haystack = `${customer.customer_uid} ${customer.business_name} ${customer.contact_name} ${customer.postcode || ""}`.toLowerCase();
      return !customerSearch.query || haystack.includes(customerSearch.query);
    })
    .sort((a, b) => a.business_name.localeCompare(b.business_name) || a.id - b.id)
    .slice(0, 8);

  return (
    <StaffShell title={title}>
      {loading ? (
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          Loading staff profile...
        </div>
      ) : error && !staffUser ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 font-semibold text-red-800">
          {error}
        </div>
      ) : staffUser ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="rounded-lg border border-violet-100 bg-white p-6 text-slate-950 shadow-sm">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-violet-700 text-3xl font-black text-white">
                  {photoData ? (
                    <img src={photoData} alt={`${staffUser.username} profile`} className="h-full w-full object-cover" />
                  ) : (
                    profileInitials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="break-words text-3xl font-black">{staffUser.username}</h1>
                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold uppercase text-violet-800">
                      {roleLabel(staffUser)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        staffUser.is_active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {staffUser.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-700">
                    {fieldValue(profile.job_title)}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                    Staff profile with contact details, role information, photo, and a short introduction.
                  </p>
                  {!isOwnProfile ? (
                    <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setCalendarOpen((current) => !current)}
                      className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-800"
                    >
                      {calendarOpen ? "Hide Calendar" : "Open Calendar"}
                    </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {calendarOpen && !isOwnProfile ? (
              <StaffCalendar
                staffUser={staffUser}
                currentUser={currentUser}
                initialDate={calendarInitialDate || undefined}
                targetEventId={calendarTargetEventId}
              />
            ) : null}

            <div className="rounded-lg border border-violet-100 bg-white p-6 text-slate-950 shadow-sm">
              <h2 className="text-xl font-bold">About Me</h2>
              {isOwnProfile ? (
                <div className="mt-4 space-y-4">
                  <textarea
                    value={aboutMe}
                    onChange={(event) => setAboutMe(event.target.value)}
                    rows={8}
                    placeholder="Add a short intro, what you do, where you are based, and anything useful for other staff..."
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={saveOwnProfile}
                      disabled={saving}
                      className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Profile"}
                    </button>
                    {message ? <span className="text-sm font-semibold text-emerald-700">{message}</span> : null}
                    {error ? <span className="text-sm font-semibold text-red-700">{error}</span> : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-700">
                  {fieldValue(profile.about_me)}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="text-lg font-bold">Contact Details</h2>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    if (profile.company_email) {
                      setEmailTo([profile.company_email]);
                      setEmailCc([]);
                      setEmailToEntry("");
                      setEmailCcEntry("");
                      setEmailCcOpen(false);
                      setActiveRecipientField(null);
                      setEmailOpen(true);
                      setEmailMessage("");
                      setEmailError("");
                    }
                  }}
                  disabled={!profile.company_email}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-slate-50"
                >
                  <div className="text-xs font-bold uppercase text-slate-500">Company Email</div>
                  <div className="mt-1 break-words text-sm font-black text-violet-800">{fieldValue(profile.company_email)}</div>
                  {profile.company_email ? (
                    <div className="mt-2 text-xs font-semibold text-slate-500">Click to email in CRM</div>
                  ) : null}
                </button>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Company Number</div>
                  <div className="mt-1 text-sm font-black">{fieldValue(profile.company_phone)}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-bold uppercase text-slate-500">Job Title</div>
                  <div className="mt-1 text-sm font-black">{fieldValue(profile.job_title)}</div>
                </div>
              </div>
              <p className="mt-4 text-xs font-medium text-slate-500">
                Email, company number, and job title are controlled by an admin from the Staff page.
              </p>
            </div>

            {isOwnProfile ? (
              <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
                <h2 className="text-lg font-bold">Profile Photo</h2>
                <div className="mt-4 space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="block w-full text-sm font-semibold text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-violet-700 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-violet-800"
                  />
                  {photoData ? (
                    <button
                      type="button"
                      onClick={() => setPhotoData("")}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
                    >
                      Remove Photo
                    </button>
                  ) : null}
                  <p className="text-xs font-medium text-slate-500">
                    Choose a clear photo so other depots can recognise you.
                  </p>
                </div>
              </div>
            ) : null}

            <Link
              href="/staff"
              className="block rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-violet-800 shadow-sm transition hover:bg-violet-50"
            >
              Back to Staff
            </Link>
          </div>
        </div>
      ) : null}

      {emailOpen && staffUser ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-[#120a2e]/80 px-4 pt-24 backdrop-blur-sm"
          onClick={() => setEmailOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Email {staffUser.username}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500">{profile.company_email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-600">To</label>
                  <button
                    type="button"
                    onClick={() => setEmailCcOpen((current) => !current)}
                    className="text-xs font-bold text-violet-700 hover:text-violet-900"
                  >
                    {emailCcOpen ? "Hide CC" : "Add CC"}
                  </button>
                </div>
                {recipientChips("to")}
                {recipientFieldSuggestions("to")}
              </div>

              {emailCcOpen ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-600">CC</label>
                  {recipientChips("cc")}
                  {recipientFieldSuggestions("cc")}
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-600">Subject</label>
                <input
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                  placeholder="Email subject"
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-600">Message</label>
                  <span className="text-xs font-semibold text-slate-500">Type / to link a customer</span>
                </div>
                <textarea
                  ref={emailBodyRef}
                  value={emailBody}
                  onChange={(event) => setEmailBody(event.target.value)}
                  placeholder="Write your email here..."
                  rows={8}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                />
                {customerSearch ? (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                    {customerResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm font-semibold text-slate-500">No customers match that search.</div>
                    ) : (
                      customerResults.map((customer) => (
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
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-700">Attachments</div>
                    <div className="text-xs font-medium text-slate-500">Images and documents, up to 15 MB total.</div>
                  </div>
                  <label className="cursor-pointer rounded-lg bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800">
                    Attach Files
                    <input
                      type="file"
                      multiple
                      onChange={handleEmailAttachmentChange}
                      className="hidden"
                    />
                  </label>
                </div>
                {emailAttachments.length ? (
                  <div className="mt-3 space-y-2">
                    {emailAttachments.map((attachment, index) => (
                      <div key={`${attachment.filename}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                        <span className="min-w-0 truncate font-semibold text-slate-700">
                          {attachment.filename}
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEmailAttachment(attachment.filename, index)}
                          className="text-xs font-bold text-red-700 hover:text-red-900"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {emailMessage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  {emailMessage}
                </div>
              ) : null}
              {emailError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                  {emailError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEmailOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={sendStaffEmail}
                  disabled={emailSending || normaliseEmailList([...emailTo, ...parseEmails(emailToEntry)]).length === 0 || !emailSubject.trim() || !emailBody.trim()}
                  className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {emailSending ? "Sending..." : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </StaffShell>
  );
}

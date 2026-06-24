"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { getAuthHeaders, getStoredUser } from "../../lib/auth";

type MailFolder = {
  id: string;
  label: string;
  total: number;
  unread: number;
  custom?: boolean;
};

type MailAttachment = {
  id: string;
  filename: string;
  content_type: string;
  size: number;
};

type MailMessage = {
  id: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc?: string;
  date: string;
  snippet: string;
  body: string;
  body_type: "text" | "html";
  plain_body?: string;
  is_unread: boolean;
  is_flagged: boolean;
  has_attachments: boolean;
  attachments: MailAttachment[];
};

type ComposeState = {
  to: string[];
  cc: string[];
  bcc: string[];
  showCc: boolean;
  showBcc: boolean;
  subject: string;
  body: string;
};

type AttachmentPayload = {
  filename: string;
  content_type: string;
  content_base64: string;
};

type MailRule = {
  id: number;
  name: string;
  field: "from" | "to" | "subject";
  contains: string;
  target_folder: string;
  mark_read: boolean;
  active: boolean;
};

type RuleDraft = {
  name: string;
  field: "from" | "to" | "subject";
  contains: string;
  target_folder: string;
  mark_read: boolean;
};

type ContextMenuState = {
  x: number;
  y: number;
  message: MailMessage;
} | null;

const API_BASE = "/api/email";

const defaultFolders: MailFolder[] = [
  { id: "inbox", label: "Inbox", total: 0, unread: 0 },
  { id: "sent", label: "Sent", total: 0, unread: 0 },
  { id: "drafts", label: "Drafts", total: 0, unread: 0 },
  { id: "archive", label: "Archive", total: 0, unread: 0 },
  { id: "spam", label: "Spam", total: 0, unread: 0 },
  { id: "trash", label: "Trash", total: 0, unread: 0 },
];

const emptyCompose: ComposeState = {
  to: [],
  cc: [],
  bcc: [],
  showCc: false,
  showBcc: false,
  subject: "",
  body: "",
};

function uniqueAddresses(addresses: string[]) {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = address.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function splitAddressText(value: string) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function displayDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(size: number) {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToPayload(file: File): Promise<AttachmentPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        content_base64: result,
      });
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function AddressInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(value = draft) {
    const next = splitAddressText(value);
    if (!next.length) return;
    onChange(uniqueAddresses([...values, ...next]));
    setDraft("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === ";") {
      event.preventDefault();
      commit();
    }
    if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-600">{label}</label>
      <div className="flex min-h-[46px] flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
        {values.map((address) => (
          <span
            key={address}
            className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-white px-2 py-1 text-sm font-bold text-slate-800"
          >
            {address}
            <button
              type="button"
              onClick={() => onChange(values.filter((item) => item !== address))}
              className="rounded-sm px-1 text-xs font-black text-red-600 hover:bg-red-50"
              aria-label={`Remove ${address}`}
            >
              x
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={onKeyDown}
          placeholder={values.length ? "" : placeholder}
          className="min-w-[220px] flex-1 bg-transparent px-1 py-1 text-sm font-semibold text-slate-900 outline-none"
        />
      </div>
    </div>
  );
}

export default function CrmEmailPage() {
  const [mailbox, setMailbox] = useState("");
  const [folders, setFolders] = useState<MailFolder[]>(defaultFolders);
  const [folder, setFolder] = useState("inbox");
  const [messages, setMessages] = useState<MailMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [compose, setCompose] = useState<ComposeState>(emptyCompose);
  const [files, setFiles] = useState<File[]>([]);
  const [search, setSearch] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showFolderForm, setShowFolderForm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState<MailRule[]>([]);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>({
    name: "",
    field: "from",
    contains: "",
    target_folder: "archive",
    mark_read: false,
  });
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMessage = useMemo(
    () => messages.find((item) => item.id === selectedId) || null,
    [messages, selectedId]
  );

  const currentFolder = folders.find((item) => item.id === folder) || defaultFolders[0];

  const localDraftKey = useMemo(() => {
    const username = getStoredUser()?.username || "staff";
    return `recyclr_email_draft_${username}`;
  }, []);

  useEffect(() => {
    const savedDraft = window.localStorage.getItem(localDraftKey);
    if (savedDraft) {
      try {
        setCompose(JSON.parse(savedDraft));
      } catch {
        setCompose(emptyCompose);
      }
    }
  }, [localDraftKey]);

  useEffect(() => {
    window.localStorage.setItem(localDraftKey, JSON.stringify(compose));
  }, [compose, localDraftKey]);

  async function loadFolders() {
    try {
      const response = await fetch(`${API_BASE}/folders/`, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load folders.");
      setMailbox(data.mailbox || "");
      setFolders(Array.isArray(data.folders) && data.folders.length ? data.folders : defaultFolders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load folders.");
    }
  }

  async function loadRules() {
    try {
      const response = await fetch(`${API_BASE}/rules/`, { headers: getAuthHeaders() });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load rules.");
      setRules(Array.isArray(data.rules) ? data.rules : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rules.");
    }
  }

  async function loadMessages(nextFolder = folder, nextSearch = search) {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      if (nextFolder === "drafts") {
        setFolder(nextFolder);
        setMessages([]);
        setSelectedId("");
        setComposeOpen(true);
        return;
      }

      const params = new URLSearchParams({ folder: nextFolder, limit: "75" });
      if (nextSearch.trim()) params.set("search", nextSearch.trim());
      const response = await fetch(`${API_BASE}/messages/?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load mailbox.");

      setMailbox(data.mailbox || "");
      setFolder(nextFolder);
      const nextMessages = Array.isArray(data.messages) ? data.messages : [];
      setMessages(nextMessages);
      setSelectedId(nextMessages[0]?.id || "");
      setComposeOpen(false);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load mailbox.");
      setMessages([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolders();
    loadRules();
    loadMessages("inbox", "");
  }, []);

  async function postMessageAction(action: string, body?: Record<string, unknown>, targetMessage = selectedMessage) {
    if (!targetMessage) return;
    setActing(true);
    setError("");
    setMessage("");
    setContextMenu(null);
    try {
      const response = await fetch(`${API_BASE}/messages/${folder}/${targetMessage.id}/${action}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body || {}),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Email action failed.");
      setMessage(data.message || "Email updated.");
      await loadMessages(folder, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email action failed.");
    } finally {
      setActing(false);
    }
  }

  async function markSelectedRead(isRead: boolean) {
    await postMessageAction("read", { is_read: isRead });
  }

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/folders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not create folder.");
      setMessage(data.message || "Folder created.");
      setNewFolderName("");
      setShowFolderForm(false);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create folder.");
    }
  }

  async function saveRule() {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/rules/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(ruleDraft),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not save rule.");
      setMessage(data.message || "Rule saved.");
      setRuleDraft({ name: "", field: "from", contains: "", target_folder: "archive", mark_read: false });
      await loadRules();
      await loadFolders();
      await loadMessages(folder, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rule.");
    }
  }

  async function deleteRule(ruleId: number) {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/rules/${ruleId}/delete/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not delete rule.");
      setMessage(data.message || "Rule deleted.");
      await loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete rule.");
    }
  }

  async function applyRules() {
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/rules/apply/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not apply rules.");
      setMessage(data.message || "Rules applied.");
      await loadFolders();
      await loadMessages(folder, search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply rules.");
    }
  }

  function composeNew() {
    setComposeOpen(true);
    setSelectedId("");
  }

  function replyToSelected(replyAll = false, targetMessage = selectedMessage) {
    if (!targetMessage) return;
    setCompose({
      to: uniqueAddresses([targetMessage.from]),
      cc: replyAll ? uniqueAddresses(splitAddressText(targetMessage.cc || targetMessage.to)) : [],
      bcc: [],
      showCc: replyAll && Boolean(targetMessage.cc || targetMessage.to),
      showBcc: false,
      subject: targetMessage.subject.toLowerCase().startsWith("re:") ? targetMessage.subject : `Re: ${targetMessage.subject}`,
      body: `\n\n---- Original message ----\n${targetMessage.plain_body || targetMessage.snippet}`,
    });
    setComposeOpen(true);
  }

  function forwardSelected(targetMessage = selectedMessage) {
    if (!targetMessage) return;
    setCompose({
      to: [],
      cc: [],
      bcc: [],
      showCc: false,
      showBcc: false,
      subject: targetMessage.subject.toLowerCase().startsWith("fw:") ? targetMessage.subject : `Fw: ${targetMessage.subject}`,
      body: `\n\n---- Forwarded message ----\nFrom: ${targetMessage.from}\nTo: ${targetMessage.to}\n\n${
        targetMessage.plain_body || targetMessage.snippet
      }`,
    });
    setComposeOpen(true);
  }

  async function sendEmail() {
    setSending(true);
    setError("");
    setMessage("");

    try {
      const attachmentPayloads = await Promise.all(files.map(fileToPayload));
      const response = await fetch(`${API_BASE}/send/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          to: compose.to,
          cc: compose.cc,
          bcc: compose.bcc,
          subject: compose.subject,
          body: compose.body,
          attachments: attachmentPayloads,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not send email.");

      setMessage(data.message || "Email sent.");
      setCompose(emptyCompose);
      setFiles([]);
      window.localStorage.removeItem(localDraftKey);
      setComposeOpen(false);
      await loadFolders();
      if (folder === "sent") await loadMessages("sent", search);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  }

  async function downloadAttachment(attachment: MailAttachment) {
    if (!selectedMessage) return;
    try {
      const response = await fetch(
        `${API_BASE}/messages/${folder}/${selectedMessage.id}/attachments/${attachment.id}/`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error("Could not download attachment.");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download attachment.");
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles((current) => uniqueFiles([...current, ...Array.from(event.target.files || [])]));
    event.target.value = "";
  }

  function uniqueFiles(nextFiles: File[]) {
    const seen = new Set<string>();
    return nextFiles.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return (
    <StaffShell title="Email">
      <div className="space-y-5" onClick={() => setContextMenu(null)}>
        <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black">CRM Email</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                {mailbox || "Your Recyclr mailbox"} via Zoho Mail.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  loadFolders();
                  loadRules();
                  loadMessages(folder, search);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowRules((current) => !current)}
                className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-100"
              >
                Rules
              </button>
              <button
                type="button"
                onClick={composeNew}
                className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-800"
              >
                Compose
              </button>
            </div>
          </div>
        </div>

        {(error || message) && (
          <div
            className={`rounded-lg border p-4 text-sm font-bold ${
              error
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            }`}
          >
            {error || message}
          </div>
        )}

        {showRules ? (
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black">Email Rules</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Automatically move inbox emails when the sender, recipient, or subject matches.
                </p>
              </div>
              <button
                type="button"
                onClick={applyRules}
                className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 hover:bg-violet-100"
              >
                Apply Rules Now
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_420px]">
              <div className="rounded-lg border border-slate-200">
                <div className="grid grid-cols-[1fr_120px_1fr_160px_90px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wide text-slate-500">
                  <span>Name</span>
                  <span>Field</span>
                  <span>Contains</span>
                  <span>Move To</span>
                  <span></span>
                </div>
                <div className="max-h-[220px] overflow-y-auto">
                  {rules.length ? (
                    rules.map((rule) => (
                      <div
                        key={rule.id}
                        className="grid grid-cols-[1fr_120px_1fr_160px_90px] items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-semibold"
                      >
                        <span className="font-black">{rule.name}</span>
                        <span className="capitalize text-slate-600">{rule.field}</span>
                        <span className="truncate text-slate-600">{rule.contains}</span>
                        <span className="truncate text-slate-600">
                          {folders.find((item) => item.id === rule.target_folder)?.label || rule.target_folder}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="rounded-md bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm font-semibold text-slate-500">No rules yet.</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-black uppercase tracking-wide text-slate-500">New Rule</div>
                <div className="mt-3 space-y-3">
                  <input
                    value={ruleDraft.name}
                    onChange={(event) => setRuleDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Rule name"
                    className="w-full rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm font-semibold outline-none"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ruleDraft.field}
                      onChange={(event) =>
                        setRuleDraft((current) => ({ ...current, field: event.target.value as RuleDraft["field"] }))
                      }
                      className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm font-semibold outline-none"
                    >
                      <option value="from">From</option>
                      <option value="to">To</option>
                      <option value="subject">Subject</option>
                    </select>
                    <select
                      value={ruleDraft.target_folder}
                      onChange={(event) => setRuleDraft((current) => ({ ...current, target_folder: event.target.value }))}
                      className="rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm font-semibold outline-none"
                    >
                      {folders
                        .filter((item) => item.id !== "drafts")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                    </select>
                  </div>
                  <input
                    value={ruleDraft.contains}
                    onChange={(event) => setRuleDraft((current) => ({ ...current, contains: event.target.value }))}
                    placeholder="Text to match"
                    className="w-full rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm font-semibold outline-none"
                  />
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={ruleDraft.mark_read}
                      onChange={(event) => setRuleDraft((current) => ({ ...current, mark_read: event.target.checked }))}
                    />
                    Mark matching emails as read
                  </label>
                  <button
                    type="button"
                    onClick={saveRule}
                    disabled={!ruleDraft.name || !ruleDraft.contains || !ruleDraft.target_folder}
                    className="w-full rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid min-h-[760px] overflow-hidden rounded-lg border border-violet-100 bg-white shadow-sm xl:grid-cols-[230px_430px_1fr]">
          <div className="border-r border-slate-100 bg-slate-50 p-4 text-slate-950">
            <div className="text-sm font-black uppercase tracking-wide text-slate-500">Folders</div>
            <div className="mt-4 space-y-2">
              {folders.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => loadMessages(item.id, search)}
                  className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-black ${
                    folder === item.id
                      ? "bg-violet-700 text-white"
                      : "bg-violet-50 text-slate-800 hover:bg-violet-100"
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-2">
                    {item.unread ? (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{item.unread}</span>
                    ) : null}
                    <span className={folder === item.id ? "text-white/80" : "text-slate-400"}>{item.total}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              {showFolderForm ? (
                <div className="space-y-2">
                  <input
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        createFolder();
                      }
                    }}
                    placeholder="New folder name"
                    className="w-full rounded-lg border border-violet-100 bg-white px-3 py-2 text-sm font-semibold outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={createFolder}
                      className="flex-1 rounded-lg bg-violet-700 px-3 py-2 text-xs font-black text-white"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFolderForm(false)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowFolderForm(true)}
                  className="w-full rounded-lg border border-dashed border-violet-300 bg-white px-4 py-3 text-left text-sm font-black text-violet-700 hover:bg-violet-50"
                >
                  + New Folder
                </button>
              )}
            </div>
          </div>

          <div className="border-r border-slate-100 bg-white text-slate-950">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">{currentFolder.label}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {loading ? "Loading..." : `${messages.length} loaded`}
                  </div>
                </div>
                {selectedMessage ? (
                  <button
                    type="button"
                    onClick={() => markSelectedRead(!selectedMessage.is_unread)}
                    disabled={acting}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    {selectedMessage.is_unread ? "Mark read" : "Unread"}
                  </button>
                ) : null}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadMessages(folder, search);
                }}
              >
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search mail..."
                  className="min-w-0 flex-1 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="max-h-[680px] overflow-y-auto p-2">
              {loading ? (
                <div className="p-4 text-sm font-semibold text-slate-500">Loading mailbox...</div>
              ) : messages.length === 0 ? (
                <div className="p-4 text-sm font-semibold text-slate-500">
                  {folder === "drafts" ? "Your local draft opens on the right." : "No messages to show."}
                </div>
              ) : (
                messages.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedId(item.id);
                      setComposeOpen(false);
                      setContextMenu({ x: event.clientX, y: event.clientY, message: item });
                    }}
                    onClick={() => {
                      setSelectedId(item.id);
                      setComposeOpen(false);
                      setContextMenu(null);
                    }}
                    className={`mb-2 w-full rounded-lg border p-3 text-left ${
                      selectedId === item.id
                        ? "border-violet-400 bg-violet-50"
                        : item.is_unread
                        ? "border-blue-100 bg-blue-50"
                        : "border-transparent bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`truncate text-sm ${item.is_unread ? "font-black" : "font-bold"}`}>
                        {item.subject}
                      </div>
                      <div className="shrink-0 text-[11px] font-bold text-slate-400">{displayDate(item.date)}</div>
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                      {folder === "sent" ? item.to : item.from}
                    </div>
                    <div className="mt-2 line-clamp-2 text-xs text-slate-500">{item.snippet}</div>
                    {item.has_attachments ? (
                      <div className="mt-2 text-xs font-black text-violet-700">Attachment</div>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-5 text-slate-950">
            {composeOpen ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black">Compose Email</h2>
                  <button
                    type="button"
                    onClick={() => setComposeOpen(false)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
                  >
                    Close
                  </button>
                </div>

                <AddressInput
                  label="To"
                  values={compose.to}
                  onChange={(next) => setCompose((current) => ({ ...current, to: next }))}
                  placeholder="Type email, then press Enter"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCompose((current) => ({ ...current, showCc: !current.showCc }))}
                    className="text-sm font-black text-violet-700"
                  >
                    {compose.showCc ? "Hide CC" : "Add CC"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompose((current) => ({ ...current, showBcc: !current.showBcc }))}
                    className="text-sm font-black text-violet-700"
                  >
                    {compose.showBcc ? "Hide BCC" : "Add BCC"}
                  </button>
                </div>

                {compose.showCc ? (
                  <AddressInput
                    label="CC"
                    values={compose.cc}
                    onChange={(next) => setCompose((current) => ({ ...current, cc: next }))}
                    placeholder="Type CC email, then press Enter"
                  />
                ) : null}

                {compose.showBcc ? (
                  <AddressInput
                    label="BCC"
                    values={compose.bcc}
                    onChange={(next) => setCompose((current) => ({ ...current, bcc: next }))}
                    placeholder="Type BCC email, then press Enter"
                  />
                ) : null}

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-600">Subject</label>
                  <input
                    value={compose.subject}
                    onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))}
                    placeholder="Email subject"
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-600">Message</label>
                  <textarea
                    rows={12}
                    value={compose.body}
                    onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))}
                    placeholder="Write your email..."
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black">Attachments</div>
                      <div className="text-xs font-semibold text-slate-500">Images, PDFs, Word files, and documents.</div>
                    </div>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileChange} />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800"
                    >
                      Attach Files
                    </button>
                  </div>
                  {files.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {files.map((file) => (
                        <span
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                        >
                          {file.name} {formatBytes(file.size)}
                          <button
                            type="button"
                            onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                            className="text-red-600"
                          >
                            x
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCompose(emptyCompose);
                      setFiles([]);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={sendEmail}
                    disabled={sending || !compose.to.length || !compose.subject || !compose.body}
                    className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {sending ? "Sending..." : "Send Email"}
                  </button>
                </div>
              </div>
            ) : selectedMessage ? (
              <div>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-xl font-black">{selectedMessage.subject}</h2>
                      <div className="mt-2 text-sm font-semibold text-slate-500">From: {selectedMessage.from}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-500">To: {selectedMessage.to}</div>
                      {selectedMessage.cc ? (
                        <div className="mt-1 text-sm font-semibold text-slate-500">CC: {selectedMessage.cc}</div>
                      ) : null}
                      <div className="mt-1 text-xs font-bold text-slate-400">{displayDate(selectedMessage.date)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => replyToSelected(false)}
                        className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-black text-white hover:bg-violet-800"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => replyToSelected(true)}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                      >
                        Reply All
                      </button>
                      <button
                        type="button"
                        onClick={() => forwardSelected()}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50"
                      >
                        Forward
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => postMessageAction("archive")}
                      disabled={acting || folder === "archive"}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      onClick={() => postMessageAction("delete")}
                      disabled={acting}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40"
                    >
                      Delete
                    </button>
                    <select
                      value=""
                      onChange={(event) => {
                        if (event.target.value) postMessageAction("move", { target_folder: event.target.value });
                      }}
                      disabled={acting}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700"
                    >
                      <option value="">Move to...</option>
                      {folders
                        .filter((item) => item.id !== folder && item.id !== "drafts")
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                    >
                      Print
                    </button>
                  </div>
                </div>

                {selectedMessage.attachments?.length ? (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm font-black">Attachments</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedMessage.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={() => downloadAttachment(attachment)}
                          className="rounded-md border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50"
                        >
                          {attachment.filename} {formatBytes(attachment.size)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedMessage.body_type === "html" ? (
                  <iframe
                    title={selectedMessage.subject}
                    sandbox=""
                    srcDoc={selectedMessage.body}
                    className="mt-5 h-[640px] w-full rounded-lg border border-slate-200 bg-white"
                  />
                ) : (
                  <pre className="mt-5 whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-7 text-slate-800">
                    {selectedMessage.body || selectedMessage.snippet || "No readable message body found."}
                  </pre>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                Select a message or compose a new email.
              </div>
            )}
          </div>
        </div>

        {contextMenu ? (
          <div
            className="fixed z-50 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-2xl"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="truncate text-sm font-black">{contextMenu.message.subject}</div>
              <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                {folder === "sent" ? contextMenu.message.to : contextMenu.message.from}
              </div>
            </div>
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedId(contextMenu.message.id);
                  replyToSelected(false, contextMenu.message);
                  setContextMenu(null);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-violet-50"
              >
                Reply
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(contextMenu.message.id);
                  forwardSelected(contextMenu.message);
                  setContextMenu(null);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-violet-50"
              >
                Forward
              </button>
              <button
                type="button"
                onClick={() =>
                  postMessageAction("read", { is_read: !contextMenu.message.is_unread }, contextMenu.message)
                }
                className="w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-violet-50"
              >
                {contextMenu.message.is_unread ? "Mark as read" : "Mark as unread"}
              </button>
              <button
                type="button"
                onClick={() => postMessageAction("archive", {}, contextMenu.message)}
                disabled={folder === "archive"}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-violet-50 disabled:opacity-40"
              >
                Archive
              </button>
              <div className="my-2 border-t border-slate-100 pt-2">
                <label className="px-3 text-xs font-black uppercase tracking-wide text-slate-400">Move to</label>
                <select
                  value=""
                  onChange={(event) => {
                    if (event.target.value) {
                      postMessageAction("move", { target_folder: event.target.value }, contextMenu.message);
                    }
                  }}
                  className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none"
                >
                  <option value="">Choose folder...</option>
                  {folders
                    .filter((item) => item.id !== folder && item.id !== "drafts")
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(contextMenu.message.id);
                  window.print();
                  setContextMenu(null);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-bold hover:bg-violet-50"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => postMessageAction("delete", {}, contextMenu.message)}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-black text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </StaffShell>
  );
}

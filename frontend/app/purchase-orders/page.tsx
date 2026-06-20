"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import StaffShell from "@/components/StaffShell";
import { getAuthHeaders } from "@/lib/auth";

type Supplier = {
  id: number;
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  notes: string;
  active: boolean;
  created_at: string;
  purchase_order_count: number;
};

type PurchaseOrderLine = {
  id?: number;
  description: string;
  quantity: number;
  unit_cost: number;
  line_total?: number;
  line_order?: number;
};

type PurchaseOrder = {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  requested_by: string;
  status: "draft" | "pending" | "approved" | "rejected" | "received" | "cancelled";
  status_label: string;
  notes: string;
  approval_note: string;
  approved_by: string;
  approved_at: string;
  received_by: string;
  received_at: string;
  received_note: string;
  supplier_reference: string;
  received_proof_url: string;
  line_count: number;
  subtotal: number;
  vat_amount: number;
  total_inc_vat: number;
  total: number;
  created_at: string;
  updated_at: string;
  lines: PurchaseOrderLine[];
};

type OrderFormLine = {
  description: string;
  quantity: string;
  unit_cost: string;
};

type DecisionModalState = {
  open: boolean;
  action: "approve" | "reject" | null;
  order: PurchaseOrder | null;
  note: string;
  saving: boolean;
};

type ReceivedModalState = {
  open: boolean;
  order: PurchaseOrder | null;
  supplierReference: string;
  receivedNote: string;
  receivedProof: File | null;
  saving: boolean;
};

function formatMoney(value: number) {
  return `GBP ${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("en-GB");
  } catch {
    return value;
  }
}

function formatDateTime(value: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function blankLine(): OrderFormLine {
  return {
    description: "",
    quantity: "1",
    unit_cost: "",
  };
}

function getStatusClass(status: string) {
  if (status === "draft") return "bg-white/10 text-white";
  if (status === "pending") return "bg-amber-500/20 text-amber-100";
  if (status === "approved") return "bg-emerald-500/20 text-emerald-100";
  if (status === "rejected") return "bg-red-500/20 text-red-100";
  if (status === "received") return "bg-blue-500/20 text-blue-100";
  return "bg-white/10 text-slate-600";
}

function normaliseRole(role: string) {
  return (role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function isApproverRole(role: string) {
  const normalised = normaliseRole(role);
  return (
    normalised === "admin" ||
    normalised === "manager" ||
    normalised === "finance" ||
    normalised === "admin_1" ||
    normalised === "admin_2" ||
    normalised === "admin1" ||
    normalised === "admin2"
  );
}

function parseNumber(value: string) {
  if (!value || !value.trim()) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function DecisionModal({
  state,
  onClose,
  onConfirm,
  onNoteChange,
}: {
  state: DecisionModalState;
  onClose: () => void;
  onConfirm: () => void;
  onNoteChange: (value: string) => void;
}) {
  if (!state.open || !state.order || !state.action) return null;

  const isApprove = state.action === "approve";
  const title = isApprove ? "Approve Purchase Order" : "Reject Purchase Order";
  const actionLabel = isApprove ? "Approve" : "Reject";
  const buttonClass = isApprove
    ? "bg-emerald-500/90 hover:bg-emerald-500"
    : "bg-red-500/90 hover:bg-red-500";

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#120a2e]/92 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-[#4a2ea8] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {state.order.po_number} • {state.order.supplier_name} • {formatMoney(state.order.total_inc_vat)}
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={state.saving}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-slate-600">
            Requested by: <span className="font-semibold text-white">{state.order.requested_by || "-"}</span>
          </div>
          <div className="mt-1 text-sm font-medium text-slate-600">
            Order date: <span className="font-semibold text-white">{formatDate(state.order.order_date)}</span>
          </div>
          <div className="mt-1 text-sm font-medium text-slate-600">
            Lines: <span className="font-semibold text-white">{state.order.line_count}</span>
          </div>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-medium text-slate-600">
            {isApprove ? "Approval note" : "Rejection reason"}
          </label>
          <textarea
            value={state.note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={5}
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-slate-400"
            placeholder={
              isApprove
                ? "Optional note about this approval..."
                : "Why is this being rejected?"
            }
          />
        </div>

        {state.order.notes ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Original PO Notes</div>
            <div className="mt-2 text-sm font-medium text-slate-600">{state.order.notes}</div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onConfirm}
            disabled={state.saving}
            className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:opacity-60 ${buttonClass}`}
          >
            {state.saving ? `${actionLabel}ing...` : actionLabel}
          </button>

          <button
            onClick={onClose}
            disabled={state.saving}
            className="rounded-lg border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceivedModal({
  state,
  onClose,
  onConfirm,
  onReferenceChange,
  onNoteChange,
  onFileChange,
}: {
  state: ReceivedModalState;
  onClose: () => void;
  onConfirm: () => void;
  onReferenceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
}) {
  if (!state.open || !state.order) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain bg-[#120a2e]/92 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-[#4a2ea8] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-semibold">Mark Purchase Order as Received</h3>
            <p className="mt-2 text-sm font-medium text-slate-500">
              {state.order.po_number} • {state.order.supplier_name}
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={state.saving}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Supplier invoice / delivery reference</label>
            <input
              value={state.supplierReference}
              onChange={(e) => onReferenceChange(e.target.value)}
              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
              placeholder="Optional reference"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-600">Proof upload *</label>
            <input
              type="file"
              onChange={(e: ChangeEvent<HTMLInputElement>) => onFileChange(e.target.files?.[0] || null)}
              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#412a8a]"
            />
            <p className="mt-2 text-xs text-slate-500">
              Upload invoice, delivery note, POD, or photo proof.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-slate-600">Received note</label>
          <textarea
            value={state.receivedNote}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-slate-400"
            placeholder="Anything important about what arrived?"
          />
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-slate-600">
          <div>Requested by: <span className="font-semibold text-white">{state.order.requested_by || "-"}</span></div>
          <div className="mt-1">Total inc VAT: <span className="font-semibold text-white">{formatMoney(state.order.total_inc_vat)}</span></div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onConfirm}
            disabled={state.saving}
            className="rounded-xl bg-blue-500/90 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {state.saving ? "Saving..." : "Confirm Received"}
          </button>

          <button
            onClick={onClose}
            disabled={state.saving}
            className="rounded-lg border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [staffRole, setStaffRole] = useState("");
  const [staffUsername, setStaffUsername] = useState("");

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    notes: "",
    active: true,
  });

  const [orderForm, setOrderForm] = useState({
    supplier_id: "",
    order_date: new Date().toISOString().slice(0, 10),
    requested_by: "",
    notes: "",
    lines: [blankLine()] as OrderFormLine[],
  });

  const [editingMode, setEditingMode] = useState(false);

  const [decisionModal, setDecisionModal] = useState<DecisionModalState>({
    open: false,
    action: null,
    order: null,
    note: "",
    saving: false,
  });

  const [receivedModal, setReceivedModal] = useState<ReceivedModalState>({
    open: false,
    order: null,
    supplierReference: "",
    receivedNote: "",
    receivedProof: null,
    saving: false,
  });

  const isApprover = isApproverRole(staffRole);

  function buildHeaders() {
    return getAuthHeaders({ "Content-Type": "application/json" });
  }

  async function loadSuppliers() {
    const response = await fetch("http://127.0.0.1:8000/api/purchase-orders/suppliers/", {
      headers: getAuthHeaders(),
    });
    const data = await response.json();
    setSuppliers(Array.isArray(data) ? data : []);
  }

  async function loadOrders() {
    const params = new URLSearchParams();

    if (statusFilter !== "all") params.set("status", statusFilter);
    if (supplierFilter !== "all") params.set("supplier_id", supplierFilter);
    if (search.trim()) params.set("search", search.trim());

    const url = `http://127.0.0.1:8000/api/purchase-orders/${params.toString() ? `?${params.toString()}` : ""}`;

    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });

    const data = await response.json();
    setOrders(Array.isArray(data) ? data : []);
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadSuppliers(), loadOrders()]);
    } catch (err) {
      console.error(err);
      setError("Failed to load purchase order data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const username =
      window.localStorage.getItem("staff_username") ||
      window.localStorage.getItem("username") ||
      "";
    const role = window.localStorage.getItem("staff_role") || "";

    setStaffUsername(username);
    setStaffRole(role);

    setOrderForm((current) => ({
      ...current,
      requested_by: username,
    }));
  }, []);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [statusFilter, supplierFilter]);

  const summary = useMemo(() => {
    return {
      totalOrders: orders.length,
      pending: orders.filter((order) => order.status === "pending").length,
      approved: orders.filter((order) => order.status === "approved").length,
      rejected: orders.filter((order) => order.status === "rejected").length,
      totalValue: orders.reduce((sum, order) => sum + Number(order.total_inc_vat || 0), 0),
    };
  }, [orders]);

  function resetOrderForm() {
    setOrderForm({
      supplier_id: "",
      order_date: new Date().toISOString().slice(0, 10),
      requested_by: staffUsername,
      notes: "",
      lines: [blankLine()],
    });
    setSelectedOrderId(null);
    setEditingMode(false);
  }

  function startEdit(order: PurchaseOrder) {
    setSelectedOrderId(order.id);
    setEditingMode(true);
    setOrderForm({
      supplier_id: String(order.supplier_id),
      order_date: order.order_date,
      requested_by: order.requested_by || "",
      notes: order.notes || "",
      lines: order.lines.length
        ? order.lines.map((line) => ({
            description: line.description,
            quantity: String(Number(line.quantity || 0)),
            unit_cost: Number(line.unit_cost || 0) ? String(Number(line.unit_cost || 0).toFixed(2)) : "",
          }))
        : [blankLine()],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateLine(index: number, field: keyof OrderFormLine, value: string) {
    setOrderForm((current) => {
      const lines = [...current.lines];
      const existing = lines[index];

      lines[index] = {
        ...existing,
        [field]: value,
      };

      return { ...current, lines };
    });
  }

  function addLine() {
    setOrderForm((current) => ({
      ...current,
      lines: [...current.lines, blankLine()],
    }));
  }

  function removeLine(index: number) {
    setOrderForm((current) => {
      const nextLines = current.lines.filter((_, lineIndex) => lineIndex !== index);
      return {
        ...current,
        lines: nextLines.length ? nextLines : [blankLine()],
      };
    });
  }

  function openDecisionModal(order: PurchaseOrder, action: "approve" | "reject") {
    setDecisionModal({
      open: true,
      action,
      order,
      note: "",
      saving: false,
    });
  }

  function closeDecisionModal() {
    if (decisionModal.saving) return;

    setDecisionModal({
      open: false,
      action: null,
      order: null,
      note: "",
      saving: false,
    });
  }

  function openReceivedModal(order: PurchaseOrder) {
    setReceivedModal({
      open: true,
      order,
      supplierReference: "",
      receivedNote: "",
      receivedProof: null,
      saving: false,
    });
  }

  function closeReceivedModal() {
    if (receivedModal.saving) return;

    setReceivedModal({
      open: false,
      order: null,
      supplierReference: "",
      receivedNote: "",
      receivedProof: null,
      saving: false,
    });
  }

  async function createSupplier() {
    try {
      setSavingSupplier(true);
      setMessage("");
      setError("");

      const response = await fetch("http://127.0.0.1:8000/api/purchase-orders/suppliers/", {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(newSupplier),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create supplier.");
      }

      setNewSupplier({
        name: "",
        contact_name: "",
        email: "",
        phone: "",
        notes: "",
        active: true,
      });

      setMessage(data.message || "Supplier created.");
      await loadSuppliers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create supplier.");
    } finally {
      setSavingSupplier(false);
    }
  }

  async function saveOrder(action: "save_draft" | "submit_for_approval") {
    try {
      setSavingOrder(true);
      setMessage("");
      setError("");

      const payload = {
        supplier_id: Number(orderForm.supplier_id),
        order_date: orderForm.order_date,
        requested_by: orderForm.requested_by,
        notes: orderForm.notes,
        lines: orderForm.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unit_cost: line.unit_cost,
        })),
        action,
      };

      const url =
        editingMode && selectedOrderId
          ? `http://127.0.0.1:8000/api/purchase-orders/${selectedOrderId}/`
          : "http://127.0.0.1:8000/api/purchase-orders/";

      const response = await fetch(url, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to save purchase order.");
      }

      setMessage(data.message || "Purchase order saved.");
      resetOrderForm();
      await loadOrders();
      await loadSuppliers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save purchase order.");
    } finally {
      setSavingOrder(false);
    }
  }

  async function orderAction(
    orderId: number,
    action: "approve" | "reject" | "cancel",
    approvalNote = ""
  ) {
    try {
      setMessage("");
      setError("");

      const order = orders.find((item) => item.id === orderId);
      if (!order) {
        throw new Error("Purchase order not found.");
      }

      const response = await fetch(`http://127.0.0.1:8000/api/purchase-orders/${orderId}/`, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({
          supplier_id: order.supplier_id,
          order_date: order.order_date,
          requested_by: order.requested_by,
          notes: order.notes,
          lines: order.lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit_cost: line.unit_cost,
          })),
          action,
          approval_note: approvalNote,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Action failed.");
      }

      setMessage(data.message || "Purchase order updated.");
      await loadOrders();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Action failed.");
      throw err;
    }
  }

  async function confirmDecisionModal() {
    if (!decisionModal.order || !decisionModal.action) return;

    try {
      setDecisionModal((current) => ({
        ...current,
        saving: true,
      }));

      await orderAction(
        decisionModal.order.id,
        decisionModal.action,
        decisionModal.note.trim()
      );

      setDecisionModal({
        open: false,
        action: null,
        order: null,
        note: "",
        saving: false,
      });
    } catch {
      setDecisionModal((current) => ({
        ...current,
        saving: false,
      }));
    }
  }

  async function confirmReceivedModal() {
    if (!receivedModal.order) return;

    if (!receivedModal.receivedProof) {
      setError("Proof upload is required before marking this as received.");
      return;
    }

    try {
      setError("");
      setMessage("");

      setReceivedModal((current) => ({
        ...current,
        saving: true,
      }));

      const formData = new FormData();
      formData.append("action", "mark_received");
      formData.append("supplier_reference", receivedModal.supplierReference);
      formData.append("received_note", receivedModal.receivedNote);
      formData.append("received_proof", receivedModal.receivedProof);

      const response = await fetch(
        `http://127.0.0.1:8000/api/purchase-orders/${receivedModal.order.id}/`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to mark purchase order as received.");
      }

      setMessage(data.message || "Purchase order marked as received.");
      closeReceivedModal();
      await loadOrders();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to mark purchase order as received.");
      setReceivedModal((current) => ({
        ...current,
        saving: false,
      }));
    }
  }

  async function deleteOrder(orderId: number) {
    try {
      setMessage("");
      setError("");

      const response = await fetch(`http://127.0.0.1:8000/api/purchase-orders/${orderId}/`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete purchase order.");
      }

      if (selectedOrderId === orderId) {
        resetOrderForm();
      }

      setMessage(data.message || "Purchase order deleted.");
      await loadOrders();
      await loadSuppliers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete purchase order.");
    }
  }

  const formTotals = useMemo(() => {
    const subtotal = orderForm.lines.reduce((sum, line) => {
      const qty = parseNumber(line.quantity);
      const unitCost = parseNumber(line.unit_cost);
      return sum + qty * unitCost;
    }, 0);

    const vatAmount = subtotal * 0.2;
    const totalIncVat = subtotal + vatAmount;

    return {
      subtotal,
      vatAmount,
      totalIncVat,
    };
  }, [orderForm.lines]);

  return (
    <StaffShell title="Purchase Orders">
      <DecisionModal
        state={decisionModal}
        onClose={closeDecisionModal}
        onConfirm={confirmDecisionModal}
        onNoteChange={(value) =>
          setDecisionModal((current) => ({
            ...current,
            note: value,
          }))
        }
      />

      <ReceivedModal
        state={receivedModal}
        onClose={closeReceivedModal}
        onConfirm={confirmReceivedModal}
        onReferenceChange={(value) =>
          setReceivedModal((current) => ({
            ...current,
            supplierReference: value,
          }))
        }
        onNoteChange={(value) =>
          setReceivedModal((current) => ({
            ...current,
            receivedNote: value,
          }))
        }
        onFileChange={(file) =>
          setReceivedModal((current) => ({
            ...current,
            receivedProof: file,
          }))
        }
      />

      <div className="space-y-6">
        {message ? (
          <div className="rounded-lg border border-emerald-200 bg-white p-4 font-semibold text-emerald-700 shadow-sm">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-white p-4 font-semibold text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Total Orders</div>
            <div className="mt-2 text-3xl font-semibold">{summary.totalOrders}</div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Pending Approval</div>
            <div className="mt-2 text-3xl font-semibold">{summary.pending}</div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Approved</div>
            <div className="mt-2 text-3xl font-semibold">{summary.approved}</div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Rejected</div>
            <div className="mt-2 text-3xl font-semibold">{summary.rejected}</div>
          </div>

          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="text-sm font-medium text-slate-500">Visible Value (inc VAT)</div>
            <div className="mt-2 text-3xl font-semibold">{formatMoney(summary.totalValue)}</div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="text-xl font-semibold">Add Supplier</h2>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Supplier Name</label>
                  <input
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier((current) => ({ ...current, name: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Supplier name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Contact Name</label>
                  <input
                    value={newSupplier.contact_name}
                    onChange={(e) => setNewSupplier((current) => ({ ...current, contact_name: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Contact person"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Email</label>
                  <input
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier((current) => ({ ...current, email: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="supplier@email.com"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Phone</label>
                  <input
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier((current) => ({ ...current, phone: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Notes</label>
                  <textarea
                    value={newSupplier.notes}
                    onChange={(e) => setNewSupplier((current) => ({ ...current, notes: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                    placeholder="Notes about this supplier..."
                  />
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={newSupplier.active}
                    onChange={(e) => setNewSupplier((current) => ({ ...current, active: e.target.checked }))}
                  />
                  <span className="text-sm text-slate-800">Supplier active</span>
                </label>

                <button
                  onClick={createSupplier}
                  disabled={savingSupplier}
                  className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#412a8a] disabled:opacity-60"
                >
                  {savingSupplier ? "Saving..." : "Create Supplier"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <h2 className="text-xl font-semibold">Suppliers</h2>

              <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto pr-2">
                {suppliers.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm font-medium text-slate-500">
                    No suppliers yet.
                  </div>
                ) : (
                  suppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{supplier.name}</div>
                          <div className="mt-1 text-sm font-medium text-slate-500">
                            {supplier.contact_name || "No contact name"}
                          </div>
                        </div>
                        <div
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            supplier.active
                              ? "bg-emerald-500/20 text-emerald-100"
                              : "bg-white/10 text-slate-500"
                          }`}
                        >
                          {supplier.active ? "Active" : "Inactive"}
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-sm font-medium text-slate-600">
                        <div>{supplier.email || "No email"}</div>
                        <div>{supplier.phone || "No phone"}</div>
                        <div>{supplier.purchase_order_count} purchase orders</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {editingMode ? "Edit Purchase Order" : "Create Purchase Order"}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Create a draft or submit straight to an approver for review.
                  </p>
                </div>

                {editingMode ? (
                  <button
                    onClick={resetOrderForm}
                    className="rounded-lg border border-violet-100 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Supplier</label>
                  <select
                    value={orderForm.supplier_id}
                    onChange={(e) => setOrderForm((current) => ({ ...current, supplier_id: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  >
                    <option value="" className="bg-white text-black">
                      Select supplier
                    </option>
                    {suppliers
                      .filter((supplier) => supplier.active)
                      .map((supplier) => (
                        <option key={supplier.id} value={supplier.id} className="bg-white text-black">
                          {supplier.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Order Date</label>
                  <input
                    type="date"
                    value={orderForm.order_date}
                    onChange={(e) => setOrderForm((current) => ({ ...current, order_date: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Requested By</label>
                  <input
                    value={orderForm.requested_by}
                    onChange={(e) => setOrderForm((current) => ({ ...current, requested_by: e.target.value }))}
                    className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    placeholder="Staff username"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-600">Approval Workflow</label>
                  <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-medium text-slate-600">
                    Save as draft or submit for approval. Approve/reject notes are entered in a popup. Received now requires proof upload.
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-600">Notes</label>
                <textarea
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm((current) => ({ ...current, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400"
                  placeholder="Any notes for this order..."
                />
              </div>

              <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <button
                    onClick={addLine}
                    className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Add Line
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {orderForm.lines.map((line, index) => {
                    const lineTotal = parseNumber(line.quantity) * parseNumber(line.unit_cost);

                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_130px_120px_70px]">
                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">
                              Description
                            </label>
                            <input
                              value={line.description}
                              onChange={(e) => updateLine(index, "description", e.target.value)}
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                              placeholder="e.g. 1100L bin, labels, gloves..."
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">
                              Qty
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.quantity}
                              onChange={(e) => updateLine(index, "quantity", e.target.value)}
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">
                              Unit Cost (ex VAT)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.unit_cost}
                              onChange={(e) => updateLine(index, "unit_cost", e.target.value)}
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                              placeholder="e.g. 25.65"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">
                              Line Total
                            </label>
                            <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                              {formatMoney(lineTotal)}
                            </div>
                          </div>

                          <div className="flex items-end">
                            <button
                              onClick={() => removeLine(index)}
                              className="w-full rounded-xl border border-red-300/20 bg-red-500/20 px-3 py-3 text-sm font-semibold text-white transition hover:bg-red-500/30"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                    <div className="text-sm font-medium text-slate-500">Subtotal ex VAT</div>
                    <div className="mt-2 text-xl font-semibold">{formatMoney(formTotals.subtotal)}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                    <div className="text-sm font-medium text-slate-500">VAT (20%)</div>
                    <div className="mt-2 text-xl font-semibold">{formatMoney(formTotals.vatAmount)}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4">
                    <div className="text-sm font-medium text-slate-500">Total inc VAT</div>
                    <div className="mt-2 text-xl font-semibold">{formatMoney(formTotals.totalIncVat)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => saveOrder("save_draft")}
                  disabled={savingOrder}
                  className="rounded-lg border border-violet-100 bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 disabled:opacity-60"
                >
                  {savingOrder ? "Saving..." : editingMode ? "Update Draft" : "Save Draft"}
                </button>

                <button
                  onClick={() => saveOrder("submit_for_approval")}
                  disabled={savingOrder}
                  className="rounded-lg bg-violet-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {savingOrder
                    ? "Submitting..."
                    : editingMode
                    ? "Update + Submit For Approval"
                    : "Submit For Approval"}
                </button>

                <button
                  onClick={resetOrderForm}
                  className="rounded-xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Purchase Orders</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Pending orders need approval before they move forward.
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Current role detected: {staffRole || "none"}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Search</label>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") loadOrders();
                      }}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                      placeholder="PO number or supplier"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All statuses</option>
                      <option value="draft" className="bg-white text-black">Draft</option>
                      <option value="pending" className="bg-white text-black">Pending</option>
                      <option value="approved" className="bg-white text-black">Approved</option>
                      <option value="rejected" className="bg-white text-black">Rejected</option>
                      <option value="received" className="bg-white text-black">Received</option>
                      <option value="cancelled" className="bg-white text-black">Cancelled</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Supplier</label>
                    <select
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                      className="w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950 outline-none"
                    >
                      <option value="all" className="bg-white text-black">All suppliers</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id} className="bg-white text-black">
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={loadOrders}
                  className="rounded-lg border border-violet-100 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
                >
                  Refresh Orders
                </button>
              </div>

              <div className="mt-5 max-h-[700px] overflow-y-auto pr-2">
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-500">
                    Loading purchase orders...
                  </div>
                ) : orders.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-500">
                    No purchase orders found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className={`rounded-2xl border p-4 transition ${
                          selectedOrderId === order.id
                            ? "border-white/40 bg-white/15"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="text-lg font-semibold">{order.po_number}</div>
                              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(order.status)}`}>
                                {order.status_label}
                              </div>
                            </div>

                            <div className="mt-2 grid gap-1 text-sm font-medium text-slate-600">
                              <div>Supplier: {order.supplier_name}</div>
                              <div>Order date: {formatDate(order.order_date)}</div>
                              <div>Requested by: {order.requested_by || "-"}</div>
                              <div>Lines: {order.line_count}</div>
                              <div>Subtotal ex VAT: {formatMoney(order.subtotal)}</div>
                              <div>VAT: {formatMoney(order.vat_amount)}</div>
                              <div>Total inc VAT: {formatMoney(order.total_inc_vat)}</div>
                              <div>Approved / Rejected by: {order.approved_by || "-"}</div>
                              <div>Decision time: {formatDateTime(order.approved_at)}</div>
                              <div>Received by: {order.received_by || "-"}</div>
                              <div>Received time: {formatDateTime(order.received_at)}</div>
                              <div>Supplier reference: {order.supplier_reference || "-"}</div>
                            </div>

                            {order.notes ? (
                              <div className="mt-3 text-sm font-medium text-slate-500">
                                <span className="font-semibold text-slate-700">Notes:</span> {order.notes}
                              </div>
                            ) : null}

                            {order.approval_note ? (
                              <div className="mt-2 text-sm font-medium text-slate-500">
                                <span className="font-semibold text-slate-700">Decision note:</span> {order.approval_note}
                              </div>
                            ) : null}

                            {order.received_note ? (
                              <div className="mt-2 text-sm font-medium text-slate-500">
                                <span className="font-semibold text-slate-700">Received note:</span> {order.received_note}
                              </div>
                            ) : null}

                            {order.received_proof_url ? (
                              <div className="mt-2 text-sm">
                                <a
                                  href={`http://127.0.0.1:8000${order.received_proof_url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-white underline underline-offset-2"
                                >
                                  View received proof
                                </a>
                              </div>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(order.status === "draft" || order.status === "rejected") && (
                              <button
                                onClick={() => startEdit(order)}
                                className="rounded-lg border border-violet-100 bg-white px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:bg-violet-50"
                              >
                                Edit
                              </button>
                            )}

                            {order.status === "pending" && isApprover && (
                              <>
                                <button
                                  onClick={() => openDecisionModal(order, "approve")}
                                  className="rounded-xl bg-emerald-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() => openDecisionModal(order, "reject")}
                                  className="rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {order.status === "approved" && (
                              <button
                                onClick={() => openReceivedModal(order)}
                                className="rounded-xl border border-blue-300/20 bg-blue-500/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500/30"
                              >
                                Mark Received
                              </button>
                            )}

                            {order.status !== "received" && order.status !== "cancelled" && (
                              <button
                                onClick={() => orderAction(order.id, "cancel")}
                                className="rounded-xl border border-red-300/20 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500/30"
                              >
                                Cancel
                              </button>
                            )}

                            {(order.status === "draft" || order.status === "rejected" || order.status === "cancelled") && (
                              <button
                                onClick={() => deleteOrder(order.id)}
                                className="rounded-xl border border-red-300/20 bg-red-500/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500/30"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {order.lines.length ? (
                          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                            <div className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              <div>Description</div>
                              <div>Qty</div>
                              <div>Unit Cost</div>
                              <div>Total</div>
                            </div>

                            {order.lines.map((line, index) => (
                              <div
                                key={`${order.id}-${index}`}
                                className="grid grid-cols-[minmax(0,1fr)_110px_140px_140px] border-t border-white/10 px-4 py-3 text-sm"
                              >
                                <div>{line.description}</div>
                                <div>{Number(line.quantity || 0).toFixed(2)}</div>
                                <div>{formatMoney(Number(line.unit_cost || 0))}</div>
                                <div>{formatMoney(Number(line.line_total || 0))}</div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StaffShell>
  );
}

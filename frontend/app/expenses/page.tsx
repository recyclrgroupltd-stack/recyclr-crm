"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import StaffShell from "../../components/StaffShell";
import { canApproveExpenses, canViewExpenses, getAuthHeaders, getStoredUser, StoredUser } from "../../lib/auth";

type Category = {
  id: number;
  name: string;
  active: boolean;
  requires_receipt: boolean;
  notes: string;
};

type Expense = {
  id: number;
  submitted_by: string;
  category_id: number;
  category: string;
  expense_type: string;
  expense_type_label: string;
  expense_date: string;
  merchant: string;
  description: string;
  amount: number;
  vat_amount: number;
  lines: ExpenseLine[];
  mileage: number;
  mileage_rate: number;
  receipt_url: string;
  receipt_original_name: string;
  extraction_status: string;
  extraction_message: string;
  extracted_text: string;
  extracted_merchant: string;
  extracted_date: string;
  extracted_amount: number | null;
  status: string;
  status_label: string;
  submitted_at: string;
  approved_by: string;
  approved_at: string;
  rejection_reason: string;
};

type ExpenseLine = {
  id?: number;
  category_id: number | string;
  category?: string;
  description: string;
  merchant: string;
  amount: number | string;
  vat_amount: number | string;
};

type Summary = {
  pending_count: number;
  approved_this_month: number;
  mine_pending: number;
};

const initialSummary: Summary = {
  pending_count: 0,
  approved_this_month: 0,
  mine_pending: 0,
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number | string) {
  const parsed = Number(value || 0);
  return `£${parsed.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusClass(status: string) {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-red-100 text-red-700";
  if (status === "paid") return "bg-blue-100 text-blue-700";
  if (status === "submitted") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export default function ExpensesPage() {
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [mileageRate, setMileageRate] = useState(0);
  const [vatRate, setVatRate] = useState(20);
  const [scope, setScope] = useState("mine");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const canView = canViewExpenses(currentUser);
  const canApprove = canApproveExpenses(currentUser);

  const [form, setForm] = useState({
    category_id: "",
    expense_type: "general",
    expense_date: todayIso(),
    merchant: "",
    description: "",
    amount: "",
    vat_amount: "",
    mileage: "",
  });
  const [entryMode, setEntryMode] = useState<"manual" | "automatic">("manual");
  const [expenseLines, setExpenseLines] = useState<ExpenseLine[]>([
    { category_id: "", description: "", merchant: "", amount: "", vat_amount: "" },
  ]);
  const [receipt, setReceipt] = useState<File | null>(null);

  useEffect(() => {
    setMounted(true);
    setCurrentUser(getStoredUser());
  }, []);

  const loadExpenses = useCallback(async function loadExpenses() {
    if (!canView) {
      setLoading(false);
      return;
    }

    try {
      setError("");
      const params = new URLSearchParams({
        scope: canApprove ? scope : "mine",
        status,
        search,
      });
      const response = await fetch(`http://127.0.0.1:8000/api/expenses/?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load expenses.");
      setExpenses(data.expenses || []);
      setCategories(data.categories || []);
      setSummary(data.summary || initialSummary);
      setMileageRate(Number(data.mileage_rate || 0));
      setVatRate(Number(data.vat_rate || 0));
      if (!form.category_id && data.categories?.length) {
        const defaultCategory = data.categories.find((item: Category) => item.name.toLowerCase() === "other") || data.categories[0];
        setForm((current) => ({ ...current, category_id: String(defaultCategory.id) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load expenses.");
    } finally {
      setLoading(false);
    }
  }, [canApprove, canView, form.category_id, scope, search, status]);

  useEffect(() => {
    if (!mounted) return;
    loadExpenses();
  }, [mounted, canView, scope, status, loadExpenses]);

  const activeCategories = useMemo(() => categories.filter((category) => category.active), [categories]);
  const mileageTotal = useMemo(() => {
    const miles = Number(form.mileage || 0);
    return miles * mileageRate;
  }, [form.mileage, mileageRate]);
  const lineTotals = useMemo(() => {
    const net = expenseLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
    const vat = expenseLines.reduce((sum, line) => sum + Number(line.vat_amount || 0), 0);
    return { net, vat, gross: net + vat };
  }, [expenseLines]);

  function calculatedVat(amount: number | string) {
    return Number(((Number(amount || 0) * vatRate) / 100).toFixed(2));
  }

  function updateForm(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLine(index: number, field: keyof ExpenseLine, value: string) {
    setExpenseLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, [field]: value };
        if (field === "amount") {
          next.vat_amount = calculatedVat(value).toFixed(2);
        }
        return next;
      })
    );
  }

  function addLine() {
    setExpenseLines((current) => [
      ...current,
      { category_id: form.category_id, description: "", merchant: form.merchant, amount: "", vat_amount: "" },
    ]);
  }

  function removeLine(index: number) {
    setExpenseLines((current) => current.length === 1 ? current : current.filter((_, lineIndex) => lineIndex !== index));
  }

  function setExpenseType(type: string) {
    const matched = activeCategories.find((category) => category.name.toLowerCase() === (type === "mileage" ? "mileage" : type));
    setForm((current) => ({
      ...current,
      expense_type: type,
      category_id: matched ? String(matched.id) : current.category_id,
      amount: type === "mileage" ? "" : current.amount,
    }));
  }

  async function submitExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value));
      payload.append("mileage_rate", String(mileageRate));
      payload.append("vat_rate", String(vatRate));
      payload.append("entry_mode", entryMode);
      payload.append("lines", JSON.stringify(expenseLines));
      if (receipt) payload.append("receipt", receipt);

      const response = await fetch("http://127.0.0.1:8000/api/expenses/", {
        method: "POST",
        headers: getAuthHeaders(),
        body: payload,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not submit expense.");

      setMessage(data.expense?.extraction_message || data.message || "Expense submitted.");
      setForm({
        category_id: form.category_id,
        expense_type: "general",
        expense_date: todayIso(),
        merchant: "",
        description: "",
        amount: "",
        vat_amount: "",
        mileage: "",
      });
      setEntryMode("manual");
      setExpenseLines([{ category_id: form.category_id, description: "", merchant: "", amount: "", vat_amount: "" }]);
      setReceipt(null);
      const fileInput = document.getElementById("expense-receipt") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit expense.");
    } finally {
      setSaving(false);
    }
  }

  async function approveExpense(expenseId: number) {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/expenses/${expenseId}/approve/`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not approve expense.");
      setMessage(data.message || "Expense approved.");
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve expense.");
    } finally {
      setSaving(false);
    }
  }

  async function rejectExpense(expenseId: number) {
    const reason = window.prompt("Reason for rejecting this expense?") || "";
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/expenses/${expenseId}/reject/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not reject expense.");
      setMessage(data.message || "Expense rejected.");
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject expense.");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("http://127.0.0.1:8000/api/expenses/categories/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name, active: true, requires_receipt: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create category.");
      setMessage(data.message || "Category created.");
      setNewCategoryName("");
      await loadExpenses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) {
    return (
      <StaffShell title="Expenses">
        <div className="rounded-lg bg-white p-5 text-slate-950">Loading expenses...</div>
      </StaffShell>
    );
  }

  if (!canView) {
    return (
      <StaffShell title="Expenses">
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 font-bold text-red-700">
          You do not have permission to view expenses.
        </div>
      </StaffShell>
    );
  }

  return (
    <StaffShell title="Expenses">
      <div className="space-y-5">
        {(message || error) ? (
          <div className={`rounded-lg border p-4 text-sm font-bold ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        ) : null}

        <section className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-black">Expenses</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Submit receipts and mileage claims for approval.
              </p>
            </div>
            <button
              type="button"
              onClick={loadExpenses}
              className="rounded-lg border border-violet-100 bg-white px-4 py-3 text-sm font-bold text-violet-700"
            >
              Refresh
            </button>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Pending Approval</div>
            <div className="mt-2 text-3xl font-black">{summary.pending_count}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Approved This Month</div>
            <div className="mt-2 text-3xl font-black">{formatMoney(summary.approved_this_month)}</div>
          </div>
          <div className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Company Mileage Rate</div>
            <div className="mt-2 text-3xl font-black">{formatMoney(mileageRate)} / mile</div>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form onSubmit={submitExpense} className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">New Expense</h2>
            <div className="mt-4 grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["general", "General"],
                  ["mileage", "Mileage"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setExpenseType(value)}
                    className={`rounded-lg px-3 py-2 text-sm font-bold ${form.expense_type === value ? "bg-violet-700 text-white" : "bg-violet-50 text-violet-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {form.expense_type === "general" ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["manual", "Manual"],
                    ["automatic", "Read Receipt"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEntryMode(value as "manual" | "automatic")}
                      className={`rounded-lg px-3 py-2 text-sm font-bold ${entryMode === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="text-sm font-bold text-slate-600">
                Category
                <select
                  value={form.category_id}
                  onChange={(event) => updateForm("category_id", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                  required
                >
                  <option value="">Select category</option>
                  {activeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-bold text-slate-600">
                Date
                <input
                  type="date"
                  value={form.expense_date}
                  onChange={(event) => updateForm("expense_date", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                  required
                />
              </label>

              <label className="text-sm font-bold text-slate-600">
                Merchant
                <input
                  value={form.merchant}
                  onChange={(event) => updateForm("merchant", event.target.value)}
                  placeholder="Shell, Tesco, Screwfix..."
                  className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                />
              </label>

              {form.expense_type === "mileage" ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-bold text-slate-600">
                    Miles
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.mileage}
                      onChange={(event) => updateForm("mileage", event.target.value)}
                      className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                      required
                    />
                  </label>
                  <div className="rounded-lg bg-emerald-50 p-4">
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Calculated</div>
                    <div className="mt-2 text-xl font-black text-emerald-900">{formatMoney(mileageTotal)}</div>
                  </div>
                </div>
              ) : entryMode === "manual" ? (
                <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-950">Expense Lines</div>
                      <div className="text-xs font-semibold text-slate-500">VAT is calculated from the company VAT rate.</div>
                    </div>
                    <button type="button" onClick={addLine} className="rounded-md bg-violet-700 px-3 py-2 text-xs font-black text-white">
                      Add Line
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {expenseLines.map((line, index) => (
                      <div key={index} className="rounded-lg bg-white p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="text-xs font-black uppercase tracking-wide text-slate-400">Line {index + 1}</div>
                          {expenseLines.length > 1 ? (
                            <button type="button" onClick={() => removeLine(index)} className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">
                              Remove
                            </button>
                          ) : null}
                        </div>
                        <div className="grid gap-2">
                          <select
                            value={String(line.category_id || form.category_id)}
                            onChange={(event) => updateLine(index, "category_id", event.target.value)}
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold outline-none"
                          >
                            {activeCategories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                          <input
                            value={line.description}
                            onChange={(event) => updateLine(index, "description", event.target.value)}
                            placeholder="What was bought?"
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold outline-none"
                          />
                          <input
                            value={line.merchant}
                            onChange={(event) => updateLine(index, "merchant", event.target.value)}
                            placeholder="Merchant for this line"
                            className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold outline-none"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.amount}
                              onChange={(event) => updateLine(index, "amount", event.target.value)}
                              placeholder="Amount ex VAT"
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold outline-none"
                              required={!receipt}
                            />
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={line.vat_amount}
                              onChange={(event) => updateLine(index, "vat_amount", event.target.value)}
                              placeholder="VAT"
                              className="w-full rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm font-black">
                    <div className="rounded-lg bg-white p-3">Net<br />{formatMoney(lineTotals.net)}</div>
                    <div className="rounded-lg bg-white p-3">VAT<br />{formatMoney(lineTotals.vat)}</div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900">Total<br />{formatMoney(lineTotals.gross)}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                  Upload the receipt below and submit. The CRM will read what it can from the receipt, fill the claim total, and keep the extracted text on the claim for checking.
                </div>
              )}

              <label className="text-sm font-bold text-slate-600">
                Receipt
                <input
                  id="expense-receipt"
                  type="file"
                  accept="image/*,.pdf,.txt"
                  onChange={(event) => setReceipt(event.target.files?.[0] || null)}
                  className="mt-2 w-full rounded-lg border border-dashed border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-slate-950"
                />
              </label>

              <label className="text-sm font-bold text-slate-600">
                Notes
                <textarea
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="What was this expense for?"
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 font-semibold text-slate-950 outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Submit Expense
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-black">Expense Claims</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {canApprove ? "Review staff expenses or switch to your own claims." : "Your submitted claims."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canApprove ? (
                  <select value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-bold">
                    <option value="mine">Mine</option>
                    <option value="all">All staff</option>
                  </select>
                ) : null}
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-bold">
                  <option value="all">All statuses</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </select>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") loadExpenses();
                  }}
                  placeholder="Search expenses..."
                  className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-bold outline-none"
                />
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-100 text-xs uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Merchant</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-5 text-slate-500" colSpan={7}>Loading expenses...</td></tr>
                  ) : expenses.length === 0 ? (
                    <tr><td className="px-4 py-5 text-slate-500" colSpan={7}>No expenses found.</td></tr>
                  ) : (
                    expenses.map((expense) => (
                      <tr key={expense.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-semibold">{expense.expense_date}</td>
                        <td className="px-4 py-3">{expense.submitted_by}</td>
                        <td className="px-4 py-3">{expense.category}</td>
                        <td className="px-4 py-3">{expense.merchant || "-"}</td>
                        <td className="px-4 py-3 font-black">{formatMoney(expense.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(expense.status)}`}>
                            {expense.status_label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setSelectedExpense(expense)} className="rounded-md bg-violet-50 px-3 py-2 text-xs font-black text-violet-700">
                              Details
                            </button>
                            {expense.receipt_url ? (
                              <a href={`http://127.0.0.1:8000${expense.receipt_url}`} target="_blank" className="rounded-md bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">
                                Receipt
                              </a>
                            ) : null}
                            {canApprove && expense.status === "submitted" ? (
                              <>
                                <button type="button" disabled={saving} onClick={() => approveExpense(expense.id)} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                                  Approve
                                </button>
                                <button type="button" disabled={saving} onClick={() => rejectExpense(expense.id)} className="rounded-md bg-red-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
                                  Reject
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {canApprove ? (
          <section className="rounded-lg border border-violet-100 bg-white p-5 text-slate-950 shadow-sm">
            <h2 className="text-lg font-black">Expense Categories</h2>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="New category name"
                className="flex-1 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-semibold outline-none"
              />
              <button type="button" onClick={createCategory} disabled={saving} className="rounded-lg bg-violet-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">
                Add Category
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {activeCategories.map((category) => (
                <span key={category.id} className={`rounded-full px-3 py-2 text-xs font-black ${category.active ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-400"}`}>
                  {category.name}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {selectedExpense ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 text-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{selectedExpense.category} Expense</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Submitted by {selectedExpense.submitted_by} on {selectedExpense.submitted_at ? new Date(selectedExpense.submitted_at).toLocaleString("en-GB") : "-"}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedExpense(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">
                Close
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase text-slate-400">Amount</div>
                <div className="mt-1 text-xl font-black">{formatMoney(selectedExpense.amount)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase text-slate-400">VAT</div>
                <div className="mt-1 text-xl font-black">{formatMoney(selectedExpense.vat_amount)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase text-slate-400">Merchant</div>
                <div className="mt-1 font-black">{selectedExpense.merchant || "-"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase text-slate-400">Mileage</div>
                <div className="mt-1 font-black">{selectedExpense.mileage ? `${selectedExpense.mileage} miles @ ${formatMoney(selectedExpense.mileage_rate)}` : "-"}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-black uppercase text-slate-400">Receipt Reading</div>
                <div className="mt-1 font-black">{selectedExpense.extraction_message || selectedExpense.extraction_status}</div>
              </div>
            </div>
            {selectedExpense.lines?.length ? (
              <div className="mt-4 rounded-lg border border-slate-100">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-black uppercase text-slate-400">Lines</div>
                <div className="divide-y divide-slate-100">
                  {selectedExpense.lines.map((line) => (
                    <div key={line.id || `${line.description}-${line.amount}`} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto]">
                      <div>
                        <div className="font-black">{line.description || line.category || "Expense line"}</div>
                        <div className="text-xs font-semibold text-slate-500">{line.merchant || selectedExpense.merchant || "-"}</div>
                      </div>
                      <div className="font-black">{formatMoney(line.amount)}</div>
                      <div className="font-semibold text-slate-500">VAT {formatMoney(line.vat_amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <div className="text-xs font-black uppercase text-slate-400">Notes</div>
              <div className="mt-2 whitespace-pre-wrap text-sm font-semibold">{selectedExpense.description || "-"}</div>
            </div>
            {selectedExpense.extracted_text ? (
              <div className="mt-4 rounded-lg bg-slate-950 p-4 text-xs font-semibold text-slate-100">
                <div className="mb-2 font-black uppercase text-slate-400">Extracted Receipt Text</div>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap">{selectedExpense.extracted_text}</pre>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </StaffShell>
  );
}

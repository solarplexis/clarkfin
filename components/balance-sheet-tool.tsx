"use client";

import Link from "next/link";
import { useState } from "react";

import type { Asset, AssetCategory, Debt, UserProfile } from "@/types/domain";

// ─── Types ─────────────────────────────────────────────────────

type AssetDraft = {
  id?: string;
  tempId: string;
  category: AssetCategory;
  label: string;
  currentValue: number;
  isPending: boolean;
};

// ─── Constants ─────────────────────────────────────────────────

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  liquid: "Liquid",
  investment: "Investments",
  property: "Property",
  retirement: "Retirement Accounts",
  other: "Other Assets"
};

const CATEGORY_ORDER: AssetCategory[] = [
  "liquid", "investment", "property", "retirement", "other"
];

// ─── Helpers ───────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number, signed = false) {
  const s = Math.abs(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  });
  if (signed && n < 0) return `(${s})`;
  return s;
}

function toDraft(asset: Asset): AssetDraft {
  return {
    id: asset.id,
    tempId: asset.id,
    category: asset.category,
    label: asset.label,
    currentValue: asset.currentValue,
    isPending: false
  };
}

// ─── Asset row ─────────────────────────────────────────────────

function AssetRow({
  draft,
  semesterId,
  onUpdate,
  onDelete
}: {
  draft: AssetDraft;
  semesterId: string;
  onUpdate: (updated: AssetDraft) => void;
  onDelete: (tempId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState(draft.label);
  const [value, setValue] = useState(draft.currentValue);

  async function save(nextLabel = label, nextValue = value) {
    if (!nextLabel.trim()) return;
    setSaving(true);
    try {
      const body = {
        semesterId,
        category: draft.category,
        label: nextLabel.trim(),
        currentValue: nextValue
      };
      const resp = draft.id
        ? await fetch(`/api/student/assets/${draft.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          })
        : await fetch("/api/student/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
          });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Save failed");
      onUpdate({ ...draft, id: data.asset.id, tempId: data.asset.id, label: nextLabel.trim(), currentValue: nextValue, isPending: false });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelf() {
    if (draft.id) {
      await fetch(`/api/student/assets/${draft.id}?semesterId=${encodeURIComponent(semesterId)}`, {
        method: "DELETE"
      });
    }
    onDelete(draft.tempId);
  }

  return (
    <div className="bs-row">
      <input
        className="bs-label-input"
        placeholder={`Label (e.g. ${draft.category === "liquid" ? "Checking account" : draft.category === "investment" ? "Brokerage account" : draft.category === "retirement" ? "401(k)" : "Asset name"})…`}
        value={label}
        autoFocus={draft.isPending}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => save(label, value)}
      />
      <input
        className="bs-value-input"
        type="number"
        min="0"
        step="1"
        value={value || ""}
        placeholder="$0"
        onChange={e => setValue(Number(e.target.value) || 0)}
        onBlur={() => save(label, value)}
      />
      {saving && <span className="is-saving-dot" />}
      <button className="bs-delete-btn" onClick={deleteSelf} aria-label="Delete asset" title="Delete">✕</button>
    </div>
  );
}

// ─── Asset category section ─────────────────────────────────────

function AssetSection({
  category,
  drafts,
  semesterId,
  onUpdate,
  onDelete,
  onAdd
}: {
  category: AssetCategory;
  drafts: AssetDraft[];
  semesterId: string;
  onUpdate: (d: AssetDraft) => void;
  onDelete: (tempId: string) => void;
  onAdd: (cat: AssetCategory) => void;
}) {
  const total = drafts.reduce((s, d) => s + d.currentValue, 0);

  return (
    <div>
      <div className="bs-section-label">{CATEGORY_LABELS[category]}</div>
      {drafts.map(d => (
        <AssetRow
          key={d.tempId}
          draft={d}
          semesterId={semesterId}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
      <button className="bs-add-btn" onClick={() => onAdd(category)}>
        + Add {CATEGORY_LABELS[category].replace(" Accounts", "").replace(" Assets", "")}
      </button>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

export function BalanceSheetTool({
  user,
  initialAssets,
  debts,
  semesterId
}: {
  user: UserProfile;
  initialAssets: Asset[];
  debts: Debt[];
  semesterId: string;
}) {
  const [drafts, setDrafts] = useState<AssetDraft[]>(() =>
    initialAssets.map(toDraft)
  );

  function updateDraft(updated: AssetDraft) {
    setDrafts(prev =>
      prev.map(d => d.tempId === updated.tempId ? updated : d)
    );
  }

  function deleteDraft(tempId: string) {
    setDrafts(prev => prev.filter(d => d.tempId !== tempId));
  }

  function addDraft(category: AssetCategory) {
    const tempId = uid();
    setDrafts(prev => [
      ...prev,
      { id: undefined, tempId, category, label: "", currentValue: 0, isPending: true }
    ]);
  }

  // ── Calculations ───────────────────────────────────────────────

  const totalAssets = drafts.reduce((s, d) => s + d.currentValue, 0);
  const totalLiabilities = debts.reduce((s, d) => s + d.currentBalance, 0);
  const netWorth = totalAssets - totalLiabilities;
  const target = user.retirementNetWorthTarget ?? 0;
  const progressPct = target > 0 ? Math.min(100, Math.max(0, (netWorth / target) * 100)) : 0;

  return (
    <div className="stack">
      {/* Net Worth Header */}
      <div className="card">
        <div className="bs-net-worth-strip">
          <div>
            <div className="bs-nw-label">Net Worth</div>
            <div
              className="bs-nw-value"
              style={{ color: netWorth >= 0 ? "#0a9e74" : "var(--danger)" }}
            >
              {netWorth < 0 && "("}
              {fmt(Math.abs(netWorth))}
              {netWorth < 0 && ")"}
            </div>
          </div>

          {target > 0 && (
            <div className="bs-nw-target-row">
              <div className="bs-nw-target-label">
                {fmt(netWorth)} of {fmt(target)} retirement target
                {user.targetRetirementAge && ` by age ${user.targetRetirementAge}`}
                {" — "}{progressPct.toFixed(1)}%
              </div>
              <div className="bs-nw-progress-track">
                <div
                  className="bs-nw-progress-fill"
                  style={{
                    width: `${progressPct.toFixed(2)}%`,
                    background: progressPct >= 100 ? "#0a9e74" : "var(--accent)"
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assets + Liabilities grid */}
      <div className="fin-main-grid">
        {/* Assets */}
        <div className="card">
          <div className="card-header">
            <h3>Assets</h3>
            <span style={{ fontWeight: 700, color: "#0a9e74" }}>{fmt(totalAssets)}</span>
          </div>

          {CATEGORY_ORDER.map(cat => (
            <AssetSection
              key={cat}
              category={cat}
              drafts={drafts.filter(d => d.category === cat)}
              semesterId={semesterId}
              onUpdate={updateDraft}
              onDelete={deleteDraft}
              onAdd={addDraft}
            />
          ))}

          <div className="bs-total-row" style={{ marginTop: 12 }}>
            <span>Total Assets</span>
            <span style={{ color: "#0a9e74" }}>{fmt(totalAssets)}</span>
          </div>
        </div>

        {/* Liabilities */}
        <div className="card">
          <div className="card-header">
            <h3>Liabilities</h3>
            <span style={{ fontWeight: 700, color: "var(--danger)" }}>{fmt(totalLiabilities)}</span>
          </div>

          {debts.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: "0.875rem", padding: "12px 0" }}>
              No debts on record.{" "}
              <Link href="/app/student/debt" style={{ color: "var(--accent)" }}>Add debts →</Link>
            </p>
          ) : (
            <>
              <div className="bs-section-label">From Debt Records</div>
              {debts.map(debt => (
                <div className="bs-row" key={debt.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bs-readonly-label">{debt.label}</div>
                    <div className="bs-readonly-sub">
                      {debt.category.replace("_", " ")}
                      {debt.interestRate > 0 && ` · ${debt.interestRate}% APR`}
                      {" · "}{fmt(debt.monthlyPayment)}/mo
                    </div>
                  </div>
                  <span className="bs-readonly-value" style={{ color: "var(--danger)" }}>
                    {fmt(debt.currentBalance)}
                  </span>
                </div>
              ))}
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 10 }}>
                Edit debt details on the{" "}
                <Link href="/app/student/debt" style={{ color: "var(--accent)" }}>Debt page</Link>.
              </p>
            </>
          )}

          <div className="bs-total-row" style={{ marginTop: 12 }}>
            <span>Total Liabilities</span>
            <span style={{ color: "var(--danger)" }}>{fmt(totalLiabilities)}</span>
          </div>

          {/* Net Worth summary in liabilities card */}
          <div
            style={{
              marginTop: 12,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: netWorth >= 0 ? "var(--teal-soft)" : "var(--danger-soft)",
              border: `1px solid ${netWorth >= 0 ? "var(--teal)" : "var(--danger)"}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 700
            }}
          >
            <span>Net Worth</span>
            <span style={{ color: netWorth >= 0 ? "#0a9e74" : "var(--danger)", fontSize: "1.1rem" }}>
              {fmt(netWorth, true)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

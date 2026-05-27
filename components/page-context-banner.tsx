"use client";

import { useEffect, useState } from "react";

export interface PageContextBannerProps {
  storageKey: string;
  icon: string;
  title: string;
  what: string;
  when: string;
  connects: string;
}

export function PageContextBanner({ storageKey, icon, title, what, when: whenText, connects }: PageContextBannerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(`ctx-banner-${storageKey}`);
    // Default open on first visit, collapsed after
    setOpen(saved === null ? true : saved === "open");
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`ctx-banner-${storageKey}`, next ? "open" : "closed");
  }

  if (!mounted) return null;

  return (
    <div className={`pcb-root${open ? " pcb-open" : ""}`}>
      <button className="pcb-toggle" onClick={toggle} type="button" aria-expanded={open}>
        <span className="pcb-toggle-left">
          <span className="pcb-icon">{icon}</span>
          <span className="pcb-title">{title}</span>
        </span>
        <span className="pcb-toggle-right">
          <span className="pcb-hint">{open ? "Hide guide" : "What is this page?"}</span>
          <span className="pcb-chevron">{open ? "▲" : "▼"}</span>
        </span>
      </button>

      {open && (
        <div className="pcb-body">
          <div className="pcb-grid">
            <div className="pcb-section">
              <div className="pcb-section-label">What's here</div>
              <p className="pcb-section-text">{what}</p>
            </div>
            <div className="pcb-section">
              <div className="pcb-section-label">When to use this page</div>
              <p className="pcb-section-text">{whenText}</p>
            </div>
            <div className="pcb-section pcb-section-full">
              <div className="pcb-section-label">How this connects to the rest of your finances</div>
              <p className="pcb-section-text">{connects}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

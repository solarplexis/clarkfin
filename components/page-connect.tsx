"use client";

import { useEffect, useState } from "react";

export function PageConnect({
  storageKey,
  text,
  links
}: {
  storageKey: string;
  text: string;
  links: Array<{ href: string; label: string }>;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(`pc:${storageKey}`);
    if (saved === "0") setOpen(false);
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    localStorage.setItem(`pc:${storageKey}`, next ? "1" : "0");
  }

  const bodyId = `pc-body-${storageKey}`;

  return (
    <div className="pc-wrap">
      <button className="pc-header" onClick={toggle} aria-expanded={open} aria-controls={bodyId} type="button">
        <span className="pc-title">How this page connects</span>
        <span className="pc-toggle">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="pc-body" id={bodyId}>
          <p className="pc-text">{text}</p>
          <div className="pc-links">
            {links.map(l => (
              <a key={l.href} href={l.href} className="pc-link">{l.label}</a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

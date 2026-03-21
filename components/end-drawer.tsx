"use client";

import { useEffect, useId, useState } from "react";

type EndDrawerProps = {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
  triggerDisabled?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function EndDrawer({
  title,
  description: _description,
  triggerLabel,
  triggerVariant = "primary",
  triggerDisabled = false,
  children,
  footer
}: EndDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const headingId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        className={triggerVariant === "primary" ? "button" : "button-secondary"}
        type="button"
        disabled={triggerDisabled}
        onClick={() => setIsOpen(true)}
      >
        {triggerLabel}
      </button>

      {isOpen ? (
        <div className="end-drawer-root" aria-hidden={!isOpen}>
          <button
            aria-label="Close panel"
            className="end-drawer-backdrop"
            type="button"
            onClick={() => setIsOpen(false)}
          />
          <aside
            aria-labelledby={headingId}
            aria-modal="true"
            className="end-drawer-panel"
            role="dialog"
          >
            <header className="end-drawer-header">
              <h2 id={headingId}>{title}</h2>
            </header>
            <div className="end-drawer-content">{children}</div>
            {footer ? <div className="end-drawer-footer">{footer}</div> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

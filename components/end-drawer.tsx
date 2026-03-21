"use client";

import { useEffect, useId, useState } from "react";

type EndDrawerProps = {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
  children: React.ReactNode;
};

export function EndDrawer({
  title,
  description,
  triggerLabel,
  triggerVariant = "primary",
  children
}: EndDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const headingId = useId();
  const descriptionId = useId();

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
            aria-describedby={description ? descriptionId : undefined}
            aria-labelledby={headingId}
            aria-modal="true"
            className="end-drawer-panel"
            role="dialog"
          >
            <header className="end-drawer-header">
              <div className="stack">
                <h2 id={headingId}>{title}</h2>
                {description ? (
                  <p className="muted" id={descriptionId}>
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                aria-label="Close panel"
                className="button-secondary"
                type="button"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </header>
            <div className="end-drawer-content">{children}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
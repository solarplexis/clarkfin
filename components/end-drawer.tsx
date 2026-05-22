"use client";

import { useEffect, useId, useState } from "react";

type EndDrawerProps = {
  title: string;
  description?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerLabel: string;
  triggerVariant?: "primary" | "secondary";
  triggerDisabled?: boolean;
  triggerAriaLabel?: string;
  triggerClassName?: string;
  triggerChildren?: React.ReactNode;
  triggerTooltip?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function EndDrawer({
  title,
  description: _description,
  open: controlledOpen,
  onOpenChange,
  triggerLabel,
  triggerVariant = "primary",
  triggerDisabled = false,
  triggerAriaLabel,
  triggerClassName,
  triggerChildren,
  triggerTooltip,
  children,
  footer
}: EndDrawerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;

  function setIsOpen(value: boolean) {
    if (isControlled) {
      onOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
  }
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
        aria-label={triggerAriaLabel ?? triggerLabel}
        className={[
          triggerVariant === "primary" ? "button" : "button-secondary",
          triggerClassName ?? ""
        ].join(" ").trim()}
        data-tooltip={triggerTooltip}
        title={triggerTooltip}
        type="button"
        disabled={triggerDisabled}
        onClick={() => setIsOpen(true)}
      >
        {triggerChildren ?? triggerLabel}
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

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function AccountMenu({
  fullName,
  avatarUrl
}: {
  fullName: string;
  avatarUrl?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="account-menu-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="appbar-user">
          {avatarUrl ? (
            <img alt={fullName} className="appbar-avatar-image" src={avatarUrl} />
          ) : (
            <span className="appbar-avatar">{initials(fullName)}</span>
          )}
          <span className="appbar-user-name">{fullName}</span>
        </span>
      </button>

      {isOpen ? (
        <div className="account-menu-popover" role="menu">
          <Link className="account-menu-item" href="/app/profile" role="menuitem" onClick={() => setIsOpen(false)}>
            Edit Profile
          </Link>
          <form action="/api/session/logout" method="post">
            <button className="account-menu-item" role="menuitem" type="submit">
              Sign Out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

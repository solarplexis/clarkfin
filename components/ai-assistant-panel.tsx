"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";

// ─── Types ─────────────────────────────────────────────────────

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  semesterId: string;
};

// ─── Markdown link renderer ────────────────────────────────────
// Converts [text](href) patterns to Next.js Links. Plain text passes through.

function renderContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const [, label, href] = match;
    const isInternal = href.startsWith("/");
    if (isInternal) {
      parts.push(
        <Link key={match.index} href={href as Route} className="ai-chat-link">
          {label}
        </Link>
      );
    } else {
      parts.push(
        <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className="ai-chat-link">
          {label}
        </a>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts;
}

// ─── Component ─────────────────────────────────────────────────

export function AiAssistantPanel({ semesterId }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Clear conversation on navigation
  useEffect(() => {
    setOpen(false);
    setMessages([]);
    setInput("");
    setError(null);
  }, [pathname]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semesterId,
          messages: next.map((m) => ({ role: m.role, content: m.content }))
        })
      });

      const data = (await res.json()) as { message?: string; error?: string; dataUpdated?: boolean };

      if (!res.ok || data.error) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message ?? ""
      };
      setMessages([...next, assistantMsg]);
    } catch {
      setError("Unable to reach the assistant. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating action button — hidden when panel is open */}
      {!open && <button
        className="ai-fab"
        aria-label="Open AI assistant"
        aria-expanded={false}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2C6.477 2 2 6.18 2 11.333c0 2.762 1.305 5.232 3.371 6.955L4 22l4.5-1.667C9.6 20.77 10.78 21 12 21c5.523 0 10-4.18 10-9.333S17.523 2 12 2z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx="8" cy="11" r="1.2" fill="currentColor" />
          <circle cx="12" cy="11" r="1.2" fill="currentColor" />
          <circle cx="16" cy="11" r="1.2" fill="currentColor" />
        </svg>
      </button>}

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="ai-panel"
          role="dialog"
          aria-label="AI financial assistant"
          aria-modal="false"
        >
          {/* Header */}
          <div className="ai-panel-header">
            <div className="ai-panel-title-group">
              <h2 className="ai-panel-title">Finance Assistant</h2>
              <span className="ai-panel-ephemeral-note">Conversation clears on navigation</span>
            </div>
            <button
              className="ai-panel-close"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="ai-panel-messages" aria-live="polite" aria-atomic="false">
            {messages.length === 0 && (
              <div className="ai-panel-empty">
                <p>Ask me anything about personal finance, log a transaction, or look up something from your course syllabus.</p>
                <ul className="ai-panel-suggestions">
                  <li>&ldquo;I just spent $12 at Starbucks&rdquo;</li>
                  <li>&ldquo;I paid my rent this month&rdquo;</li>
                  <li>&ldquo;What&rsquo;s the difference between a Roth and traditional IRA?&rdquo;</li>
                  <li>&ldquo;Where do I track my net worth?&rdquo;</li>
                </ul>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-message ${msg.role === "user" ? "ai-message-user" : "ai-message-assistant"}`}
              >
                {msg.role === "assistant"
                  ? renderContent(msg.content)
                  : msg.content}
              </div>
            ))}

            {loading && (
              <div className="ai-message ai-message-assistant ai-thinking">
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
                <span className="ai-thinking-dot" />
              </div>
            )}

            {error && (
              <div className="ai-panel-error" role="alert">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Footer / input */}
          <div className="ai-panel-footer">
            <div className="ai-panel-input-row">
              <textarea
                ref={inputRef}
                className="ai-panel-input"
                placeholder="Ask a question or log a transaction…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                disabled={loading}
                aria-label="Message input"
              />
              <button
                className="ai-panel-send"
                onClick={send}
                disabled={loading || !input.trim()}
                type="button"
                aria-label="Send message"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M16 9L2 2l3 7-3 7 14-7z" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

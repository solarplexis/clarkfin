"use client";

import { useEffect, useRef, useState } from "react";

import type { ActualItem, BudgetItem, ChatConversation } from "@/types/domain";

type Message = { role: "user" | "assistant"; content: string };

export interface BudgetContext {
  income: BudgetItem[];
  savings: BudgetItem[];
  expenses: BudgetItem[];
  notes: string;
  monthlyBalance: number;
  actualIncome: ActualItem[];
  actualSavings: ActualItem[];
  actualExpenses: ActualItem[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BudgetAssistantDrawer({
  budget,
  semesterId,
  onBudgetUpdated
}: {
  budget: BudgetContext;
  semesterId?: string;
  onBudgetUpdated: () => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"history" | "chat">("chat");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (view === "history") setView("chat");
        else closeDrawer();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, view]);

  function closeDrawer() {
    setIsOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  async function loadConversations() {
    if (!semesterId) return;
    try {
      const res = await fetch(
        `/api/student/budget/conversations?semesterId=${encodeURIComponent(semesterId)}`
      );
      if (!res.ok) return;
      const json = (await res.json()) as { conversations?: ChatConversation[] };
      setConversations(json.conversations ?? []);
    } catch (err) {
      console.error("[BudgetAssistantDrawer] loadConversations failed:", err);
    }
  }

  function openDrawer() {
    setMessages([]);
    setActiveConversationId(null);
    setView("chat");
    setIsOpen(true);
    void loadConversations();
  }

  function startNewChat() {
    setMessages([]);
    setActiveConversationId(null);
    setView("chat");
  }

  function openConversation(convo: ChatConversation) {
    setMessages(convo.messages);
    setActiveConversationId(convo.id);
    setView("chat");
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/student/budget/conversations/${id}`, { method: "DELETE" });
    setConversations((c) => c.filter((x) => x.id !== id));
    if (activeConversationId === id) startNewChat();
  }

  async function send() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/student/budget/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-40),
          semesterId,
          budget,
          conversationId: activeConversationId
        })
      });

      const json = (await res.json()) as {
        message?: string;
        error?: string;
        budgetUpdated?: boolean;
        actualsUpdated?: boolean;
        conversationId?: string;
      };

      const reply = res.ok ? (json.message ?? "") : (json.error ?? "Something went wrong.");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);

      if (res.ok) {
        if (json.conversationId && !activeConversationId) {
          setActiveConversationId(json.conversationId);
          void loadConversations();
        }
        if (json.budgetUpdated || json.actualsUpdated) {
          onBudgetUpdated();
        }
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Unable to reach the assistant. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <button ref={triggerRef} className="button-secondary" type="button" onClick={openDrawer}>
        ✦ Ask AI
      </button>

      {isOpen && (
        <div className="ai-drawer-root">
          <button
            aria-label="Close assistant"
            className="ai-drawer-backdrop"
            type="button"
            onClick={closeDrawer}
          />
          <aside aria-label="Finance assistant" aria-modal="true" className="ai-drawer-panel" role="dialog">

            {/* ── Header ── */}
            <header className="ai-drawer-header">
              <span className="ai-drawer-title">Finance Assistant</span>
              <div className="ai-drawer-header-actions">
                <button
                  aria-label="New chat"
                  className="icon-button"
                  title="New chat"
                  type="button"
                  onClick={startNewChat}
                >
                  <NewChatIcon />
                </button>
                <button
                  aria-label="Chat history"
                  className={`icon-button${view === "history" ? " ai-icon-active" : ""}`}
                  title="Chat history"
                  type="button"
                  onClick={() => {
                    if (view === "history") setView("chat");
                    else { void loadConversations(); setView("history"); }
                  }}
                >
                  <HistoryIcon />
                </button>
                <button
                  aria-label="Close"
                  className="icon-button"
                  type="button"
                  onClick={closeDrawer}
                >
                  <CloseIcon />
                </button>
              </div>
            </header>

            {/* ── History panel ── */}
            {view === "history" && (
              <div className="ai-history-panel">
                {conversations.length === 0 ? (
                  <p className="ai-history-empty">No previous conversations.</p>
                ) : (
                  <ul className="ai-history-list">
                    {conversations.map((c) => (
                      <li
                        key={c.id}
                        className={`ai-history-item${c.id === activeConversationId ? " ai-history-item-active" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => openConversation(c)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openConversation(c);
                          }
                        }}
                      >
                        <ChatBubbleIcon />
                        <span className="ai-history-item-title">{c.title}</span>
                        <span className="ai-history-item-time">{timeAgo(c.updatedAt)}</span>
                        <button
                          aria-label={`Delete "${c.title}"`}
                          className="ai-history-item-delete"
                          type="button"
                          onClick={(e) => { void deleteConversation(c.id, e); }}
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Chat view ── */}
            {view === "chat" && (
              <>
                <div className="ai-drawer-messages">
                  {messages.length === 0 && (
                    <p className="ai-drawer-empty">
                      Ask me to update your budget, answer finance questions, or help plan for retirement.
                    </p>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`ai-message ai-message-${msg.role}`}>
                      {msg.content}
                    </div>
                  ))}
                  {isLoading && (
                    <div className="ai-message ai-message-assistant ai-message-thinking">
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot" />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="ai-drawer-footer">
                  <form
                    className="ai-drawer-input-row"
                    onSubmit={(e) => { e.preventDefault(); void send(); }}
                  >
                    <textarea
                      autoFocus
                      className="ai-drawer-input"
                      disabled={isLoading}
                      placeholder="Ask something…"
                      rows={3}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                    <button
                      className="button"
                      disabled={isLoading || !input.trim()}
                      type="submit"
                    >
                      Send
                    </button>
                  </form>
                </div>
              </>
            )}

          </aside>
        </div>
      )}
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────

const CloseIcon = () => (
  <svg fill="none" height="14" viewBox="0 0 16 16" width="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
  </svg>
);

const NewChatIcon = () => (
  <svg fill="none" height="15" viewBox="0 0 16 16" width="15" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V8" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5"/>
    <path d="M11 1l3 3-5 5H6V6l5-5z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

const HistoryIcon = () => (
  <svg fill="none" height="15" viewBox="0 0 16 16" width="15" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 4v4l2.5 2.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M2.5 8a5.5 5.5 0 101 -3.5L2 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
    <path d="M2 2v2h2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

const ChatBubbleIcon = () => (
  <svg fill="none" height="13" viewBox="0 0 16 16" width="13" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 10a2 2 0 01-2 2H5l-3 3V4a2 2 0 012-2h8a2 2 0 012 2v6z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

const TrashIcon = () => (
  <svg fill="none" height="13" viewBox="0 0 16 16" width="13" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4h12M5 4V2h6v2M3 4l1 10h8l1-10M6 7v4M10 7v4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"/>
  </svg>
);

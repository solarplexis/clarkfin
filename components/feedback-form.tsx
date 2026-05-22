"use client";

import { useEffect, useId, useState } from "react";

interface FeedbackData {
  grade: number;
  gradeLetter: string;
  gradeBreakdown: { engagement: number; savings: number; goals: number };
  comments: string;
  emailSent: boolean;
  submittedAt: string;
}

export function FeedbackForm({ semesterId, isOpen = true }: { semesterId: string; isOpen?: boolean }) {
  const errorId = useId();
  const [state, setState] = useState<"loading" | "idle" | "submitting" | "done" | "error">("loading");
  const [comments, setComments] = useState("");
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) { setState("idle"); return; }
    void fetch(`/api/student/feedback?semesterId=${encodeURIComponent(semesterId)}`)
      .then(r => r.json())
      .then((data: { feedback?: FeedbackData }) => {
        if (data.feedback) {
          setFeedback(data.feedback);
          setState("done");
        } else {
          setState("idle");
        }
      })
      .catch(() => setState("idle"));
  }, [semesterId, isOpen]);

  async function submit() {
    if (!comments.trim()) {
      setErrorMsg("Please write a comment before submitting.");
      return;
    }
    setState("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/student/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId, comments })
      });
      const data = await res.json() as { ok?: boolean; feedback?: FeedbackData; error?: string };
      if (!res.ok || !data.feedback) throw new Error(data.error ?? "Submission failed.");
      setFeedback(data.feedback);
      setState("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong.");
      setState("idle");
    }
  }

  return (
    <div className="card fb-card">
      <h3 className="fb-title">Feedback to Instructor</h3>
      <p className="fb-sub">
        Share what you learned, what was challenging, or any comments for your instructor.
        Your performance grade will be calculated and sent along with your feedback.
      </p>

      {state === "loading" && (
        <p className="fb-muted">Loading…</p>
      )}

      {(state === "idle" || state === "submitting") && (
        <>
          <textarea
            aria-describedby={errorMsg ? errorId : undefined}
            aria-invalid={errorMsg ? "true" : undefined}
            className="fb-textarea"
            placeholder="What did you learn? What was most challenging? Any suggestions for the course?"
            value={comments}
            onChange={e => setComments(e.target.value)}
            rows={5}
            disabled={!isOpen || state === "submitting"}
          />
          {errorMsg && <p className="error-msg" id={errorId} role="alert">{errorMsg}</p>}
          {isOpen ? (
            <button
              className="button"
              onClick={submit}
              disabled={state === "submitting"}
            >
              {state === "submitting" ? "Submitting…" : "Submit Feedback"}
            </button>
          ) : (
            <p className="fb-muted">Available in the final week of the course.</p>
          )}
        </>
      )}

      {state === "done" && feedback && (
        <div className="fb-result">
          <div className="fb-grade-row">
            <div className="fb-grade-circle">
              <span className="fb-grade-letter">{feedback.gradeLetter}</span>
              <span className="fb-grade-score">{feedback.grade}/100</span>
            </div>
            <div className="fb-grade-breakdown">
              <div className="fb-grade-item">
                <span className="fb-grade-item-label">Engagement</span>
                <span className="fb-grade-item-value">{feedback.gradeBreakdown.engagement}/40</span>
              </div>
              <div className="fb-grade-item">
                <span className="fb-grade-item-label">Savings</span>
                <span className="fb-grade-item-value">{feedback.gradeBreakdown.savings}/35</span>
              </div>
              <div className="fb-grade-item">
                <span className="fb-grade-item-label">Goals</span>
                <span className="fb-grade-item-value">{feedback.gradeBreakdown.goals}/25</span>
              </div>
            </div>
          </div>

          {feedback.comments && (
            <div className="fb-submitted-comments">
              <span className="fb-submitted-label">Your comments</span>
              <p>{feedback.comments}</p>
            </div>
          )}

          <p className="fb-sent-note">
            {feedback.emailSent
              ? "Feedback and grade sent to your instructor."
              : "Feedback saved. Your instructor will be able to view it."}
          </p>
        </div>
      )}
    </div>
  );
}

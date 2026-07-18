import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset Password"
};

export default function ForgotPasswordPage() {
  return (
    <main className="auth-centered">
      <div className="auth-box">
        <div className="auth-box-header">
          <span className="auth-box-logo">ClarkFin</span>
          <h1>Reset your password</h1>
          <p>Enter your email and we&apos;ll send you a link to reset your password.</p>
        </div>
        <ForgotPasswordForm />
        <p className="auth-box-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}

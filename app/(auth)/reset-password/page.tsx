import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/reset-password-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set New Password"
};

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ oobCode?: string }>;
}) {
  const { oobCode } = await searchParams;

  return (
    <main className="auth-centered">
      <div className="auth-box">
        <div className="auth-box-header">
          <span className="auth-box-logo">ClarkFin</span>
          <h1>Set a new password</h1>
          <p>Choose a new password for your account.</p>
        </div>
        <ResetPasswordForm oobCode={oobCode ?? ""} />
        <p className="auth-box-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}

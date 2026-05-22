import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BootstrapAdminForm } from "@/components/bootstrap-admin-form";
import { hasSystemAdmin } from "@/src/lib/data/repositories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set Up Admin"
};

export default async function BootstrapAdminPage() {
  if (await hasSystemAdmin()) {
    redirect("/login");
  }

  return (
    <main className="page">
      <BootstrapAdminForm />
    </main>
  );
}

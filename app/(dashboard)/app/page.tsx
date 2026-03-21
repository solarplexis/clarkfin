import { redirect } from "next/navigation";

import { requireUser } from "@/src/lib/auth/session";

export default async function AppEntryPage() {
  const user = await requireUser();

  if (user.role === "ADMIN") {
    redirect("/app/admin");
  }

  if (user.role === "ORG_ADMIN") {
    redirect("/app/org");
  }

  redirect("/app/student");
}

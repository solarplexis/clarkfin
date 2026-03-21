import { NextResponse } from "next/server";

import {
  createOrganizationWithDefaultOrgAdmin,
  getCurrentUser
} from "@/src/lib/authz-admin";
import { listOrganizations } from "@/src/lib/data/repositories";

export async function GET() {
  try {
    const adminUser = await getCurrentUser();

    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "ADMIN session required." }, { status: 401 });
    }

    const organizations = await listOrganizations();

    return NextResponse.json({ ok: true, organizations });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load organizations."
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await getCurrentUser();

    if (!adminUser || adminUser.role !== "ADMIN") {
      return NextResponse.json({ error: "ADMIN session required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      orgId?: string;
      name?: string;
      supportEmail?: string;
      allowedEmailDomains?: string;
      brandColor?: string;
      orgAdminFullName?: string;
      orgAdminEmail?: string;
      orgAdminPassword?: string;
    };

    const orgId = String(body.orgId ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const name = String(body.name ?? "").trim();
    const supportEmail = String(body.supportEmail ?? "").trim().toLowerCase();
    const brandColor = String(body.brandColor ?? "").trim();
    const orgAdminFullName = String(body.orgAdminFullName ?? "").trim();
    const orgAdminEmail = String(body.orgAdminEmail ?? "").trim().toLowerCase();
    const orgAdminPassword = String(body.orgAdminPassword ?? "");
    const allowedEmailDomains = String(body.allowedEmailDomains ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (!orgId || !name || !orgAdminFullName || !orgAdminEmail || orgAdminPassword.length < 8) {
      return NextResponse.json(
        {
          error:
            "Organization ID, organization name, org admin name, org admin email, and an 8+ character org admin password are required."
        },
        { status: 400 }
      );
    }

    const result = await createOrganizationWithDefaultOrgAdmin({
      orgId,
      name,
      supportEmail,
      allowedEmailDomains,
      brandColor,
      orgAdminFullName,
      orgAdminEmail,
      orgAdminPassword
    });

    return NextResponse.json({
      ok: true,
      organization: result.organization,
      orgAdmin: result.orgAdmin,
      apiKey: result.apiKey
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create organization."
      },
      { status: 500 }
    );
  }
}

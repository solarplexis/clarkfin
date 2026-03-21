import { NextResponse } from "next/server";

import { buildExportFeedForOrganization, findOrganizationByApiKeyHash } from "@/src/lib/data/repositories";
import { sha256 } from "@/src/lib/security/hash";

export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json({ error: "Missing X-API-KEY header." }, { status: 401 });
  }

  const organization = await findOrganizationByApiKeyHash(sha256(apiKey));

  if (!organization) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const records = await buildExportFeedForOrganization(organization.orgId);

  return NextResponse.json({
    organization: {
      orgId: organization.orgId,
      name: organization.name
    },
    exportedAt: new Date().toISOString(),
    records
  });
}

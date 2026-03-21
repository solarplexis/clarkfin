import type { Metadata } from "next";

import { ApiDocsPage } from "@/components/api-docs-page";

export const metadata: Metadata = {
  title: "ClarkFin API Docs",
  description: "Reference documentation for ClarkFin APIs."
};

export default function ClarkFinApiDocsRoute() {
  return <ApiDocsPage />;
}

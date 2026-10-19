import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";
import { AnalyticsPageClient } from "@/components/analytics/analytics-page-client";

export const metadata: Metadata = {
  title: "Analytics — AI Engineer OS",
  description:
    "Real learning analytics derived from your stored lesson, study-session, assessment and project records.",
};

export default function AnalyticsPage() {
  return (
    <PageLayout>
      <AnalyticsPageClient />
    </PageLayout>
  );
}

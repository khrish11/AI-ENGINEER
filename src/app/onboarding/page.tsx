import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";
import { OnboardingWizard } from "@/components/roadmap/onboarding-wizard";

export const metadata: Metadata = {
  title: "Onboarding — AI Engineer OS",
  description:
    "Tell the roadmap engine your background, goals, and available study time to build a deterministic week-by-week plan.",
};

export default function OnboardingPage() {
  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-3xl space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Build your learning roadmap
          </h1>
          <p className="text-sm text-muted-foreground">
            Seven short steps. Everything stays on this device, works offline, and can be changed
            later without losing progress.
          </p>
        </div>
        <OnboardingWizard />
      </div>
    </PageLayout>
  );
}

import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";
import { RoadmapPageClient } from "@/components/roadmap/roadmap-page-client";

export const metadata: Metadata = {
  title: "Roadmap — AI Engineer OS",
  description:
    "Your deterministic, week-by-week learning roadmap: current week, backlog, buffer weeks, and skill progress computed from real activity.",
};

export default function RoadmapPage() {
  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-7xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Your Roadmap</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Deterministic week-by-week plan built from your curriculum, your track, and your
              real progress — computed locally, no LLM involved.
            </p>
          </div>
        </div>
        <RoadmapPageClient />
      </div>
    </PageLayout>
  );
}

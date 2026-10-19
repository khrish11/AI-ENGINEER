import type { Metadata } from "next";
import { PageLayout } from "@/components/page-layout";
import { TrackCatalog } from "@/components/roadmap/track-catalog";

export const metadata: Metadata = {
  title: "Career Tracks — AI Engineer OS",
  description:
    "Compare the seven supported AI engineering career tracks: core skills, required hours, phases, and major projects.",
};

export default function RoadmapPathsPage() {
  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-5xl space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Career Tracks</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Tracks are configuration, not code: each one classifies every curriculum lesson as
            core, important, optional, or skip. Switching keeps your completed progress.
          </p>
        </div>
        <TrackCatalog />
      </div>
    </PageLayout>
  );
}

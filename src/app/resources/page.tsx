import { PageLayout } from "@/components/page-layout";
import { Badge } from "@/components/ui/badge";
import {
  ResourceBrowser,
  type PhaseOption,
} from "@/components/resources/resource-browser";
import type { ResourceBrowserFilters } from "@/components/resources/resource-browser";
import { getAllResourceViews, getResourceStats } from "@/lib/resources/service";
import { ShieldCheck, BookOpen, Library } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Learning Resources",
  description:
    "Curated, verified learning resources mapped to every lesson in the AI Engineer curriculum: videos, repositories, papers, and documentation.",
};

interface ResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    phase?: string;
  }>;
}

export default async function ResourcesPage({ searchParams }: ResourcesPageProps) {
  const sp = await searchParams;
  const [resources, stats] = await Promise.all([
    getAllResourceViews(),
    getResourceStats(),
  ]);

  const phaseMap = new Map<string, PhaseOption>();
  for (const resource of resources) {
    for (const link of resource.lessons) {
      const existing = phaseMap.get(link.phaseSlug);
      if (existing) {
        existing.count += 1;
      } else {
        phaseMap.set(link.phaseSlug, {
          value: link.phaseSlug,
          label: `Phase ${String(link.phaseNumber).padStart(2, "0")} · ${link.phaseSlug}`,
          count: 1,
        });
      }
    }
  }
  const phases = [...phaseMap.values()].sort((a, b) =>
    a.value.localeCompare(b.value)
  );

  const initialFilters: ResourceBrowserFilters = {
    q: sp.q ?? "",
    type: sp.type ?? "all",
    phase: sp.phase ?? "all",
  };

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Learning Resources
              </h1>
              <Badge variant="default">Curated Registry</Badge>
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="w-3 h-3" /> Vetted Sources
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              High-signal multimedia references mapped to every lesson — videos,
              repositories, research papers, and official documentation, each
              audited for reachability and provenance.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <Library className="w-4 h-4 text-accent-cyan" />
              <span className="font-semibold text-foreground">
                {stats.total}
              </span>
              <span className="text-muted-foreground">resources</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-accent-violet" />
              <span className="font-semibold text-foreground">
                {phases.length}
              </span>
              <span className="text-muted-foreground">phases</span>
            </div>
          </div>
        </div>

        <ResourceBrowser
          resources={resources}
          phases={phases}
          initialFilters={initialFilters}
        />
      </div>
    </PageLayout>
  );
}

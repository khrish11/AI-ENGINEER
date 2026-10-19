import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageLayout } from "@/components/page-layout";
import { ProjectWorkspace } from "@/components/projects/project-workspace";
import { getProjectBySlug, projectCatalog } from "@/lib/projects/catalog";

export function generateStaticParams() {
  return projectCatalog.map((project) => ({ projectSlug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}): Promise<Metadata> {
  const { projectSlug } = await params;
  const project = getProjectBySlug(projectSlug);
  return {
    title: project ? `${project.title} — AI Engineer OS` : "Project — AI Engineer OS",
    description: project?.description ?? "Project workspace",
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const project = getProjectBySlug(projectSlug);
  if (!project || project.status !== "active") notFound();

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-5xl space-y-6">
        <ProjectWorkspace project={project} />
      </div>
    </PageLayout>
  );
}

import { getAllPhases, getLessonDetails, getPhaseDetails } from "@/lib/curriculum/service";
import { getAllResourceViews, getResourcesForLesson } from "@/lib/resources/service";
import { projectCatalog, getProjectBySlug } from "@/lib/projects/catalog";
import { z } from "zod";
import { McpError } from "./errors";
import { GetLessonInput, GetProjectInput, SearchCurriculumInput, SearchProjectsInput, SearchResourcesInput } from "./schemas";
import { publicLessonSummary, publicProject, safeProgressSummary } from "./serializers";
import type { McpResourceDefinition, McpToolDefinition } from "./types";

export const tools: McpToolDefinition[] = [
  {
    name: "get_system_status",
    description: "Return safe adapter capability and version information.",
    inputSchema: z.object({}).strict(),
    policy: "PUBLIC",
    handler: async () => ({
      adapter: "ai-engineer-os",
      mcpAdapterVersion: 1,
      transport: "stdio",
      readOnly: true,
      databaseReachable: null,
      databaseNote: "Database reachability is not probed by the local adapter.",
    }),
  },
  {
    name: "search_curriculum",
    description: "Search the canonical curriculum by title, phase, or keyword.",
    inputSchema: SearchCurriculumInput,
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = SearchCurriculumInput.parse(raw);
      const phases = await getAllPhases();
      const results = [];
      for (const phase of phases) {
        if (input.phase && phase.phaseNumber !== input.phase) continue;
        const details = await getPhaseDetails(phase.slug);
        for (const lesson of details?.lessons ?? []) {
          const haystack = `${lesson.title} ${lesson.tagline ?? ""} ${lesson.slug}`.toLowerCase();
          if (input.query && !haystack.includes(input.query.toLowerCase())) continue;
          results.push(publicLessonSummary(lesson));
          if (results.length >= input.limit) return { results, nextCursor: null };
        }
      }
      return { results, nextCursor: null };
    },
  },
  {
    name: "get_lesson",
    description: "Get metadata for one lesson, with content only when explicitly requested.",
    inputSchema: GetLessonInput,
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = GetLessonInput.parse(raw);
      const lesson = await getLessonDetails(input.phaseSlug, input.lessonSlug);
      if (!lesson) throw new McpError("NOT_FOUND", "Lesson was not found.");
      const summary = {
        ...publicLessonSummary(lesson),
        learningObjectives: lesson.learningObjectives,
        upstreamAttribution: lesson.upstreamAttribution,
      };
      return input.includeContent
        ? { ...summary, markdownContent: lesson.markdownContent, codeFiles: lesson.codeFiles }
        : summary;
    },
  },
  {
    name: "get_learning_resources",
    description: "List curated resources and their verification metadata.",
    inputSchema: SearchResourcesInput,
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = SearchResourcesInput.parse(raw);
      const resources = input.lessonId
        ? await getResourcesForLesson(input.lessonId)
        : await getAllResourceViews();
      const results = resources
        .filter((resource) => !input.type || resource.type === input.type)
        .filter((resource) => {
          if (!input.query) return true;
          return `${resource.title} ${resource.description ?? ""} ${resource.tags.join(" ")}`
            .toLowerCase()
            .includes(input.query.toLowerCase());
        })
        .slice(0, input.limit)
        .map((resource) => ({
          id: resource.id,
          key: resource.key,
          type: resource.type,
          title: resource.title,
          canonicalUrl: resource.canonicalUrl,
          verificationStatus: resource.verificationStatus,
          editorialStatus: resource.editorialStatus,
          license: resource.license,
          sourcePlatform: resource.sourcePlatform,
          lessons: resource.lessons.map((lesson) => ({
            lessonId: lesson.lessonId,
            lessonSlug: lesson.lessonSlug,
            role: lesson.role,
            recommended: lesson.recommended,
          })),
        }));
      return { results, nextCursor: null };
    },
  },
  {
    name: "search_projects",
    description: "Search public project definitions without learner evidence.",
    inputSchema: SearchProjectsInput,
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = SearchProjectsInput.parse(raw);
      const query = input.query?.toLowerCase();
      const results = projectCatalog
        .filter((project) => !input.phase || project.phaseSlugs.includes(input.phase))
        .filter((project) => !query || `${project.title} ${project.description}`.toLowerCase().includes(query))
        .slice(0, input.limit)
        .map((project) => publicProject(project));
      return { results, nextCursor: null };
    },
  },
  {
    name: "get_project",
    description: "Get a public project definition and milestone requirements.",
    inputSchema: GetProjectInput,
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = GetProjectInput.parse(raw);
      const project = getProjectBySlug(input.slug);
      if (!project) throw new McpError("NOT_FOUND", "Project was not found.");
      return publicProject(project);
    },
  },
  {
    name: "get_current_week",
    description: "Get the current learner roadmap week from an explicit local private context.",
    inputSchema: z.object({}),
    policy: "LOCAL_PRIVATE",
    handler: async (_raw, context) => {
      if (!context.progress?.getCurrentWeek) throw new McpError("NOT_AUTHENTICATED", "No local learner context is attached.");
      return safeProgressSummary(await context.progress.getCurrentWeek());
    },
  },
  {
    name: "get_review_queue",
    description: "Get the learner review queue from an explicit local private context.",
    inputSchema: z.object({}),
    policy: "LOCAL_PRIVATE",
    handler: async (_raw, context) => {
      if (!context.progress?.getReviewQueue) throw new McpError("NOT_AUTHENTICATED", "No local learner context is attached.");
      return safeProgressSummary(await context.progress.getReviewQueue());
    },
  },
  {
    name: "get_analytics_overview",
    description: "Get the learner analytics overview from an explicit local private context.",
    inputSchema: z.object({}),
    policy: "LOCAL_PRIVATE",
    handler: async (_raw, context) => {
      if (!context.progress?.getAnalyticsOverview) throw new McpError("NOT_AUTHENTICATED", "No local learner context is attached.");
      return safeProgressSummary(await context.progress.getAnalyticsOverview());
    },
  },
];

export const resources: McpResourceDefinition[] = [
  {
    uriTemplate: "ai-engineer://curriculum/phases",
    name: "Curriculum phases",
    description: "The public curriculum phase index.",
    policy: "PUBLIC",
    read: async () => getAllPhases(),
  },
];

export const prompts = [
  {
    name: "explain_current_lesson",
    description: "Explain a lesson using only supplied public curriculum context.",
    arguments: [{ name: "phaseSlug", description: "Curriculum phase slug.", required: true }, { name: "lessonSlug", description: "Lesson slug.", required: true }],
  },
];

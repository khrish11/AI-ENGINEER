import { getAllPhases, getLessonDetails, getPhaseDetails } from "@/lib/curriculum/service";
import { getAllResourceViews, getResourcesForLesson } from "@/lib/resources/service";
import { projectCatalog, getProjectBySlug } from "@/lib/projects/catalog";
import { z } from "zod";
import { McpError } from "./errors";
import { GetLessonInput, GetProjectInput, SearchCurriculumInput, SearchProjectsInput, SearchResourcesInput } from "./schemas";
import { publicLessonSummary, publicProject, safeProgressSummary } from "./serializers";
import type { McpResourceDefinition, McpToolDefinition, McpPromptDefinition } from "./types";

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
    name: "get_all_phases",
    description: "Get all curriculum phases with lesson counts and metadata.",
    inputSchema: z.object({}).strict(),
    policy: "PUBLIC",
    handler: async () => {
      const phases = await getAllPhases();
      return {
        phases: phases.map((phase) => ({
          phaseNumber: phase.phaseNumber,
          slug: phase.slug,
          title: phase.title,
          description: phase.description,
          lessonCount: phase.lessonCount,
        })),
        totalPhases: phases.length,
      };
    },
  },
  {
    name: "get_phase_details",
    description: "Get detailed information about a specific phase including all lessons.",
    inputSchema: z.object({
      phaseSlug: z.string().describe("The slug of the phase to fetch"),
    }).strict(),
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = z.object({ phaseSlug: z.string() }).parse(raw);
      const details = await getPhaseDetails(input.phaseSlug);
      if (!details) throw new McpError("NOT_FOUND", "Phase was not found.");
      return {
        phaseNumber: details.phase.phaseNumber,
        slug: details.phase.slug,
        title: details.phase.title,
        lessons: details.lessons.map((lesson) => publicLessonSummary(lesson)),
        lessonCount: details.lessons.length,
      };
    },
  },
  {
    name: "suggest_learning_path",
    description: "Suggest a learning path based on learner's current progress and goals.",
    inputSchema: z.object({
      goal: z.string().describe("Learning goal: e.g., 'LLM engineering', 'RAG systems', 'agent development'"),
      currentPhase: z.number().optional().describe("Current phase number if already started"),
      timeAvailable: z.string().optional().describe("Available time: e.g., '10 hours/week', '20 hours/week'"),
    }).strict(),
    policy: "PUBLIC",
    handler: async (raw) => {
      const input = z.object({
        goal: z.string(),
        currentPhase: z.number().optional(),
        timeAvailable: z.string().optional(),
      }).parse(raw);
      
      const phases = await getAllPhases();
      const goalLower = input.goal.toLowerCase();
      
      let recommendedPhases = phases;
      if (goalLower.includes("llm") || goalLower.includes("language model")) {
        recommendedPhases = phases.filter(p => p.phaseNumber >= 8 && p.phaseNumber <= 14);
      } else if (goalLower.includes("rag") || goalLower.includes("retrieval")) {
        recommendedPhases = phases.filter(p => p.phaseNumber >= 10 && p.phaseNumber <= 12);
      } else if (goalLower.includes("agent")) {
        recommendedPhases = phases.filter(p => p.phaseNumber >= 13 && p.phaseNumber <= 16);
      } else if (goalLower.includes("fundamental") || goalLower.includes("basic")) {
        recommendedPhases = phases.filter(p => p.phaseNumber <= 7);
      }
      
      if (input.currentPhase !== undefined) {
        recommendedPhases = recommendedPhases.filter(p => p.phaseNumber >= input.currentPhase!);
      }
      
      return {
        goal: input.goal,
        currentPhase: input.currentPhase ?? null,
        timeAvailable: input.timeAvailable ?? null,
        recommendedPhases: recommendedPhases.slice(0, 5).map(p => ({
          phaseNumber: p.phaseNumber,
          slug: p.slug,
          title: p.title,
          lessonCount: p.lessonCount,
        })),
        totalRecommended: recommendedPhases.length,
      };
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
  {
    uriTemplate: "ai-engineer://curriculum/lesson-counts",
    name: "Curriculum lesson counts",
    description: "Lesson counts per phase for tracking progress.",
    policy: "PUBLIC",
    read: async () => {
      const phases = await getAllPhases();
      return phases.map((phase) => ({
        phaseNumber: phase.phaseNumber,
        slug: phase.slug,
        title: phase.title,
        lessonCount: phase.lessonCount,
      }));
    },
  },
  {
    uriTemplate: "ai-engineer://stats/overview",
    name: "Curriculum statistics",
    description: "Overall curriculum statistics.",
    policy: "PUBLIC",
    read: async () => {
      const phases = await getAllPhases();
      const totalLessons = phases.reduce((sum, p) => sum + p.lessonCount, 0);
      return {
        totalPhases: phases.length,
        totalLessons,
        firstPhase: phases[0]?.slug ?? null,
        lastPhase: phases[phases.length - 1]?.slug ?? null,
      };
    },
  },
  {
    uriTemplate: "ai-engineer://resources/catalog",
    name: "Resource catalog",
    description: "All curated learning resources with verification status.",
    policy: "PUBLIC",
    read: async () => getAllResourceViews(),
  },
];

export const prompts: McpPromptDefinition[] = [
  {
    name: "explain_current_lesson",
    description: "Explain a lesson using only supplied public curriculum context.",
    arguments: [
      { name: "phaseSlug", description: "Curriculum phase slug.", required: true },
      { name: "lessonSlug", description: "Lesson slug.", required: true },
    ],
  },
];

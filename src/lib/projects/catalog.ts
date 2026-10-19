import reproEnv from "../../../projects/catalog/00-setup-and-tooling/reproducible-ai-dev-environment.json";
import gdVisualizer from "../../../projects/catalog/01-math-foundations/gradient-descent-visualizer.json";
import supervisedSystem from "../../../projects/catalog/02-ml-fundamentals/supervised-learning-system.json";
import nnScratch from "../../../projects/catalog/03-deep-learning-core/nn-from-scratch-pytorch-comparison.json";
import cvClassifier from "../../../projects/catalog/04-computer-vision/image-classifier-inference-api.json";
import semanticRetriever from "../../../projects/catalog/05-nlp-foundations-to-advanced/semantic-text-retriever.json";
import audioPipeline from "../../../projects/catalog/06-speech-and-audio/audio-transcription-pipeline.json";
import attentionViz from "../../../projects/catalog/07-transformers-deep-dive/attention-from-scratch-visualizer.json";
import generativeExperiment from "../../../projects/catalog/08-generative-ai/generative-model-experiment.json";
import gridworldRl from "../../../projects/catalog/09-reinforcement-learning/gridworld-rl-agent.json";
import miniLm from "../../../projects/catalog/10-llms-from-scratch/tokenizer-mini-lm.json";
import ragApp from "../../../projects/catalog/11-llm-engineering/evaluated-rag-application.json";
import docQa from "../../../projects/catalog/12-multimodal-ai/document-image-qa.json";
import mcpServer from "../../../projects/catalog/13-tools-and-protocols/schema-validated-mcp-server.json";
import approvalAgent from "../../../projects/catalog/14-agent-engineering/tool-using-agent-approval-gates.json";
import resumableAgent from "../../../projects/catalog/15-autonomous-systems/resumable-long-running-agent.json";
import multiAgent from "../../../projects/catalog/16-multi-agent-and-swarms/multi-agent-coordination.json";
import productionService from "../../../projects/catalog/17-infrastructure-and-production/production-ai-service.json";
import redteamSuite from "../../../projects/catalog/18-ethics-safety-alignment/safety-evaluation-redteam.json";
import capstoneRag from "../../../projects/catalog/19-capstone-projects/production-rag-platform.json";
import capstoneResearchAgent from "../../../projects/catalog/19-capstone-projects/autonomous-research-agent.json";
import capstoneMultimodal from "../../../projects/catalog/19-capstone-projects/multimodal-research-assistant.json";
import capstoneInfra from "../../../projects/catalog/19-capstone-projects/ai-infrastructure-project.json";
import capstoneEvalPlatform from "../../../projects/catalog/19-capstone-projects/ai-evaluation-platform.json";

import {
  ProjectDefinitionSchema,
  type ProjectDefinition,
  type ProjectLevel,
} from "./schema";
import { validateProject } from "./validation";

/**
 * Static registry: adding a project means adding a JSON file under
 * `projects/catalog/<phase-slug>/` and one import line here. The CLI
 * (`npm run projects:validate`) validates the on-disk directory directly,
 * which is the contributor path (docs/PROJECT_STUDIO.md).
 */
const rawProjects: unknown[] = [
  reproEnv,
  gdVisualizer,
  supervisedSystem,
  nnScratch,
  cvClassifier,
  semanticRetriever,
  audioPipeline,
  attentionViz,
  generativeExperiment,
  gridworldRl,
  miniLm,
  ragApp,
  docQa,
  mcpServer,
  approvalAgent,
  resumableAgent,
  multiAgent,
  productionService,
  redteamSuite,
  capstoneRag,
  capstoneResearchAgent,
  capstoneMultimodal,
  capstoneInfra,
  capstoneEvalPlatform,
];

function buildCatalog(): ProjectDefinition[] {
  const parsed: ProjectDefinition[] = [];
  for (const raw of rawProjects) {
    const result = ProjectDefinitionSchema.safeParse(raw);
    if (!result.success) {
      // Catalog integrity failures are programming errors, not learner errors.
      throw new Error(`Invalid project definition: ${result.error.message}`);
    }
    const validation = validateProject(result.data);
    if (!validation.ok) {
      throw new Error(
        `Invalid project ${result.data.id}: ${validation.issues.join("; ")}`
      );
    }
    parsed.push(result.data);
  }
  return parsed.sort((a, b) => a.phaseSlugs[0].localeCompare(b.phaseSlugs[0]));
}

export const projectCatalog: ProjectDefinition[] = buildCatalog();

const byId = new Map(projectCatalog.map((project) => [project.id, project]));
const bySlug = new Map(projectCatalog.map((project) => [project.slug, project]));

export function getProjectById(projectId: string): ProjectDefinition | undefined {
  return byId.get(projectId);
}

export function getProjectBySlug(projectSlug: string): ProjectDefinition | undefined {
  return bySlug.get(projectSlug);
}

export const PROJECT_LEVELS_ORDER: ProjectLevel[] = [
  "beginner",
  "intermediate",
  "advanced",
  "capstone",
];

export interface ProjectCatalogFilters {
  level?: ProjectLevel[];
  phaseSlugs?: string[];
  skillIds?: string[];
  trackIds?: string[];
  status?: "active" | "draft" | "deprecated";
  search?: string;
}

export function filterProjects(filters: ProjectCatalogFilters): ProjectDefinition[] {
  const search = filters.search?.trim().toLowerCase();
  return projectCatalog.filter((project) => {
    if (filters.level?.length && !filters.level.includes(project.level)) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.phaseSlugs?.length && !project.phaseSlugs.some((p) => filters.phaseSlugs!.includes(p))) return false;
    if (filters.skillIds?.length && !project.skills.some((s) => filters.skillIds!.includes(s))) return false;
    if (filters.trackIds?.length && !project.relevantTracks.some((t) => filters.trackIds!.includes(t))) return false;
    if (search) {
      const haystack = `${project.title} ${project.description} ${project.skills.join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

export function getProjectsForTrack(trackId: string): ProjectDefinition[] {
  return projectCatalog
    .filter((project) => project.relevantTracks.includes(trackId))
    .sort(
      (a, b) =>
        PROJECT_LEVELS_ORDER.indexOf(a.level) - PROJECT_LEVELS_ORDER.indexOf(b.level) ||
        a.estimatedHours - b.estimatedHours
    );
}

export function getProjectsForPhase(phaseSlug: string): ProjectDefinition[] {
  return projectCatalog.filter((project) => project.phaseSlugs.includes(phaseSlug));
}

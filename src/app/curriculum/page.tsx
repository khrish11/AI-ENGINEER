import * as React from "react";
import { PageLayout } from "@/components/page-layout";
import {
  CurriculumExplorerClient,
  PhaseDisplayData,
} from "@/components/curriculum/curriculum-explorer-client";
import { getAllPhases, getCurriculumStats } from "@/lib/curriculum/service";

export const metadata = {
  title: "Curriculum Explorer | AI Engineer OS",
  description:
    "Explore 20 comprehensive phases covering AI Engineering from scratch: deep learning, RAG, fine-tuning, autonomous agents, and production MLOps.",
};

// BUG-06 fix: entries were re-aligned to the canonical upstream phase list
// (upstream/ai-engineering-from-scratch/phases/00..19). Keys are phase
// numbers as stored in the database; descriptions/topics now match the
// actual phase titles (Setup, Math, Classical ML, DL Core, CV, NLP, Speech,
// Transformers, GenAI, RL, LLMs-from-scratch, LLM Eng, Multimodal, Tools,
// Agents, Autonomous, Swarms, Infra, Ethics, Capstone).
const PHASE_METADATA_FALLBACK: Record<
  number,
  {
    tier: "Foundations" | "Intermediate" | "Advanced" | "Mastery";
    description: string;
    topics: string[];
    fallbackLessons: number;
    fallbackHours: number;
  }
> = {
  0: {
    tier: "Foundations",
    description:
      "Environment setup: Linux CLI, UV/pip toolchains, Git, Docker, GPU/CUDA drivers, and editor workflows, provisioned lesson-by-lesson as the route needs them.",
    topics: ["Linux CLI", "UV", "Git", "Docker"],
    fallbackLessons: 25,
    fallbackHours: 12,
  },
  1: {
    tier: "Foundations",
    description:
      "The intuition behind every AI algorithm through code: matrix decompositions, multivariable calculus, probability, and gradient descent.",
    topics: ["Linear Algebra", "Calculus", "Probability", "SVD"],
    fallbackLessons: 25,
    fallbackHours: 20,
  },
  2: {
    tier: "Foundations",
    description:
      "Classical machine learning — still the backbone of production AI: linear & logistic models, decision trees, ensembles (XGBoost/LightGBM), clustering, PCA, and evaluation metrics.",
    topics: ["Scikit-Learn", "XGBoost", "Clustering", "Ensembles"],
    fallbackLessons: 25,
    fallbackHours: 22,
  },
  3: {
    tier: "Foundations",
    description:
      "Neural networks from first principles: hand-written backpropagation, MLPs, activations, optimizers, and regularization — no framework until you build one yourself.",
    topics: ["Backpropagation", "MLPs", "Optimizers", "Regularization"],
    fallbackLessons: 25,
    fallbackHours: 28,
  },
  4: {
    tier: "Foundations",
    description:
      "From pixels to understanding across image, video, and 3D: CNNs, Vision Transformers (ViT), object detection, segmentation, and CLIP representations.",
    topics: ["CNNs", "Vision Transformers", "Detection", "CLIP"],
    fallbackLessons: 25,
    fallbackHours: 22,
  },
  5: {
    tier: "Foundations",
    description:
      "Language as the interface to intelligence: tokenization, Word2Vec/GloVe embeddings, recurrent networks, LSTMs, and sequence-to-sequence models from foundations to advanced pipelines.",
    topics: ["Tokenization", "BPE", "Seq2Seq", "Embeddings"],
    fallbackLessons: 25,
    fallbackHours: 20,
  },
  6: {
    tier: "Intermediate",
    description:
      "Hear, understand, speak: spectrogram analysis, Whisper ASR, CTC loss, diarization, and speech generation with Bark/XTTS.",
    topics: ["Whisper", "ASR", "Spectrograms", "TTS"],
    fallbackLessons: 25,
    fallbackHours: 14,
  },
  7: {
    tier: "Intermediate",
    description:
      "The architecture that changed everything: mathematical self-attention, multi-head attention, rotary positional embeddings (RoPE), KV cache, and transformers built from scratch.",
    topics: ["Self-Attention", "RoPE", "KV Cache", "FlashAttention"],
    fallbackLessons: 25,
    fallbackHours: 32,
  },
  8: {
    tier: "Intermediate",
    description:
      "Create images, video, audio, and 3D: VAEs, GANs, normalizing flows, and diffusion models from the denoising math up to production generation pipelines.",
    topics: ["Diffusion", "GANs", "VAEs", "Stable Diffusion"],
    fallbackLessons: 25,
    fallbackHours: 24,
  },
  9: {
    tier: "Intermediate",
    description:
      "Agents that learn by doing: MDPs, Q-learning, policy gradients, PPO, and the RLHF foundation underneath modern LLM alignment.",
    topics: ["MDPs", "Q-Learning", "Policy Gradients", "RLHF"],
    fallbackLessons: 25,
    fallbackHours: 22,
  },
  10: {
    tier: "Advanced",
    description:
      "Build, train, and understand large language models: tokenizers, pre-training runs, scaling laws, and fine-tuning, end to end from raw math.",
    topics: ["Pre-training", "Tokenizer", "Scaling Laws", "GPT"],
    fallbackLessons: 25,
    fallbackHours: 30,
  },
  11: {
    tier: "Advanced",
    description:
      "Put LLMs to work in production: in-context learning, prompt systems, structured outputs, RAG with vector search and rerankers, and LLM-as-a-judge evals.",
    topics: ["RAG", "Structured Outputs", "Evals", "Prompt Systems"],
    fallbackLessons: 25,
    fallbackHours: 26,
  },
  12: {
    tier: "Advanced",
    description:
      "Models that see, hear, read, and reason across modalities: vision-language models, image-text alignment, audio-video understanding, and omni-modality APIs.",
    topics: ["VLMs", "Image-Text Alignment", "Omni Models", "Multimodal RAG"],
    fallbackLessons: 25,
    fallbackHours: 22,
  },
  13: {
    tier: "Advanced",
    description:
      "The interfaces between AI and the real world: function calling, tool schemas, Model Context Protocol (MCP), and interoperable agent-to-agent protocols.",
    topics: ["Function Calling", "MCP", "Tool Schemas", "A2A"],
    fallbackLessons: 25,
    fallbackHours: 20,
  },
  14: {
    tier: "Advanced",
    description:
      "Build agents from first principles: ReAct loops, plan-and-solve, stateful LangGraph workflows, tool-calling runtimes, and agent memory.",
    topics: ["ReAct Loop", "LangGraph", "Agent Runtimes", "Memory"],
    fallbackLessons: 25,
    fallbackHours: 32,
  },
  15: {
    tier: "Mastery",
    description:
      "Agents that run without human intervention, safely: closed-loop autonomy, computer-use agents, guardrails, oversight, and supervised release.",
    topics: ["Autonomy", "Guardrails", "Computer Use", "Oversight"],
    fallbackLessons: 25,
    fallbackHours: 24,
  },
  16: {
    tier: "Mastery",
    description:
      "Coordination, emergence, and collective intelligence: delegation topologies, shared memory, communication protocols, and swarm-scale agent systems.",
    topics: ["Swarms", "Delegation", "Shared Memory", "Emergence"],
    fallbackLessons: 25,
    fallbackHours: 26,
  },
  17: {
    tier: "Mastery",
    description:
      "Ship AI to the real world: quantization (AWQ, GPTQ, GGUF), vLLM and TensorRT-LLM serving, Kubernetes, Triton, monitoring, and cost optimization.",
    topics: ["vLLM", "Quantization", "Kubernetes", "Observability"],
    fallbackLessons: 25,
    fallbackHours: 30,
  },
  18: {
    tier: "Mastery",
    description:
      "Build AI that helps humanity: prompt injection defenses, jailbreak mitigations, red-teaming harnesses, alignment, and privacy preservation.",
    topics: ["Prompt Injection", "Red Teaming", "Alignment", "Privacy"],
    fallbackLessons: 25,
    fallbackHours: 18,
  },
  19: {
    tier: "Mastery",
    description:
      "Prove everything you learned: architect and deploy portfolio-grade AI systems with evaluation pipelines, observability, and docs.",
    topics: ["Full System Design", "Benchmarking", "Deployment", "Documentation"],
    fallbackLessons: 25,
    fallbackHours: 40,
  },
};

export default async function CurriculumPage() {
  const [phasesFromDb, stats] = await Promise.all([
    getAllPhases(),
    getCurriculumStats(),
  ]);

  let phases: PhaseDisplayData[] = [];

  if (phasesFromDb.length > 0) {
    phases = phasesFromDb.map((p) => {
      const meta = PHASE_METADATA_FALLBACK[p.phaseNumber] || {
        tier: p.phaseNumber <= 5 ? "Foundations" : p.phaseNumber <= 11 ? "Intermediate" : p.phaseNumber <= 16 ? "Advanced" : "Mastery",
        description: `Comprehensive lessons, coding exercises, and quizzes covering Phase ${p.phaseNumber}.`,
        topics: ["AI Engineering", "Production Systems"],
        fallbackLessons: 25,
        fallbackHours: 20,
      };

      const hours = p.totalEstimatedMinutes > 0
        ? Math.max(1, Math.round(p.totalEstimatedMinutes / 60))
        : meta.fallbackHours;

      return {
        number: p.phaseNumber,
        slug: p.slug,
        title: p.title,
        tier: meta.tier,
        description: meta.description,
        lessonCount: p.lessonCount,
        estimatedHours: hours,
        topics: meta.topics,
        status: p.status,
      };
    });
  } else {
    // Graceful fallback if database is loading or unpopulated
    phases = Object.entries(PHASE_METADATA_FALLBACK).map(([numStr, meta]) => {
      const num = parseInt(numStr, 10);
      return {
        number: num,
        slug: `phase-${String(num).padStart(2, "0")}`,
        title: `Phase ${String(num).padStart(2, "0")}`,
        tier: meta.tier,
        description: meta.description,
        lessonCount: meta.fallbackLessons,
        estimatedHours: meta.fallbackHours,
        topics: meta.topics,
        status: "Not Started",
      };
    });
  }

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 max-w-7xl">
        <CurriculumExplorerClient
          initialPhases={phases}
          stats={{
            phaseCount: stats.phaseCount,
            lessonCount: stats.lessonCount,
            quizCount: stats.quizCount,
            commitSha: stats.activeRevision?.commitSha,
          }}
        />
      </div>
    </PageLayout>
  );
}

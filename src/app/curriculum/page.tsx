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
      "Linux CLI, UV package manager, CUDA toolchain, Git, Docker, and developer environments.",
    topics: ["CUDA", "UV", "Docker", "PyTorch Setup"],
    fallbackLessons: 25,
    fallbackHours: 12,
  },
  1: {
    tier: "Foundations",
    description:
      "Matrix decompositions, multivariable calculus, probability distributions, and gradient descent.",
    topics: ["Linear Algebra", "Calculus", "Probability", "SVD"],
    fallbackLessons: 25,
    fallbackHours: 20,
  },
  2: {
    tier: "Foundations",
    description:
      "Asyncio, memory management, profiling, Pydantic v2, Ruff linting, and Pytest suites.",
    topics: ["Asyncio", "Pydantic", "Pytest", "Profiling"],
    fallbackLessons: 25,
    fallbackHours: 18,
  },
  3: {
    tier: "Foundations",
    description:
      "Polars, DuckDB, Arrow formats, feature stores, and distributed ETL pipelines.",
    topics: ["Polars", "DuckDB", "Apache Arrow", "Parquet"],
    fallbackLessons: 25,
    fallbackHours: 16,
  },
  4: {
    tier: "Foundations",
    description:
      "Linear & logistic models, decision trees, ensemble methods (XGBoost/LightGBM), and PCA.",
    topics: ["Scikit-Learn", "XGBoost", "Clustering", "Ensembles"],
    fallbackLessons: 25,
    fallbackHours: 22,
  },
  5: {
    tier: "Foundations",
    description:
      "Loss functions, ROC-AUC, cross-validation, MLflow, Weights & Biases experiment tracking.",
    topics: ["MLflow", "W&B", "Cross-Validation", "Metrics"],
    fallbackLessons: 25,
    fallbackHours: 14,
  },
  6: {
    tier: "Intermediate",
    description:
      "Backpropagation math, PyTorch autograd, custom layers, activations, and residual networks.",
    topics: ["PyTorch Autograd", "ResNet", "Loss Surfaces", "CNNs"],
    fallbackLessons: 25,
    fallbackHours: 28,
  },
  7: {
    tier: "Intermediate",
    description:
      "ViT (Vision Transformers), object detection, segment anything, and CLIP representations.",
    topics: ["Vision Transformers", "CLIP", "Diffusion", "Detection"],
    fallbackLessons: 25,
    fallbackHours: 22,
  },
  8: {
    tier: "Intermediate",
    description:
      "Tokenization, Word2Vec, GloVe, recurrent networks, LSTMs, and sequence-to-sequence models.",
    topics: ["Tokenization", "BPE", "Seq2Seq", "Embeddings"],
    fallbackLessons: 25,
    fallbackHours: 20,
  },
  9: {
    tier: "Intermediate",
    description:
      "Spectrogram analysis, Whisper ASR, CTC loss, and speech generation with Bark/XTTS.",
    topics: ["Whisper", "ASR", "Spectrograms", "TTS"],
    fallbackLessons: 25,
    fallbackHours: 14,
  },
  10: {
    tier: "Advanced",
    description:
      "Mathematical self-attention, multi-head attention, rotary positional embeddings (RoPE), KV cache.",
    topics: ["Multi-Head Attention", "RoPE", "KV Cache", "FlashAttention"],
    fallbackLessons: 25,
    fallbackHours: 32,
  },
  11: {
    tier: "Advanced",
    description:
      "In-context learning, function calling, JSON schemas, structured outputs, and LLM-as-a-judge evals.",
    topics: ["Structured Outputs", "Prompt Systems", "Evals", "Guardrails"],
    fallbackLessons: 25,
    fallbackHours: 26,
  },
  12: {
    tier: "Advanced",
    description:
      "Vector search, HNSW indices, semantic chunking, BM25 hybrid search, and cross-encoder rerankers.",
    topics: ["Vector Databases", "Hybrid Search", "Rerankers", "GraphRAG"],
    fallbackLessons: 25,
    fallbackHours: 30,
  },
  13: {
    tier: "Advanced",
    description:
      "LoRA, QLoRA, DPO (Direct Preference Optimization), SFT, Unsloth, and dataset curation.",
    topics: ["LoRA / QLoRA", "DPO", "Unsloth", "Dataset Cleaning"],
    fallbackLessons: 25,
    fallbackHours: 28,
  },
  14: {
    tier: "Advanced",
    description:
      "ReAct loops, plan-and-solve, stateful LangGraph, tool-calling agents, and Model Context Protocol (MCP).",
    topics: ["ReAct Loop", "LangGraph", "MCP Protocol", "Multi-Agent"],
    fallbackLessons: 25,
    fallbackHours: 32,
  },
  15: {
    tier: "Mastery",
    description:
      "Quantization (AWQ, GPTQ, GGUF), llama.cpp, vLLM, TensorRT-LLM, speculative decoding.",
    topics: ["vLLM", "Quantization", "llama.cpp", "Speculative Decoding"],
    fallbackLessons: 25,
    fallbackHours: 24,
  },
  16: {
    tier: "Mastery",
    description:
      "Kubernetes orchestration, Triton Inference Server, Prometheus monitoring, rate limiting, and observability.",
    topics: ["Kubernetes", "Triton Server", "OpenTelemetry", "CI/CD"],
    fallbackLessons: 25,
    fallbackHours: 30,
  },
  17: {
    tier: "Mastery",
    description:
      "Prompt injection defenses, jailbreak mitigations, red-teaming harnesses, and privacy preservation.",
    topics: ["Prompt Injection", "Red Teaming", "Differential Privacy", "OWASP AI"],
    fallbackLessons: 25,
    fallbackHours: 18,
  },
  18: {
    tier: "Mastery",
    description:
      "Healthcare AI, Financial modeling, Code generation engines, and Autonomous developer agents.",
    topics: ["Code Agents", "Healthcare AI", "Financial LLMs", "Synthetics"],
    fallbackLessons: 25,
    fallbackHours: 20,
  },
  19: {
    tier: "Mastery",
    description:
      "Architect and deploy an enterprise-grade AI system with evaluation pipelines, observability, and docs.",
    topics: ["Full System Design", "SLA Guarantees", "Benchmarking", "Deployment"],
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

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  ShieldCheck,
  Terminal,
  Cpu,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function LandingPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent-cyan/20">
      {/* Top minimal nav */}
      <nav aria-label="Landing navigation" className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet flex items-center justify-center text-white font-bold text-sm shadow-sm">
              AI
            </div>
            <span className="font-bold tracking-tight text-base">AI Engineer OS</span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] font-mono">
              Phase 1 MVP
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/curriculum" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              Curriculum
            </Link>
            <Link href="/resources" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline">
              Resources
            </Link>
            <Link href="/dashboard">
              <Button size="sm" variant="default" className="gap-1.5 shadow-sm">
                Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32 border-b border-border/40">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-accent-cyan/15 to-accent-violet/15 blur-3xl rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/25 text-accent-cyan text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Production-Grade Open-Source AI Engineering Curriculum</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-balance leading-[1.1]">
              AI Engineer OS: The Developer Operating System for{" "}
              <span className="bg-gradient-to-r from-accent-cyan via-accent-violet to-accent-cyan bg-clip-text text-transparent">
                AI Engineering
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance font-normal leading-relaxed">
              Transition from software engineer to senior AI engineer. Master foundational math, deep learning, transformers, LLM prompt systems, RAG, autonomous agents, and production MLOps.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link href="/curriculum">
                <Button size="lg" variant="default" className="w-full sm:w-auto gap-2 text-base shadow-md">
                  Explore 20 Phases <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto text-base">
                  Launch Learner Dashboard
                </Button>
              </Link>
            </div>

            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-status-success" /> 100% Free & Open Source
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-status-success" /> Local-First Offline Mode
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-status-success" /> Upstream Verified
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 Pillars Grid */}
      <section className="py-20 bg-surface/50 border-b border-border">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Engineered for Depth, Not Surface Demos
            </h2>
            <p className="text-muted-foreground text-sm">
              Built on verified code implementations, rigorous mathematical derivations, and production architecture patterns.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-border bg-surface flex flex-col justify-between hover:border-accent-cyan/50 transition-all duration-200">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-accent-cyan/15 text-accent-cyan flex items-center justify-center">
                  <Terminal className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">20 Progressive Phases</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Carefully sequenced progression starting from CUDA/tooling setup and calculus all the way to multi-agent deployment on Triton clusters.
                </p>
              </div>
              <div className="pt-6 border-t border-border/50 text-xs text-accent-cyan font-semibold">
                500+ structured lessons &rarr;
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface flex flex-col justify-between hover:border-accent-violet/50 transition-all duration-200">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-accent-violet/15 text-accent-violet flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">Hands-On Code Lab</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Build attention mechanisms, vector databases, KV cache optimizations, and autonomous tool-calling loops without magical one-line wrappers.
                </p>
              </div>
              <div className="pt-6 border-t border-border/50 text-xs text-accent-violet font-semibold">
                Python, TypeScript, CUDA &rarr;
              </div>
            </div>

            <div className="p-6 rounded-2xl border border-border bg-surface flex flex-col justify-between hover:border-status-success/50 transition-all duration-200">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-status-success/15 text-status-success flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold">Cryptographic Progress</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Canonical lesson UUIDs guarantee your notes and progress are permanent, independent of upstream revisions or branch renames.
                </p>
              </div>
              <div className="pt-6 border-t border-border/50 text-xs text-status-success font-semibold">
                Local-first IndexedDB &rarr;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-8 bg-surface text-xs text-muted-foreground">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">AI Engineer OS</span>
            <span>• MIT Licensed</span>
          </div>
          <div>
            Derived and curated under MIT License from upstream open-source curriculum.
          </div>
        </div>
      </footer>
    </main>
  );
}

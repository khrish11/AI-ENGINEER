// Landing page with Google OAuth sign-in - matches upstream design
"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  LogIn,
  GitBranch,
  Globe,
  BookOpen,
  Play,
} from "lucide-react";

export default function LandingPage() {
  const handleSignIn = async () => {
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#0a0a0a] text-[#e5e5e5] flex flex-col">
      {/* Header */}
      <header className="border-b border-[#333] bg-[#0a0a0a]">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold tracking-tight text-sm">AI Engineering from Scratch</span>
            <span className="text-xs text-[#888]">curriculum v1.0 · 2026</span>
            <span className="text-xs text-[#00bcd4]">open source · MIT</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/curriculum" className="text-sm text-[#888] hover:text-[#e5e5e5] transition-colors">
              Curriculum
            </Link>
            <Link href="/resources" className="text-sm text-[#888] hover:text-[#e5e5e5] transition-colors">
              Resources
            </Link>
            <Button size="sm" variant="outline" className="gap-1.5 border-[#444] bg-transparent hover:bg-[#333] text-[#e5e5e5]" onClick={handleSignIn}>
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-32 border-b border-[#333]">
        <div className="container mx-auto px-4 max-w-4xl text-center space-y-8">
          <h1 className="text-6xl sm:text-8xl font-extrabold tracking-tight text-balance leading-[1.1]">
            AI Engineering
            <br />
            <span className="text-[#00bcd4]">from Scratch</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#888] max-w-2xl mx-auto text-balance font-normal leading-relaxed">
            Every published lesson. Every phase. Every algorithm built from raw math before a single framework gets imported.
          </p>

          <p className="text-sm text-[#888]">
            Maintained by Rohit Ghumare and contributors. Run on your own machine.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/curriculum">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-base bg-[#00bcd4] hover:bg-[#00bcd4]/90 text-white border-0">
                <Play className="w-4 h-4" /> Start the Course <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 border-[#444] bg-transparent hover:bg-[#333] text-[#e5e5e5]" onClick={handleSignIn}>
              <LogIn className="w-4 h-4" /> Sign In to Save Progress
            </Button>
          </div>

          <div className="pt-8 flex flex-wrap items-center justify-center gap-8 text-sm text-[#888]">
            <span className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              <a href="https://github.com/rohitg00/ai-engineering-from-scratch" target="_blank" rel="noopener noreferrer" className="hover:text-[#e5e5e5] transition-colors">
                Star on GitHub
              </a>
            </span>
            <span className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <a href="https://aiengineeringfromscratch.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#e5e5e5] transition-colors">
                Original Site
              </a>
            </span>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-b border-[#333] bg-[#0f0f1a]">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-[#00bcd4]">20</div>
              <div className="text-sm text-[#888] mt-1">Phases</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#7c3aed]">542</div>
              <div className="text-sm text-[#888] mt-1">Lessons</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#00bcd4]">2,087</div>
              <div className="text-sm text-[#888] mt-1">Quiz Questions</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#7c3aed]">1,364</div>
              <div className="text-sm text-[#888] mt-1">Code Files</div>
            </div>
          </div>
        </div>
      </section>

      {/* How This Works */}
      <section className="py-20 border-b border-[#333]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight mb-3 text-center">
            How This Works
          </h2>
          <p className="text-[#888] text-sm text-center mb-12 max-w-2xl mx-auto">
            Most AI material teaches in scattered pieces. This curriculum is the spine.
          </p>

          <div className="space-y-8 text-center">
            <p className="text-[#e5e5e5] leading-relaxed">
              Every phase, every published lesson, four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it's doing under the hood.
            </p>
            <p className="text-[#e5e5e5] leading-relaxed">
              Each lesson runs the same loop: read the problem, derive the math, write the code, run the test, keep the artifact. No five-minute videos, no copy-paste deploys, no hand-holding. Free, open source, and built to run on your own laptop.
            </p>
          </div>
        </div>
      </section>

      {/* Learning Paths */}
      <section className="py-20 border-b border-[#333] bg-[#0f0f1a]">
        <div className="container mx-auto px-4 max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight mb-3 text-center">
            Choose the Work You Want to Do
          </h2>
          <p className="text-[#888] text-sm text-center mb-12">
            AI engineering is larger than model code. Choose one of four core learning paths.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#00bcd4]/50 transition-all">
              <h3 className="font-bold text-lg mb-2">Building and Deploying AI Applications</h3>
              <p className="text-sm text-[#888] mb-4">Move from prompts, structured outputs, embeddings, and retrieval through evaluation, serving, observability, and safe release.</p>
              <Link href="/curriculum">
                <Button variant="outline" size="sm" className="w-full border-[#444] bg-transparent hover:bg-[#333] text-[#e5e5e5]">Start Path</Button>
              </Link>
            </div>
            <div className="p-6 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#7c3aed]/50 transition-all">
              <h3 className="font-bold text-lg mb-2">Software Engineering Fundamentals</h3>
              <p className="text-sm text-[#888] mb-4">Build the repository, environment, interface, debugging, verification, security, release, and operational foundations AI systems depend on.</p>
              <Link href="/curriculum">
                <Button variant="outline" size="sm" className="w-full border-[#444] bg-transparent hover:bg-[#333] text-[#e5e5e5]">Start Path</Button>
              </Link>
            </div>
            <div className="p-6 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#00bcd4]/50 transition-all">
              <h3 className="font-bold text-lg mb-2">Agent-Assisted Engineering</h3>
              <p className="text-sm text-[#888] mb-4">Frame the task, plan from repository evidence, engineer the loop and harness, isolate delegation, verify the result, and preserve feedback.</p>
              <Link href="/curriculum">
                <Button variant="outline" size="sm" className="w-full border-[#444] bg-transparent hover:bg-[#333] text-[#e5e5e5]">Start Path</Button>
              </Link>
            </div>
            <div className="p-6 rounded-xl border border-[#333] bg-[#0a0a0a] hover:border-[#7c3aed]/50 transition-all">
              <h3 className="font-bold text-lg mb-2">Product Judgment and Delivery</h3>
              <p className="text-sm text-[#888] mb-4">Turn observed work into outcomes, assumptions, testable slices, executable specifications, measurement plans, staged releases, and owned feedback.</p>
              <Link href="/curriculum">
                <Button variant="outline" size="sm" className="w-full border-[#444] bg-transparent hover:bg-[#333] text-[#e5e5e5]">Start Path</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#333] py-8 bg-[#0a0a0a] text-xs text-[#888]">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#e5e5e5]">AI Engineer OS</span>
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

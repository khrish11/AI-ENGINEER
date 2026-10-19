"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  LayoutDashboard,
  FolderKanban,
  Settings,
  Compass,
  ArrowRight,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface SearchResult {
  id: string;
  title: string;
  category: "Curriculum" | "Navigation" | "Topic" | "Settings";
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SEARCH_ITEMS: SearchResult[] = [
  {
    id: "nav-dashboard",
    title: "Learner Dashboard",
    category: "Navigation",
    href: "/dashboard",
    description: "Overview of your progress, streak, and daily tasks",
    icon: LayoutDashboard,
  },
  {
    id: "nav-curriculum",
    title: "Curriculum Browser",
    category: "Navigation",
    href: "/curriculum",
    description: "Browse 20 phases and 500+ AI engineering lessons",
    icon: BookOpen,
  },
  {
    id: "nav-resources",
    title: "Learning Resources",
    category: "Navigation",
    href: "/resources",
    description: "Curated videos, code repositories, and research papers",
    icon: Compass,
  },
  {
    id: "nav-projects",
    title: "Projects & Challenges",
    category: "Navigation",
    href: "/projects",
    description: "Milestone projects with rubrics and proof-of-work",
    icon: FolderKanban,
  },
  {
    id: "nav-roadmap",
    title: "Personalized Roadmap",
    category: "Navigation",
    href: "/roadmap",
    description: "Week-by-week study plan with buffer weeks",
    icon: Compass,
  },
  {
    id: "nav-settings",
    title: "Settings & Sync",
    category: "Settings",
    href: "/settings",
    description: "Manage guest mode, appearance, and export progress",
    icon: Settings,
  },
  {
    id: "phase-00",
    title: "Phase 00: Environment & Tooling Setup",
    category: "Curriculum",
    href: "/curriculum",
    description: "CUDA, PyTorch, UV, Docker, Git, and development environments",
    icon: BookOpen,
  },
  {
    id: "phase-01",
    title: "Phase 01: Mathematics for AI Engineering",
    category: "Curriculum",
    href: "/curriculum",
    description: "Linear algebra, multivariable calculus, probability, and optimization",
    icon: BookOpen,
  },
  {
    id: "phase-06",
    title: "Phase 06: Deep Learning & Neural Networks",
    category: "Curriculum",
    href: "/curriculum",
    description: "Backpropagation, optimizers, regularization, and CNNs",
    icon: BookOpen,
  },
  {
    id: "phase-10",
    title: "Phase 10: Transformer Architecture from Scratch",
    category: "Curriculum",
    href: "/curriculum",
    description: "Self-attention, multi-head attention, positional encodings",
    icon: BookOpen,
  },
  {
    id: "phase-11",
    title: "Phase 11: LLM Engineering & Prompt Systems",
    category: "Curriculum",
    href: "/curriculum",
    description: "System prompts, structured outputs, function calling, and evals",
    icon: BookOpen,
  },
  {
    id: "phase-12",
    title: "Phase 12: Retrieval-Augmented Generation (RAG)",
    category: "Curriculum",
    href: "/curriculum",
    description: "Vector embeddings, chunking, hybrid search, and reranking",
    icon: BookOpen,
  },
  {
    id: "phase-14",
    title: "Phase 14: AI Agents & Tool Use",
    category: "Curriculum",
    href: "/curriculum",
    description: "ReAct loop, plan-and-solve, multi-agent frameworks, and MCP",
    icon: BookOpen,
  },
];

export interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const filteredItems = React.useMemo(() => {
    if (!query.trim()) return SEARCH_ITEMS.slice(0, 8);
    const q = query.toLowerCase();
    return SEARCH_ITEMS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const selectItem = (item: SearchResult) => {
    onOpenChange(false);
    router.push(item.href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredItems.length - 1
      );
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      selectItem(filteredItems[selectedIndex]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-surface border-border">
        {/* Search Input Box */}
        <div className="flex items-center px-4 border-b border-border bg-surface">
          <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search lessons, phases, tools, or press ESC to close..."
            className="w-full h-14 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
            aria-label="Search AI Engineer OS"
          />
        </div>

        {/* Results List */}
        <div
          role="listbox"
          aria-label="Search results"
          className="max-h-80 overflow-y-auto p-2 divide-y divide-border/30"
        >
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const Icon = item.icon;
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-accent-cyan/10 text-accent-cyan"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-md ${
                        isSelected
                          ? "bg-cyan-700 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isSelected
                        ? "translate-x-1 opacity-100 text-accent-cyan"
                        : "opacity-0"
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono">
                ↑
              </kbd>{" "}
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono">
                ↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono">
                ↵
              </kbd>{" "}
              Select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface border border-border rounded text-[10px] font-mono">
              ESC
            </kbd>{" "}
            Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

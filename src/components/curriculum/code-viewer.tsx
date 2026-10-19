"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, Copy, Check, FileCode } from "lucide-react";

export interface CodeFileItem {
  filename: string;
  relativePath: string;
  language: string;
  sizeBytes: number;
  content?: string;
}

export interface CodeViewerProps {
  files: CodeFileItem[];
}

export function CodeViewer({ files }: CodeViewerProps) {
  const [selectedFileIdx, setSelectedFileIdx] = React.useState(0);
  const [copied, setCopied] = React.useState(false);

  if (!files || files.length === 0) {
    return (
      <Card variant="surface" className="text-center p-8 border-dashed">
        <Code2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-1">No Standalone Code Files</h3>
        <p className="text-xs text-muted-foreground">
          Code implementations for this lesson are embedded directly within the markdown reading text.
        </p>
      </Card>
    );
  }

  const activeFile = files[selectedFileIdx] || files[0];

  const handleCopy = () => {
    if (activeFile.content) {
      navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
        {files.map((file, idx) => (
          <button
            key={file.relativePath || idx}
            onClick={() => setSelectedFileIdx(idx)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-colors whitespace-nowrap ${
              idx === selectedFileIdx
                ? "bg-accent-cyan/15 text-accent-cyan font-semibold border border-accent-cyan/30"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{file.relativePath || file.filename}</span>
            <span className="text-[10px] text-muted-foreground font-sans">
              ({Math.round(file.sizeBytes / 1024)} KB)
            </span>
          </button>
        ))}
      </div>

      {/* Code Viewer Panel */}
      <div className="rounded-xl border border-border bg-[#0d1117] text-slate-100 shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-border/40 text-xs text-muted-foreground font-mono">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200">
              {activeFile.relativePath || activeFile.filename}
            </span>
            <Badge variant="muted" className="text-[10px]">
              {activeFile.language}
            </Badge>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-status-success" />
                <span className="text-[11px] text-status-success">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="text-[11px]">Copy File</span>
              </>
            )}
          </button>
        </div>

        <pre className="p-4 overflow-x-auto text-xs font-mono leading-relaxed max-h-[600px] overflow-y-auto">
          <code>{activeFile.content || "// File content not previewable"}</code>
        </pre>
      </div>
    </div>
  );
}

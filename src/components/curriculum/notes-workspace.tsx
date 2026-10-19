"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Check, FileText, Loader2 } from "lucide-react";
import { useNotes } from "@/hooks/useNotes";

export interface NotesWorkspaceProps {
  lessonId: string;
  lessonTitle: string;
}

export function NotesWorkspace({ lessonId, lessonTitle }: NotesWorkspaceProps) {
  const { draft, updateDraft, save, saving, note } = useNotes(lessonId, "lesson");
  const [justSaved, setJustSaved] = React.useState(false);

  const handleManualSave = async () => {
    await save(draft);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  return (
    <Card className="border-border">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-cyan" />
            <h3 className="text-sm font-semibold text-foreground">
              Personal Study Notes for: {lessonTitle}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" /> Autosaving...
              </span>
            )}
            <Button
              size="sm"
              variant={justSaved ? "secondary" : "default"}
              onClick={() => void handleManualSave()}
              className="gap-1.5 text-xs"
            >
              {justSaved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-status-success" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Note</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {note?.conflictState === "unresolved" && (
          <div className="p-3 bg-status-warning/15 border border-status-warning text-status-warning rounded-lg text-xs">
            Conflict detected between this device and cloud sync. Your local edits are preserved.
          </div>
        )}

        <textarea
          data-testid="notes-editor"
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          placeholder="Capture your key takeaways, code experiment notes, mental models, or questions for review..."
          className="w-full min-h-[300px] rounded-lg border border-border bg-surface p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan font-sans"
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span>Notes are saved locally in IndexedDB with debounced autosave.</span>
          <span>{draft.length} characters • Revision {note?.localRevision ?? 1}</span>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { notesRepo } from "@/lib/progress/repositories/notes";
import type { Note } from "@/lib/progress/db";

export function useNotes(
  targetId: string | null,
  targetType: "lesson" | "resource" | "project"
) {
  const [note, setNote] = useState<Note | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!targetId) {
      setNote(null);
      setDraft("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const loaded =
        targetType === "lesson"
          ? await notesRepo.getByLesson(targetId)
          : targetType === "resource"
            ? await notesRepo.getByResource(targetId)
            : await notesRepo.getByProject(targetId);
      setNote(loaded);
      setDraft(loaded?.content ?? "");
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (content: string) => {
      if (!targetId) return null;
      setSaving(true);
      try {
        const result = await notesRepo.upsert({
          lessonId: targetType === "lesson" ? targetId : null,
          resourceId: targetType === "resource" ? targetId : null,
          projectId: targetType === "project" ? targetId : null,
          content,
        });
        setNote(result);
        return result;
      } finally {
        setSaving(false);
      }
    },
    [targetId, targetType]
  );

  const updateDraft = useCallback(
    (content: string) => {
      setDraft(content);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void save(content);
      }, 800);
    },
    [save]
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { note, draft, loading, saving, save, updateDraft, refetch: load };
}

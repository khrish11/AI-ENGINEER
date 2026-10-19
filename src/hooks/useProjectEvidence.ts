"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { projectEvidenceRepo, type AttachEvidenceInput } from "@/lib/progress/repositories/project-evidence";
import type { ProjectEvidence } from "@/lib/progress/db";

export function useProjectEvidence(projectId: string | null) {
  const [evidence, setEvidence] = useState<ProjectEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    if (!projectId) {
      if (request === loadRequest.current) {
        setEvidence([]);
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    try {
      const rows = await projectEvidenceRepo.getByProject(projectId);
      if (request === loadRequest.current) {
        setEvidence(rows);
      }
    } finally {
      if (request === loadRequest.current) {
        setLoading(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attach = useCallback(
    async (input: Omit<AttachEvidenceInput, "projectId">) => {
      if (!projectId) return null;
      const record = await projectEvidenceRepo.attach({ projectId, ...input });
      await load();
      return record;
    },
    [projectId, load]
  );

  const remove = useCallback(async (recordId: string) => {
    await projectEvidenceRepo.remove(recordId);
    await load();
  }, [load]);

  return { evidence, loading, attach, remove, refetch: load };
}

export function useAllProjectEvidence() {
  const [items, setItems] = useState<ProjectEvidence[]>([]);
  useEffect(() => {
    void projectEvidenceRepo.getAll().then((rows) => setItems(rows.filter((r) => !r.deletedAt)));
  }, []);
  return items;
}

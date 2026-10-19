"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { studySessionsRepo } from "@/lib/progress/repositories/study-sessions";
import type { StudySession } from "@/lib/progress/db";
import { getOrCreateDeviceId } from "@/lib/progress/device";
import { newId } from "@/lib/progress/records";

export function useStudySession(target?: {
  lessonId?: string | null;
  resourceId?: string | null;
  projectId?: string | null;
}) {
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const startedAt = useRef<string | null>(null);
  const clientSessionId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await studySessionsRepo.getAll());
      setTotalDuration(await studySessionsRepo.getTotalDuration());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = useCallback(async () => {
    startedAt.current = new Date().toISOString();
    clientSessionId.current = newId();
  }, []);

  const stop = useCallback(async () => {
    if (!startedAt.current || !clientSessionId.current) return;
    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      1,
      Math.round((Date.parse(endedAt) - Date.parse(startedAt.current)) / 1000)
    );
    const deviceId = await getOrCreateDeviceId();
    await studySessionsRepo.create({
      clientSessionId: clientSessionId.current,
      deviceId,
      lessonId: target?.lessonId ?? null,
      resourceId: target?.resourceId ?? null,
      projectId: target?.projectId ?? null,
      startedAt: startedAt.current,
      endedAt,
      durationSeconds,
    });
    startedAt.current = null;
    clientSessionId.current = null;
    await load();
  }, [load, target?.lessonId, target?.projectId, target?.resourceId]);

  const create = useCallback(
    async (input: Parameters<typeof studySessionsRepo.create>[0]) => {
      const result = await studySessionsRepo.create(input);
      await load();
      return result;
    },
    [load]
  );

  useEffect(() => {
    void start();
    return () => {
      void stop();
    };
    // Start once when a lesson workspace mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lessonId]);

  return { sessions, totalDuration, loading, create, start, stop, refetch: load };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { bookmarksRepo } from "@/lib/progress/repositories/bookmarks";
import type { Bookmark } from "@/lib/progress/db";

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookmarks(await bookmarksRepo.getAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleBookmark = useCallback(
    async (input: Parameters<typeof bookmarksRepo.toggleBookmark>[0]) => {
      const result = await bookmarksRepo.toggleBookmark(input);
      await load();
      return result;
    },
    [load]
  );

  const remove = useCallback(
    async (bookmarkId: string) => {
      await bookmarksRepo.remove(bookmarkId);
      await load();
    },
    [load]
  );

  return { bookmarks, loading, toggleBookmark, remove, refetch: load };
}

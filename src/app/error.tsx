"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Runtime error caught:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center"
    >
      <div className="w-12 h-12 rounded-full bg-status-error/15 border border-status-error/30 flex items-center justify-center text-status-error mb-4">
        <AlertCircle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight mb-2">
        Something went wrong
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {error.message || "An unexpected error occurred while rendering this view."}
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={() => reset()} variant="default" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Button
          onClick={() => window.location.assign("/dashboard")}
          variant="secondary"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}

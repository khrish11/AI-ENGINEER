import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-accent-cyan/15 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan mb-6">
        <FileQuestion className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">
        Page Not Found (404)
      </h1>
      <p className="text-sm text-muted-foreground max-w-md mb-8">
        The route or lesson you requested does not exist or may have been relocated in the curriculum revision.
      </p>
      <Link href="/dashboard">
        <Button variant="default" className="gap-2">
          <Home className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>
    </div>
  );
}

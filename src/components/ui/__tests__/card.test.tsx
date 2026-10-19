import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../card";

describe("Card Component", () => {
  it("renders card with title and description", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Title</CardTitle>
          <CardDescription>Test Description</CardDescription>
        </CardHeader>
        <CardContent>Test Content</CardContent>
      </Card>
    );

    expect(screen.getByText("Test Title")).toBeTruthy();
    expect(screen.getByText("Test Description")).toBeTruthy();
    expect(screen.getByText("Test Content")).toBeTruthy();
  });

  it("applies variant classes correctly", () => {
    const { container } = render(<Card variant="surface">Test</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card?.className).toContain("bg-surface");
  });
});

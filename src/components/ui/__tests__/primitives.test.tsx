import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../button";
import { Badge } from "../badge";
import { Input } from "../input";
import { Progress } from "../progress";
import { Skeleton } from "../skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../accordion";

describe("Button Component", () => {
  it("renders with default props and handles click", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    const button = screen.getByRole("button", { name: "Click Me" });
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("renders loading state with disabled attribute and spinner", () => {
    render(<Button isLoading>Submit</Button>);
    const button = screen.getByRole("button", { name: "Submit" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("applies secondary and destructive variant styles", () => {
    const { container: c1 } = render(<Button variant="secondary">Sec</Button>);
    expect(c1.querySelector("button")?.className).toContain("bg-surface");

    const { container: c2 } = render(<Button variant="destructive">Dest</Button>);
    expect(c2.querySelector("button")?.className).toContain("bg-status-error");
  });
});

describe("Badge Component", () => {
  it("renders badge variants properly", () => {
    render(<Badge variant="success">Completed</Badge>);
    const badge = screen.getByText("Completed");
    expect(badge).toBeTruthy();
    expect(badge.className).toContain("text-status-success");
  });
});

describe("Input Component", () => {
  it("renders with value and fires change event", () => {
    const handleChange = vi.fn();
    render(
      <Input
        placeholder="Enter name"
        onChange={handleChange}
        aria-label="Name"
      />
    );
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "John Doe" } });
    expect(handleChange).toHaveBeenCalled();
  });

  it("applies error border when error prop is true", () => {
    const { container } = render(<Input error placeholder="Err" />);
    expect(container.querySelector("input")?.className).toContain("border-status-error");
  });
});

describe("Progress Component", () => {
  it("renders with correct ARIA attributes", () => {
    render(<Progress value={40} max={100} />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });
});

describe("Skeleton Component", () => {
  it("renders with aria-busy for accessibility", () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.className).toContain("animate-pulse");
  });
});

describe("Tabs Component", () => {
  it("switches tabs and displays active content with ARIA roles", () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">First</TabsTrigger>
          <TabsTrigger value="tab2">Second</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>
    );

    expect(screen.getByText("Content 1")).toBeTruthy();
    expect(screen.queryByText("Content 2")).toBeNull();

    const secondTab = screen.getByRole("tab", { name: "Second" });
    fireEvent.click(secondTab);

    expect(screen.getByText("Content 2")).toBeTruthy();
    expect(screen.queryByText("Content 1")).toBeNull();
  });
});

describe("Accordion Component", () => {
  it("toggles item content on trigger click", () => {
    render(
      <Accordion type="single">
        <AccordionItem value="item-1">
          <AccordionTrigger>Section 1</AccordionTrigger>
          <AccordionContent>Section 1 Details</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const trigger = screen.getByRole("button", { name: /section 1/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Section 1 Details")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Section 1 Details")).toBeTruthy();

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Section 1 Details")).toBeNull();
  });
});

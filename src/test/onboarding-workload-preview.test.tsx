import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/components/roadmap/onboarding-wizard";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  actions: {
    saveProfile: vi.fn(),
    savePlacement: vi.fn(),
    generate: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/hooks/useRoadmap", () => ({
  useRoadmap: () => ({ ready: true, working: false, actions: mocks.actions }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: async () => ({ questions: [] }),
  }));
});

async function chooseRadio(user: ReturnType<typeof userEvent.setup>, group: string, option: string) {
  const radioGroup = screen.getByRole("radiogroup", { name: group });
  await user.click(within(radioGroup).getByRole("radio", { name: option }));
}

async function continueStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue" }));
}

describe("onboarding workload preview", () => {
  it("applies the five declared known skills before generation without saving", async () => {
    const user = userEvent.setup();
    render(<OnboardingWizard />);

    await user.click(screen.getByRole("radio", { name: "Other" }));
    await continueStep(user);

    for (const skill of ["Python", "JavaScript / TypeScript", "Git", "Linux / Shell", "SQL", "Docker"]) {
      await chooseRadio(user, skill, "None");
    }
    await continueStep(user);

    for (const skill of ["Linear algebra", "Calculus", "Probability", "Statistics"]) {
      await chooseRadio(user, skill, "Weak");
    }
    await continueStep(user);

    for (const skill of [
      "Classical ML",
      "Neural networks",
      "PyTorch",
      "Transformers",
      "LLM applications",
      "RAG",
      "Agents",
      "Deployment / MLOps",
    ]) {
      await chooseRadio(user, skill, "None");
    }
    await continueStep(user);

    await user.click(screen.getByRole("radio", { name: /General AI Engineer/ }));
    await continueStep(user);

    fireEvent.change(screen.getByLabelText("Hours per week", { exact: true }), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Start date", { exact: true }), {
      target: { value: "2026-11-02" },
    });
    await chooseRadio(user, "Buffer weeks", "No buffer weeks");
    await continueStep(user);

    for (const topic of ["Python", "Git", "Docker & Containers", "Transformer Architecture", "Attention"]) {
      await user.click(screen.getByRole("checkbox", { name: topic }));
    }
    expect(
      screen.getAllByRole("checkbox").filter((input) => (input as HTMLInputElement).checked)
    ).toHaveLength(5);
    await continueStep(user);

    expect(screen.getByTestId("preview-total-workload").textContent).toBe(
      "350 lessons · 543h 15m"
    );
    expect(screen.getByTestId("preview-weeks").textContent).toBe("55 weeks at 10h/week");
    expect(screen.getByTestId("preview-core-count").textContent).toBe("4");
    expect(screen.getByTestId("preview-prerequisite-delta").textContent).toBe("0 · 0h");
    expect(mocks.actions.saveProfile).not.toHaveBeenCalled();
    expect(mocks.actions.savePlacement).not.toHaveBeenCalled();
    expect(mocks.actions.generate).not.toHaveBeenCalled();
  }, 15_000);
});

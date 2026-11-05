"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useRoadmap } from "@/hooks/useRoadmap";
import { tracks, skillsByGroup, skillsById, formatMinutes } from "@/lib/roadmap/config";
import {
  CAPSTONE_TRACKS,
  CAPSTONE_OVERLAP_NOTICES,
  OPTIONAL_CAPSTONE_PRODUCTS,
  REQUIRED_CAPSTONES,
} from "@/lib/roadmap/capstones";
import { calculateCapstonePreview } from "@/lib/roadmap/capstone-preview";
import { todayIso, formatLongDate } from "@/lib/roadmap/dates";
import { recommendPlacement, phaseTitle } from "@/lib/roadmap/placement";
import { trackStats } from "@/lib/roadmap/tracks";
import {
  AI_SKILLS,
  BACKGROUNDS,
  BUFFER_PREFERENCES,
  MATH_LEVELS,
  MATH_SKILLS,
  PROGRAMMING_SKILLS,
  PROFICIENCY_LEVELS,
  type BufferPreference,
  type LearnerProfile,
  type MathLevel,
  type PlacementResult,
  type Proficiency,
  type RoadmapSettings,
  type TrackId,
} from "@/lib/roadmap/types";

const STEP_TITLES = [
  "Background",
  "Programming",
  "Mathematics",
  "AI & Machine Learning",
  "Goal",
  "Schedule",
  "Experience",
  "Capstone plan",
] as const;

const BACKGROUND_LABELS: Record<(typeof BACKGROUNDS)[number], string> = {
  "cs-student": "Computer science student",
  "software-engineer": "Software engineer",
  "ml-data": "ML / data background",
  "self-taught": "Self-taught developer",
  researcher: "Research background",
  other: "Other",
};

const PROGRAMMING_LABELS: Record<(typeof PROGRAMMING_SKILLS)[number], string> = {
  python: "Python",
  javascript: "JavaScript / TypeScript",
  git: "Git",
  linux: "Linux / Shell",
  sql: "SQL",
  docker: "Docker",
};

const MATH_LABELS: Record<(typeof MATH_SKILLS)[number], string> = {
  "linear-algebra": "Linear algebra",
  calculus: "Calculus",
  probability: "Probability",
  statistics: "Statistics",
};

const AI_LABELS: Record<(typeof AI_SKILLS)[number], string> = {
  "classical-ml": "Classical ML",
  "neural-networks": "Neural networks",
  pytorch: "PyTorch",
  transformers: "Transformers",
  "llm-applications": "LLM applications",
  rag: "RAG",
  agents: "Agents",
  deployment: "Deployment / MLOps",
};

const BUFFER_LABELS: Record<BufferPreference, string> = {
  none: "No buffer weeks",
  monthly: "Automatic monthly buffer",
  manual: "I will add my own buffer weeks",
};

interface PlacementQuestion {
  id: string;
  questionText: string;
  options: string[];
  phaseSlug: string;
}

function LevelPicker<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  labels,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labels?: Record<string, string>;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground mb-2">{legend}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <label
            key={option}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
              value === option
                ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                : "border-border bg-surface text-muted-foreground hover:border-foreground/20"
            }`}
          >
            <input
              type="radio"
              className="sr-only"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {labels?.[option] ?? option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function OnboardingWizard() {
  const router = useRouter();
  const { ready, working, actions } = useRoadmap();
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const [background, setBackground] = React.useState<(typeof BACKGROUNDS)[number]>("self-taught");
  const [programming, setProgramming] = React.useState<Record<string, Proficiency>>({
    python: "basic",
    javascript: "none",
    git: "none",
    linux: "none",
    sql: "none",
    docker: "none",
  });
  const [math, setMath] = React.useState<Record<string, MathLevel>>({
    "linear-algebra": "weak",
    calculus: "weak",
    probability: "weak",
    statistics: "weak",
  });
  const [ai, setAi] = React.useState<Record<string, Proficiency>>({
    "classical-ml": "none",
    "neural-networks": "none",
    pytorch: "none",
    transformers: "none",
    "llm-applications": "none",
    rag: "none",
    agents: "none",
    deployment: "none",
  });
  const [trackId, setTrackId] = React.useState<TrackId>("general-ai");
  const [hoursPerWeek, setHoursPerWeek] = React.useState(10);
  const [studyDays, setStudyDays] = React.useState<number[]>([1, 3, 5]);
  const [startDate, setStartDate] = React.useState(todayIso());
  const [targetDate, setTargetDate] = React.useState("");
  const [bufferPreference, setBufferPreference] =
    React.useState<BufferPreference>("monthly");
  const [includeOptional, setIncludeOptional] = React.useState(false);
  const [knownTopics, setKnownTopics] = React.useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
  const [selectedTrackIds, setSelectedTrackIds] = React.useState<string[]>([]);

  const [questions, setQuestions] = React.useState<PlacementQuestion[]>([]);
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const [quizLoading, setQuizLoading] = React.useState(false);
  const [placement, setPlacement] = React.useState<PlacementResult | null>(null);

  const profile: LearnerProfile = React.useMemo(
    () => ({
      background,
      programming: programming as LearnerProfile["programming"],
      math: math as LearnerProfile["math"],
      ai: ai as LearnerProfile["ai"],
      knownTopicSkillIds: knownTopics,
      goalTrackId: trackId,
      updatedAt: new Date().toISOString(),
    }),
    [background, programming, math, ai, knownTopics, trackId]
  );

  const settings: RoadmapSettings = React.useMemo(
    () => ({
      trackId,
      availableHoursPerWeek: hoursPerWeek,
      startDate,
      targetDate: targetDate || null,
      studyDays,
      bufferPreference,
      includeOptionalTopics: includeOptional,
      bufferWeeks: [],
      manuallyIncluded: [],
      manuallyExcluded: [],
      manualWeekAssignments: {},
      knownOccurrenceIds: [],
      capstoneSelection: { version: 1, selectedProductIds, selectedTrackIds },
    }),
    [
      trackId,
      hoursPerWeek,
      startDate,
      targetDate,
      studyDays,
      bufferPreference,
      includeOptional,
      selectedProductIds,
      selectedTrackIds,
    ]
  );

  const preview = React.useMemo(
    () =>
      calculateCapstonePreview({
        ...settings,
        knownOccurrenceIds: placement?.skimOccurrenceIds ?? [],
      }),
    [settings, placement]
  );

  const canContinue = React.useCallback(() => {
    switch (step) {
      case 5:
        return hoursPerWeek >= 1 && studyDays.length > 0 && Boolean(startDate);
      default:
        return true;
    }
  }, [step, hoursPerWeek, studyDays, startDate]);

  const loadQuiz = React.useCallback(async () => {
    setQuizLoading(true);
    try {
      const response = await fetch("/api/roadmap/placement");
      const data = (await response.json()) as { questions: PlacementQuestion[] };
      setQuestions(data.questions ?? []);
    } catch {
      setQuestions([]);
    } finally {
      setQuizLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadQuiz();
  }, [loadQuiz]);

  const runPlacement = async () => {
    try {
      let result: PlacementResult;
      if (questions.length > 0 && Object.keys(answers).length > 0) {
        const response = await fetch("/api/roadmap/placement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
        const data = (await response.json()) as {
          correct: number;
          total: number;
          weakSkillIds: string[];
        };
        result = recommendPlacement(profile, {
          correct: data.correct,
          total: data.total,
          weakSkillIds: data.weakSkillIds,
        });
      } else {
        result = recommendPlacement(profile);
      }
      setPlacement(result);
    } catch {
      setPlacement(recommendPlacement(profile));
    }
  };

  const generate = async () => {
    setError(null);
    try {
      const finalPlacement = placement ?? recommendPlacement(profile);
      await actions.saveProfile(profile);
      await actions.savePlacement(finalPlacement);
      await actions.generate({ ...settings, knownOccurrenceIds: finalPlacement.skimOccurrenceIds });
      router.push("/roadmap");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate your roadmap.");
    }
  };

  const toggleStudyDay = (day: number) => {
    setStudyDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b)
    );
  };

  const toggleTopic = (skillId: string) => {
    setKnownTopics((current) =>
      current.includes(skillId)
        ? current.filter((value) => value !== skillId)
        : [...current, skillId]
    );
  };

  const toggleSelection = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id].sort()
    );
  };

  const progressPercent = Math.round(((step + 1) / STEP_TITLES.length) * 100);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {step + 1} of {STEP_TITLES.length} — {STEP_TITLES[step]}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} aria-label="Onboarding progress" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEP_TITLES[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {BACKGROUNDS.map((option) => (
                <label
                  key={option}
                  className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                    background === option
                      ? "border-accent-cyan bg-accent-cyan/10 text-foreground"
                      : "border-border bg-surface text-muted-foreground hover:border-foreground/20"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="background"
                    value={option}
                    checked={background === option}
                    onChange={() => setBackground(option)}
                  />
                  {BACKGROUND_LABELS[option]}
                </label>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Be honest — this only changes where your plan starts, never what you have
                completed.
              </p>
              {PROGRAMMING_SKILLS.map((skill) => (
                <LevelPicker
                  key={skill}
                  legend={PROGRAMMING_LABELS[skill]}
                  name={`programming-${skill}`}
                  options={PROFICIENCY_LEVELS}
                  labels={{ none: "None", basic: "Basic", comfortable: "Comfortable", strong: "Strong" }}
                  value={programming[skill]}
                  onChange={(next) => setProgramming((current) => ({ ...current, [skill]: next }))}
                />
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {MATH_SKILLS.map((skill) => (
                <LevelPicker
                  key={skill}
                  legend={MATH_LABELS[skill]}
                  name={`math-${skill}`}
                  options={MATH_LEVELS}
                  labels={{ weak: "Weak", okay: "Okay", comfortable: "Comfortable", strong: "Strong" }}
                  value={math[skill]}
                  onChange={(next) => setMath((current) => ({ ...current, [skill]: next }))}
                />
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {AI_SKILLS.map((skill) => (
                <LevelPicker
                  key={skill}
                  legend={AI_LABELS[skill]}
                  name={`ai-${skill}`}
                  options={PROFICIENCY_LEVELS}
                  labels={{ none: "None", basic: "Basic", comfortable: "Comfortable", strong: "Strong" }}
                  value={ai[skill]}
                  onChange={(next) => setAi((current) => ({ ...current, [skill]: next }))}
                />
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {tracks.map((track) => {
                const stats = trackStats(track.id);
                const selected = trackId === track.id;
                return (
                  <label
                    key={track.id}
                    className={`cursor-pointer rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                      selected
                        ? "border-accent-cyan bg-accent-cyan/10"
                        : "border-border bg-surface hover:border-foreground/20"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name="track"
                      value={track.id}
                      checked={selected}
                      onChange={() => setTrackId(track.id)}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{track.name}</h3>
                      {selected && <Badge variant="default">Selected</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{track.tagline}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <Badge variant="outline">{stats.core} core</Badge>
                      <Badge variant="outline">~{stats.requiredHours}h required</Badge>
                      <Badge variant="outline">{stats.phases.length} phases</Badge>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">Hours per week</span>
                  <Input
                    type="number"
                    min={1}
                    max={40}
                    value={hoursPerWeek}
                    onChange={(event) => setHoursPerWeek(Number(event.target.value) || 1)}
                    aria-label="Hours per week"
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">Start date</span>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    aria-label="Start date"
                  />
                </label>
                <label className="space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">
                    Target completion date{" "}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <Input
                    type="date"
                    value={targetDate}
                    onChange={(event) => setTargetDate(event.target.value)}
                    aria-label="Target completion date"
                  />
                </label>
                <div className="space-y-1.5 text-sm">
                  <span className="font-medium text-foreground">Study days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, day) => (
                      <label
                        key={label}
                        className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                          studyDays.includes(day)
                            ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                            : "border-border bg-surface text-muted-foreground"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={studyDays.includes(day)}
                          onChange={() => toggleStudyDay(day)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <LevelPicker
                legend="Buffer weeks"
                name="buffer-preference"
                options={BUFFER_PREFERENCES}
                labels={BUFFER_LABELS}
                value={bufferPreference}
                onChange={setBufferPreference}
              />

              <label className="flex items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 accent-cyan-500"
                  checked={includeOptional}
                  onChange={(event) => setIncludeOptional(event.target.checked)}
                />
                <span>
                  Include optional topics in my plan
                  <span className="block text-xs text-muted-foreground">
                    Optional lessons add depth; you can add them later from the roadmap.
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Topics you already know
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    This recommends placement only. It never marks lessons complete.
                  </p>
                </div>
                <div className="space-y-4">
                  {skillsByGroup.map(({ group, skills }) => (
                    <div key={group.id}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                        {group.name}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {skills.map((skill) => {
                          const known = knownTopics.includes(skill.id);
                          return (
                            <label
                              key={skill.id}
                              className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                                known
                                  ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                                  : "border-border bg-surface text-muted-foreground"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={known}
                                onChange={() => toggleTopic(skill.id)}
                              />
                              {skill.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Placement check <span className="font-normal text-muted-foreground">(optional)</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      A few questions from the imported curriculum quizzes. Nothing is saved as
                      progress.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void runPlacement()} isLoading={quizLoading}>
                    {placement ? "Re-run" : "Run placement"}
                  </Button>
                </div>
                {questions.length > 0 && Object.keys(answers).length < questions.length && (
                  <div className="space-y-3">
                    {questions.slice(0, 4).map((question) => (
                      <fieldset key={question.id} className="space-y-1.5">
                        <legend className="text-xs font-medium text-foreground">
                          {question.questionText}
                        </legend>
                        <div className="flex flex-wrap gap-1.5">
                          {question.options.map((option, index) => (
                            <label
                              key={`${question.id}-${index}`}
                              className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] transition-colors focus-within:ring-2 focus-within:ring-accent-cyan ${
                                answers[question.id] === index
                                  ? "border-accent-cyan bg-accent-cyan/10 text-accent-cyan"
                                  : "border-border bg-card text-muted-foreground"
                              }`}
                            >
                              <input
                                type="radio"
                                className="sr-only"
                                name={question.id}
                                checked={answers[question.id] === index}
                                onChange={() =>
                                  setAnswers((current) => ({ ...current, [question.id]: index }))
                                }
                              />
                              {option}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
                {placement && (
                  <div className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3 text-xs text-foreground">
                    <p className="font-semibold mb-1">Recommendation</p>
                    <p>{placement.summary}</p>
                    <p className="mt-1 text-muted-foreground">
                      Starting point: {placement.recommendedStartPhaseTitle} ·{" "}
                      {placement.skimOccurrenceIds.length} lessons look safe to skim (~
                      {Math.round(placement.estimatedMinutesSaved / 60)}h)
                    </p>
                    <p className="mt-1 text-muted-foreground">You can override this anytime.</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-4 text-sm space-y-1">
                <p className="font-semibold text-foreground">Plan summary</p>
                <p className="text-muted-foreground">
                  {tracks.find((track) => track.id === trackId)?.name} · {hoursPerWeek}h/week ·
                  starting {formatLongDate(startDate)}
                  {targetDate ? ` · target ${formatLongDate(targetDate)}` : " · no fixed deadline"}
                </p>
                <p className="text-muted-foreground">
                  Buffer: {BUFFER_LABELS[bufferPreference]} ·{" "}
                  {studyDays.length} study day{studyDays.length === 1 ? "" : "s"} ·{" "}
                  {knownTopics.length} known topic{knownTopics.length === 1 ? "" : "s"}
                </p>
                {placement && (
                  <p className="text-muted-foreground">
                    Placement: starts at {phaseTitle(placement.recommendedStartPhaseSlug)}
                  </p>
                )}
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6" data-testid="capstone-selection-step">
              <div className="rounded-xl border border-accent-cyan/30 bg-accent-cyan/5 p-4">
                <h3 className="text-sm font-semibold text-foreground">Required portfolio baseline</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  These four projects stay in every new personalized roadmap.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {REQUIRED_CAPSTONES.map((item) => (
                    <div key={item.occurrenceId} className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatMinutes(item.estimatedMinutes ?? 0)} · required
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Optional standalone products</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {OPTIONAL_CAPSTONE_PRODUCTS.map((item) => {
                    const skills = item.skillTags
                      .map((id) => skillsById.get(id)?.name)
                      .filter((name): name is string => Boolean(name));
                    return (
                      <div key={item.occurrenceId} className="rounded-lg border border-border bg-surface p-3 text-xs">
                        <label className="flex cursor-pointer gap-3">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-cyan-500"
                            checked={selectedProductIds.includes(item.occurrenceId)}
                            onChange={() => toggleSelection(item.occurrenceId, setSelectedProductIds)}
                          />
                          <span>
                            <span className="block font-medium text-foreground">{item.title}</span>
                            <span className="text-muted-foreground">{formatMinutes(item.estimatedMinutes ?? 0)} · optional</span>
                          </span>
                        </label>
                        <details className="mt-2 text-muted-foreground">
                          <summary className="cursor-pointer font-medium text-foreground">Project details</summary>
                          <p className="mt-1">Curriculum description is not available in roadmap metadata.</p>
                          <p className="mt-1">Skills: {skills.length > 0 ? skills.join(", ") : "No specific skill mapping available."}</p>
                          <p className="mt-1">
                            Prerequisites: {item.prerequisites.length > 0 ? `${item.prerequisites.length} encoded capstone requirement(s)` : "Phase guidance only; no capstone prerequisite is encoded."}
                          </p>
                          {CAPSTONE_OVERLAP_NOTICES[item.occurrenceId] && (
                            <p className="mt-1">Related practice: {CAPSTONE_OVERLAP_NOTICES[item.occurrenceId]}</p>
                          )}
                        </details>
                      </div>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-foreground">Deep-build tracks</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CAPSTONE_TRACKS.map((track) => (
                    <div key={track.id} className="rounded-lg border border-border bg-surface p-3 text-xs">
                      <label className="flex cursor-pointer gap-3">
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-cyan-500"
                          checked={selectedTrackIds.includes(track.id)}
                          onChange={() => toggleSelection(track.id, setSelectedTrackIds)}
                        />
                        <span>
                          <span className="block font-medium text-foreground">{track.name}</span>
                          <span className="text-muted-foreground">
                            {track.occurrenceIds.length} lessons · {formatMinutes(track.minutes)} · optional
                          </span>
                        </span>
                      </label>
                      <details className="mt-2 text-muted-foreground">
                        <summary className="cursor-pointer font-medium text-foreground">Track details</summary>
                        <p className="mt-1">Builds: {track.occurrenceIds.length} linked curriculum projects.</p>
                        <p className="mt-1">
                          Skills: {track.skillTags.map((id) => skillsById.get(id)?.name ?? id).join(", ")}
                        </p>
                        <p className="mt-1">Prerequisites are calculated from the verified curriculum graph and appear in the preview.</p>
                        {CAPSTONE_OVERLAP_NOTICES[track.id] && (
                          <p className="mt-1">Related practice: {CAPSTONE_OVERLAP_NOTICES[track.id]}</p>
                        )}
                      </details>
                    </div>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="capstone-workload-preview" aria-live="polite">
                <p className="font-semibold text-foreground">Your roadmap preview</p>
                <p className="mt-1 text-xs text-muted-foreground">Preliminary estimate from the current scheduler; nothing is saved until you generate the roadmap.</p>
                <dl className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Capstones explicitly selected</dt><dd data-testid="preview-direct-count" className="font-medium">{preview.directSelectedCapstones}</dd></div>
                  <div><dt className="text-muted-foreground">Required core projects</dt><dd data-testid="preview-core-count" className="font-medium">{preview.requiredCoreSelected}</dd></div>
                  <div><dt className="text-muted-foreground">Optional capstones selected</dt><dd data-testid="preview-optional-count" className="font-medium">{preview.optionalSelected} of {preview.availableOptionalCapstones}</dd></div>
                  <div><dt className="text-muted-foreground">Selections</dt><dd data-testid="preview-selection-counts" className="font-medium">{preview.selectedStandaloneProducts} standalone · {preview.selectedDeepBuildTracks} tracks</dd></div>
                  <div><dt className="text-muted-foreground">Core-capstone workload</dt><dd className="font-medium">{formatMinutes(preview.requiredCoreMinutes)}</dd></div>
                  <div><dt className="text-muted-foreground">Selected optional workload</dt><dd className="font-medium">{formatMinutes(preview.selectedOptionalMinutes)}</dd></div>
                  <div><dt className="text-muted-foreground">Capstones ultimately scheduled</dt><dd data-testid="preview-scheduled-capstones" className="font-medium">{preview.scheduledCapstones} · {formatMinutes(preview.scheduledCapstoneMinutes)}</dd></div>
                  <div><dt className="text-muted-foreground">Additional prerequisites</dt><dd data-testid="preview-prerequisite-delta" className="font-medium">{preview.additionalPrerequisites} · {formatMinutes(preview.additionalPrerequisiteMinutes)}</dd></div>
                  <div><dt className="text-muted-foreground">Complete roadmap workload</dt><dd data-testid="preview-total-workload" className="font-medium">{preview.totalRoadmapOccurrences} lessons · {formatMinutes(preview.totalRoadmapMinutes)}</dd></div>
                  <div><dt className="text-muted-foreground">Estimated completion</dt><dd data-testid="preview-weeks" className="font-medium">{preview.estimatedWeeks} weeks at {hoursPerWeek}h/week</dd></div>
                </dl>
                {(preview.knownCapstonesExcluded > 0 || preview.manuallyRestoredCapstones > 0) && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Knowledge adjustments: {preview.knownCapstonesExcluded} excluded · {preview.manuallyRestoredCapstones} manually restored.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-sm text-status-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || working}
        >
          Back
        </Button>
        <div className="flex items-center gap-2">
          {ready && (
            <Button variant="ghost" onClick={() => router.push("/roadmap")}>
              Skip to my roadmap
            </Button>
          )}
          {step < STEP_TITLES.length - 1 ? (
            <Button
              onClick={() => setStep((current) => Math.min(STEP_TITLES.length - 1, current + 1))}
              disabled={!canContinue()}
            >
              Continue
            </Button>
          ) : (
            <Button onClick={() => void generate()} isLoading={working} data-testid="generate-roadmap">
              Generate roadmap
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

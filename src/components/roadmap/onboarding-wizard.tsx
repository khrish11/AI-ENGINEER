"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useRoadmap } from "@/hooks/useRoadmap";
import { tracks, skillsByGroup } from "@/lib/roadmap/config";
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
    }),
    [trackId, hoursPerWeek, startDate, targetDate, studyDays, bufferPreference, includeOptional]
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
      await actions.generate(settings);
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

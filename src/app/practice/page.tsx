"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageLayout } from "@/components/page-layout";
import { assessmentCatalog } from "@/lib/assessments/catalog";
import { getAttemptsByAssessment, recordAssessmentAttempt } from "@/lib/assessments/attempts";
import { scoreAssessment } from "@/lib/assessments/scoring";
import type { AnswerMap, AnswerValue, Assessment, Question } from "@/lib/assessments/schema";
import type { QuizAttempt } from "@/lib/progress/db";
import { Loader2, Trophy } from "lucide-react";

const QUESTION_TYPE_LABELS: Record<Question["type"], string> = {
  single_choice: "single choice",
  multiple_choice: "multiple choice",
  true_false: "true/false",
  ordering: "ordering",
  short_answer: "short answer (self-checked)",
};

export default function PracticePage() {
  const checkpoints = React.useMemo(
    () => assessmentCatalog.filter((a) => a.status === "active"),
    []
  );
  const [activeId, setActiveId] = React.useState<string | null>(null);

  return (
    <PageLayout>
      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6 max-w-4xl">
        <header className="pb-4 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Practice Checkpoints</h1>
            <Badge variant="default">Assessments</Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Phase checkpoints mix single choice, multiple choice, ordering, true/false, and
            self-checked short answers. Every submission starts a new immutable attempt row.
            Scores feed skill mastery evidence and weak-skill review recommendations.
          </p>
        </header>

        {activeId === null ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {checkpoints.map((assessment) => {
              const types = [...new Set(assessment.questions.map((q) => q.type))];
              return (
                <Card variant="interactive" key={assessment.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="text-[10px]">{assessment.phaseSlug}</Badge>
                      <Badge variant="muted" className="text-[10px]">
                        {assessment.questions.length} questions
                      </Badge>
                    </div>
                    <CardTitle className="text-lg font-bold">{assessment.title}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {assessment.description || `Checkpoint for ${assessment.phaseSlug}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {types.map((type) => (
                        <Badge key={type} variant="muted" className="text-[10px]">
                          {QUESTION_TYPE_LABELS[type]}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => setActiveId(assessment.id)}
                      data-testid={`start-checkpoint-${assessment.id}`}
                    >
                      Start checkpoint
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <CheckpointRunner
            assessment={checkpoints.find((a) => a.id === activeId)!}
            onExit={() => setActiveId(null)}
          />
        )}
      </div>
    </PageLayout>
  );
}

function CheckpointRunner({
  assessment,
  onExit,
}: {
  assessment: Assessment;
  onExit: () => void;
}) {
  const [answers, setAnswers] = React.useState<AnswerMap>({});
  const [startedAt] = React.useState(() => new Date().toISOString());
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [result, setResult] = React.useState<ReturnType<typeof scoreAssessment> | null>(null);
  const [history, setHistory] = React.useState<QuizAttempt[]>([]);

  React.useEffect(() => {
    void getAttemptsByAssessment(assessment.id).then(setHistory);
  }, [assessment.id]);

  // Ordering questions always render a persisted candidate order (the option
  // sequence as authored). Seed that order as the recorded answer so the
  // completeness check matches what the learner actually sees.
  React.useEffect(() => {
    setAnswers((current) => {
      const next = { ...current };
      let changed = false;
      for (const question of assessment.questions) {
        if (question.type === "ordering" && next[question.id] === undefined) {
          next[question.id] = question.options?.map((_, index) => index) ?? [];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [assessment]);

  const answerCount = assessment.questions.filter(
    (q) => answerProvided(answers[q.id])
  ).length;
  const allAnswered = answerCount === assessment.questions.length;

  const submit = async () => {
    if (!allAnswered || submitted) return;
    setSubmitting(true);
    try {
      const scored = scoreAssessment(assessment, answers);
      await recordAssessmentAttempt({ assessment, answers, scored, startedAt });
      setResult(scored);
      setSubmitted(true);
      setHistory(await getAttemptsByAssessment(assessment.id));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-10" data-testid={`checkpoint-runner-${assessment.id}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{assessment.title}</h2>
          <p className="text-xs text-muted-foreground">
            {answerCount}/{assessment.questions.length} answered · pass threshold{" "}
            {Math.round(assessment.passThreshold * 100)}%
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExit} data-testid="exit-checkpoint">
          Back to checkpoints
        </Button>
      </div>

      <Progress
        value={answerCount}
        max={assessment.questions.length}
        aria-label="Checkpoint progress"
      />

      {assessment.questions.map((question, index) => (
        <QuestionCard
          key={question.id}
          question={question}
          index={index + 1}
          answer={answers[question.id]}
          onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))}
          submitted={submitted}
        />
      ))}

      {!submitted && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button onClick={submit} disabled={!allAnswered || submitting} data-testid="submit-checkpoint">
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trophy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Submit
          </Button>
          {!allAnswered && (
            <p role="alert" className="text-xs text-status-warning" data-testid="submit-incomplete-error">
              Answer every question before submitting ({assessment.questions.length - answerCount} left).
            </p>
          )}
        </div>
      )}

      {submitted && result && (
        <Card variant="surface" data-testid="checkpoint-result">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Score: {result.earned}/{result.max} ({result.percentage}%).{" "}
              {result.passed ? "Passed checkpoint." : "Not passed — see review list below."}
            </p>
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {result.questionScores.map((score) => (
                <li key={score.questionId}>
                  {score.questionId}: {score.earned}/{score.possible}
                  {score.invalid ? " (invalid answer shape)" : ""}
                </li>
              ))}
            </ul>
            <BeginAgain onStartNew={() => {
              // Attempts are immutable: start a fresh attempt row.
              setAnswers({});
              setSubmitted(false);
              setResult(null);
            }} />
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <section aria-labelledby="attempt-history-heading" data-testid="attempt-history">
          <h2 id="attempt-history-heading" className="text-lg font-semibold mb-2">Attempt history</h2>
          <ul className="space-y-2">
            {history.map((attempt) => (
              <li
                key={attempt.id}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span>
                  Attempt #{attempt.attemptNumber}{" "}
                  {attempt.submittedAt ? (
                    <span className="text-muted-foreground text-xs">
                      · submitted {new Date(attempt.submittedAt).toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs"> · incomplete</span>
                  )}
                </span>
                <Badge
                  variant={
                    attempt.percentage === null
                      ? "muted"
                      : attempt.percentage >= 70
                        ? "success"
                        : "warning"
                  }
                >
                  {attempt.percentage === null
                    ? "invalid"
                    : `${attempt.percentage}%`}
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function BeginAgain({ onStartNew }: { onStartNew: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onStartNew}
      data-testid="start-new-attempt"
    >
      Start a new attempt
    </Button>
  );
}

function answerProvided(value: AnswerValue | undefined): boolean {
  if (value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && value !== null) {
    return typeof (value as { text?: unknown }).text === "string";
  }
  return true;
}

function setArrayAnswer(
  answer: AnswerValue | undefined,
  optionIndex: number,
  _total: number,
  onChange: (value: AnswerValue) => void
) {
  const current = Array.isArray(answer) ? [...answer] : [];
  const at = current.indexOf(optionIndex);
  if (at >= 0) current.splice(at, 1);
  else current.push(optionIndex);
  onChange(current);
}

function OrderingEditor({
  question,
  answer,
  onChange,
  submitted,
}: {
  question: Question;
  answer: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  submitted: boolean;
}) {
  const options = question.options ?? [];
  const current: number[] = Array.isArray(answer)
    ? answer
    : new Array(options.length).fill(0).map((_, i) => i);

  const move = (from: number, direction: -1 | 1) => {
    const next = [...current];
    const to = from + direction;
    if (to < 0 || to >= next.length) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <ol className="space-y-1.5">
      {current.map((optionIndex, position) => (
        <li key={position} className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground w-5 text-xs text-right">{position + 1}.</span>
          <span className="flex-1">{options[optionIndex]}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={submitted || position === 0}
            aria-label={`Move option ${position + 1} up`}
            onClick={() => move(position, -1)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={submitted || position === current.length - 1}
            aria-label={`Move option ${position + 1} down`}
            onClick={() => move(position, 1)}
          >
            ↓
          </Button>
        </li>
      ))}
    </ol>
  );
}

function ShortAnswerEditor({
  question,
  answer,
  onChange,
  submitted,
}: {
  question: Question;
  answer: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  submitted: boolean;
}) {
  const rubric = question.selfCheck!;
  const record = (typeof answer === "object" && answer !== null && !Array.isArray(answer)
    ? (answer as { text: string; criteriaMet: number })
    : { text: "", criteriaMet: 0 });
  const criteriaMet = Math.max(0, Math.min(rubric.criteria.length, record.criteriaMet));

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{rubric.guidance}</p>
      <textarea
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan"
        rows={3}
        value={record.text}
        disabled={submitted}
        onChange={(e) =>
          onChange({
            ...record,
            text: e.target.value,
            criteriaMet,
            criteriaTotal: rubric.criteria.length,
          })
        }
        data-testid={`answer-text-${question.id}`}
        aria-label={`Short answer for: ${question.prompt}`}
      />
      <fieldset className="space-y-1">
        <legend className="text-xs text-muted-foreground">
          Self-check: mark criteria you met ({criteriaMet}/{rubric.criteria.length})
        </legend>
        {rubric.criteria.map((criterion, criterionIndex) => (
          <label key={criterion} className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={criteriaMet > criterionIndex}
              disabled={submitted}
              onChange={(e) => {
                const next = e.target.checked
                  ? criterionIndex + 1
                  : criterionIndex;
                onChange({
                  ...record,
                  text: record.text,
                  criteriaMet: next,
                  criteriaTotal: rubric.criteria.length,
                });
              }}
            />
            {criterion}
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  answer,
  onChange,
  submitted,
}: {
  question: Question;
  index: number;
  answer: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  submitted: boolean;
}) {
  const outcome = scoredOutcome(question, answer, submitted);

  return (
    <Card variant="surface">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            {index}. {question.prompt}
          </CardTitle>
          <Badge variant="muted" className="text-[10px] shrink-0">
            {QUESTION_TYPE_LABELS[question.type]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {question.type === "single_choice" &&
          question.options?.map((option, optionIndex) => (
            <label key={optionIndex} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={answer === optionIndex}
                onChange={() => onChange(optionIndex)}
                disabled={submitted}
                data-testid={`answer-${question.id}-${optionIndex}`}
              />
              {option}
            </label>
          ))}

        {question.type === "true_false" &&
          ["True", "False"].map((label, value) => (
            <label key={label} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={answer === value}
                onChange={() => onChange(value)}
                disabled={submitted}
              />
              {label}
            </label>
          ))}

        {question.type === "multiple_choice" &&
          question.options?.map((option, optionIndex) => (
            <label key={optionIndex} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Array.isArray(answer) && answer.includes(optionIndex)}
                onChange={() =>
                  setArrayAnswer(answer, optionIndex, question.options!.length, onChange)
                }
                disabled={submitted}
                data-testid={`answer-${question.id}-${optionIndex}`}
              />
              {option}
            </label>
          ))}

        {question.type === "ordering" && (
          <OrderingEditor
            question={question}
            answer={answer}
            onChange={onChange}
            submitted={submitted}
          />
        )}

        {question.type === "short_answer" && (
          <ShortAnswerEditor
            question={question}
            answer={answer}
            onChange={onChange}
            submitted={submitted}
          />
        )}

        {submitted && outcome !== null && (
          <p
            role={outcome === "incorrect" ? "alert" : undefined}
            className={`text-xs ${
              outcome === "correct"
                ? "text-status-success"
                : outcome === "incorrect"
                  ? "text-status-error"
                  : "text-muted-foreground"
            }`}
          >
            {outcome === "correct"
              ? "Correct."
              : outcome === "incorrect"
                ? "Incorrect."
                : "Self-assessed."}{" "}
            {question.explanation}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Feedback marker per question after submission (never used for pre-submit scoring). */
function scoredOutcome(
  question: Question,
  answer: AnswerValue | undefined,
  submitted: boolean
): "correct" | "incorrect" | "self_assessed" | null {
  if (!submitted) return null;
  switch (question.type) {
    case "single_choice":
      return answer === question.correctOptionIndex ? "correct" : "incorrect";
    case "true_false": {
      const given = typeof answer === "number" ? answer === 0 : answer;
      return given === question.correctBoolean ? "correct" : "incorrect";
    }
    case "multiple_choice": {
      const given = Array.isArray(answer) ? [...answer].sort((a, b) => a - b) : [];
      const correct = [...(question.correctOptionIndices ?? [])].sort((a, b) => a - b);
      return given.length === correct.length && given.every((v, i) => v === correct[i])
        ? "correct"
        : "incorrect";
    }
    case "ordering": {
      const exact =
        Array.isArray(answer) &&
        answer.length === question.correctOrder?.length &&
        answer.every((v, i) => v === question.correctOrder![i]);
      return exact ? "correct" : "incorrect";
    }
    case "short_answer":
      return "self_assessed";
  }
}

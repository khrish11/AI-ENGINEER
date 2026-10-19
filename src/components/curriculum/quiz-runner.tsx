"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, HelpCircle, RotateCcw } from "lucide-react";
import { useQuizAttempts } from "@/hooks/useQuizAttempts";
import { lessonProgressRepo } from "@/lib/progress/repositories/lesson-progress";
import type { LessonActivityAvailability } from "@/lib/progress/completion";

export interface QuizQuestionData {
  id: string;
  stage: string;
  questionOrder: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string | null;
}

export interface QuizRunnerProps {
  quizzes: QuizQuestionData[];
  lessonId?: string;
  availability?: LessonActivityAvailability;
}

export function QuizRunner({ quizzes, lessonId, availability }: QuizRunnerProps) {
  const [selectedAnswers, setSelectedAnswers] = React.useState<Record<number, number>>({});
  const [submitted, setSubmitted] = React.useState(false);
  const startedAt = React.useRef(new Date().toISOString());
  const { submitAttempt } = useQuizAttempts(lessonId ?? null);

  if (!quizzes || quizzes.length === 0) {
    return (
      <Card variant="surface" className="text-center p-8 border-dashed">
        <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-base font-semibold mb-1">No Assessment Questions</h3>
        <p className="text-xs text-muted-foreground">
          This lesson does not contain automated quiz questions in upstream quiz.json.
        </p>
      </Card>
    );
  }

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setSubmitted(false);
    startedAt.current = new Date().toISOString();
  };

  const correctCount = quizzes.reduce((acc, q, idx) => {
    return acc + (selectedAnswers[idx] === q.correctAnswer ? 1 : 0);
  }, 0);

  const handleSubmit = async () => {
    setSubmitted(true);
    if (lessonId && quizzes.length > 0) {
      await submitAttempt({
        quizId: quizzes[0]?.id || "quiz",
        answers: selectedAnswers,
        score: correctCount,
        maxScore: quizzes.length,
        startedAt: startedAt.current,
      });
      const percentage = Math.round((correctCount / quizzes.length) * 100);
      if (percentage >= 70) {
        await lessonProgressRepo.markPracticeComplete(lessonId, availability);
      }
      // Mastery uses the best valid attempt, never a single stale score.
      const best = await import("@/lib/progress/repositories/quiz-attempts").then((m) =>
        m.quizAttemptsRepo.getBestScore(lessonId)
      );
      if (best !== null && best >= 80) {
        await lessonProgressRepo.upsert({
          lessonId,
          masteryScore: best,
          practiceComplete: true,
          availability,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div>
          <h3 className="text-lg font-bold">Knowledge Check</h3>
          <p className="text-xs text-muted-foreground">
            {quizzes.length} assessment question{quizzes.length > 1 ? "s" : ""}
          </p>
        </div>
        {submitted && (
          <div className="flex items-center gap-2">
            <Badge variant={correctCount === quizzes.length ? "success" : "warning"}>
              Score: {correctCount} / {quizzes.length} (
              {Math.round((correctCount / quizzes.length) * 100)}%)
            </Badge>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-1 text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Retry
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {quizzes.map((q, qIdx) => {
          const isCorrect = selectedAnswers[qIdx] === q.correctAnswer;

          return (
            <Card
              key={q.id || qIdx}
              className={`transition-colors ${
                submitted
                  ? isCorrect
                    ? "border-status-success/40 bg-status-success/[0.02]"
                    : "border-status-error/40 bg-status-error/[0.02]"
                  : ""
              }`}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="muted" className="text-[10px] uppercase">
                    {q.stage} Question {qIdx + 1}
                  </Badge>
                  {submitted && (
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      {isCorrect ? (
                        <span className="text-status-success flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="text-status-error flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <CardTitle className="text-sm font-semibold leading-relaxed">
                  {q.questionText}
                </CardTitle>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-2">
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedAnswers[qIdx] === optIdx;
                  const isThisCorrect = optIdx === q.correctAnswer;

                  let optionStyle =
                    "border-border bg-surface text-foreground hover:bg-muted";
                  if (isSelected && !submitted) {
                    optionStyle =
                      "border-accent-cyan bg-accent-cyan/10 text-accent-cyan ring-1 ring-accent-cyan";
                  } else if (submitted) {
                    if (isThisCorrect) {
                      optionStyle =
                        "border-status-success bg-status-success/15 text-status-success font-medium";
                    } else if (isSelected && !isThisCorrect) {
                      optionStyle =
                        "border-status-error bg-status-error/15 text-status-error line-through";
                    }
                  }

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={submitted}
                      onClick={() => handleSelect(qIdx, optIdx)}
                      className={`w-full text-left p-3 rounded-lg border text-xs sm:text-sm flex items-start gap-3 transition-colors ${optionStyle}`}
                    >
                      <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-mono shrink-0 mt-0.5">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="flex-1 leading-snug">{opt}</span>
                    </button>
                  );
                })}

                {submitted && q.explanation && (
                  <div className="mt-3 p-3 rounded-lg bg-muted text-xs text-muted-foreground border border-border">
                    <span className="font-semibold text-foreground">Explanation: </span>
                    {q.explanation}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!submitted && (
        <div className="pt-2">
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(selectedAnswers).length === 0}
            variant="default"
            size="md"
          >
            Check Answers ({Object.keys(selectedAnswers).length}/{quizzes.length} answered)
          </Button>
        </div>
      )}
    </div>
  );
}

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseLessonDirectory, parseAllPhases } from "@/lib/curriculum/parser";

describe("Curriculum Parser", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "parser-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("should parse a valid lesson with README, quiz, and code files", () => {
    const lessonDir = path.join(tempDir, "01-dev-env");
    fs.mkdirSync(lessonDir, { recursive: true });

    // 1. Write README.md with markdown and math
    const readmeContent = `# Linux CLI & Modern Shells

Master the Linux shell, environment variables, and essential tooling.

## Prerequisites
- Basic familiarity with computers and terminals

## Learning Objectives
- Master modern shell navigation
- Configure environment variables and PATH
- Understand process monitoring with htop

## Concept
Here is an equation: $E = mc^2$ and block math:
$$
\\sigma(z) = \\frac{1}{1 + e^{-z}}
$$

\`\`\`bash
echo "Hello from Linux!"
\`\`\`
`;
    fs.writeFileSync(path.join(lessonDir, "README.md"), readmeContent, "utf8");

    // 2. Write quiz.json
    const quizContent = {
      questions: [
        {
          stage: "pre",
          question: "Which command lists directory contents including hidden files?",
          options: ["ls -a", "ls -l", "dir", "cd .."],
          correct: 0,
          explanation: "-a or --all lists hidden files starting with a dot.",
        },
        {
          stage: "post",
          question: "Which file is executed when an interactive login shell starts in bash?",
          options: ["~/.bash_profile", "~/.bashrc", "/etc/environment", "~/.profile"],
          correct: 0,
          explanation: "In Bash, ~/.bash_profile is loaded for interactive login shells.",
        },
      ],
    };
    fs.writeFileSync(
      path.join(lessonDir, "quiz.json"),
      JSON.stringify(quizContent, null, 2),
      "utf8"
    );

    // 3. Write code files
    fs.writeFileSync(path.join(lessonDir, "script.sh"), 'echo "test"\n', "utf8");
    fs.writeFileSync(path.join(lessonDir, "main.py"), 'print("ai-engineer")\n', "utf8");

    const parsed = parseLessonDirectory(0, "00-setup-tooling", lessonDir);

    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.phaseNumber).toBe(0);
    expect(parsed.phaseSlug).toBe("00-setup-tooling");
    expect(parsed.lessonSlug).toBe("01-dev-env");
    expect(parsed.slug).toBe("00-setup-tooling/01-dev-env");
    expect(parsed.title).toBe("Linux CLI & Modern Shells");
    expect(parsed.tagline).toBe(
      "Master the Linux shell, environment variables, and essential tooling."
    );
    expect(parsed.difficulty).toBe("Beginner");
    expect(parsed.hasCode).toBe(true);
    expect(parsed.hasQuiz).toBe(true);
    expect(parsed.learningObjectives.length).toBe(3);
    expect(parsed.learningObjectives[0]).toBe("Master modern shell navigation");
    expect(parsed.quizzes.length).toBe(2);
    expect(parsed.quizzes[0].stage).toBe("pre");
    expect(parsed.quizzes[0].correctAnswer).toBe(0);
    expect(parsed.quizzes[1].stage).toBe("post");
    expect(parsed.codeFiles.length).toBe(2);
    expect(parsed.languages).toContain("Bash");
    expect(parsed.languages).toContain("Python");
    expect(parsed.contentHash).toBeDefined();
    expect(parsed.markdownHash).toBeDefined();
  });

  it("should return null gracefully if README.md does not exist in directory", () => {
    const emptyLessonDir = path.join(tempDir, "empty-lesson");
    fs.mkdirSync(emptyLessonDir, { recursive: true });

    const parsed = parseLessonDirectory(0, "00-setup-tooling", emptyLessonDir);
    expect(parsed).toBeNull();
  });

  it("should handle missing quiz.json and code files without errors", () => {
    const lessonDir = path.join(tempDir, "02-minimal-lesson");
    fs.mkdirSync(lessonDir, { recursive: true });

    fs.writeFileSync(
      path.join(lessonDir, "README.md"),
      "# Minimal Theory Lesson\n\nPure theoretical lesson without code.\n",
      "utf8"
    );

    const parsed = parseLessonDirectory(1, "01-math-foundations", lessonDir);
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.title).toBe("Minimal Theory Lesson");
    expect(parsed.hasCode).toBe(false);
    expect(parsed.hasQuiz).toBe(false);
    expect(parsed.hasNotebook).toBe(false);
    expect(parsed.quizzes).toEqual([]);
    expect(parsed.codeFiles).toEqual([]);
  });

  it("should detect jupyter notebooks as hasNotebook = true", () => {
    const lessonDir = path.join(tempDir, "03-notebook-lesson");
    fs.mkdirSync(lessonDir, { recursive: true });

    fs.writeFileSync(
      path.join(lessonDir, "README.md"),
      "# Notebook Demo\n\nExploring embeddings in Jupyter.\n",
      "utf8"
    );
    fs.writeFileSync(path.join(lessonDir, "lab.ipynb"), "{}", "utf8");

    const parsed = parseLessonDirectory(12, "12-rag-systems", lessonDir);
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.hasNotebook).toBe(true);
    expect(parsed.difficulty).toBe("Advanced");
  });

  it("should generate deterministic content hashes for the same content", () => {
    const lessonDir1 = path.join(tempDir, "lesson-1");
    const lessonDir2 = path.join(tempDir, "lesson-2");
    fs.mkdirSync(lessonDir1, { recursive: true });
    fs.mkdirSync(lessonDir2, { recursive: true });

    const sharedMd = "# Identical Title\n\nIdentical content for hash test.\n";
    fs.writeFileSync(path.join(lessonDir1, "README.md"), sharedMd, "utf8");
    fs.writeFileSync(path.join(lessonDir2, "README.md"), sharedMd, "utf8");

    const parsed1 = parseLessonDirectory(0, "00-setup", lessonDir1);
    const parsed2 = parseLessonDirectory(0, "00-setup", lessonDir2);

    expect(parsed1?.contentHash).toBe(parsed2?.contentHash);
    expect(parsed1?.markdownHash).toBe(parsed2?.markdownHash);
  });

  it("should parse full phase directory with parseAllPhases", () => {
    const phasesDir = path.join(tempDir, "phases");
    const phase00Dir = path.join(phasesDir, "00-setup-tooling");
    const lesson01Dir = path.join(phase00Dir, "01-dev-env");
    fs.mkdirSync(lesson01Dir, { recursive: true });

    fs.writeFileSync(
      path.join(phase00Dir, "README.md"),
      "# Setup Tooling\n\nPhase 0 overview description.\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(lesson01Dir, "README.md"),
      "# Terminal\n\nLearning shell.\n",
      "utf8"
    );

    const phases = parseAllPhases(tempDir);
    expect(phases.length).toBe(1);
    expect(phases[0].phaseNumber).toBe(0);
    expect(phases[0].title).toBe("Setup Tooling");
    expect(phases[0].lessons.length).toBe(1);
    expect(phases[0].lessons[0].title).toBe("Terminal");
  });
});

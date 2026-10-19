import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface ParsedQuizQuestion {
  stage: "pre" | "post";
  questionOrder: number;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface ParsedCodeFile {
  filename: string;
  relativePath: string;
  language: string;
  sizeBytes: number;
  content?: string;
}

export interface ParsedLesson {
  phaseNumber: number;
  phaseSlug: string;
  lessonFolder: string;
  slug: string; // e.g. "00-setup-and-tooling/01-dev-environment"
  lessonSlug: string; // e.g. "01-dev-environment"
  title: string;
  tagline: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedMinutes: number;
  lessonType: "Build" | "Learn";
  languages: string[];
  prerequisitesText: string;
  learningObjectives: string[];
  markdownContent: string;
  markdownHash: string;
  contentHash: string;
  hasCode: boolean;
  hasQuiz: boolean;
  hasNotebook: boolean;
  codeFiles: ParsedCodeFile[];
  outputs: string[];
  quizzes: ParsedQuizQuestion[];
}

export interface ParsedPhase {
  phaseNumber: number;
  permanentKey: string;
  slug: string;
  title: string;
  description: string;
  lessons: ParsedLesson[];
}

function computeSha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

function parseTimeInMinutes(timeStr: string): number {
  const match = timeStr.match(/(\d+)\s*(min|hour|hr|h|m)/i);
  if (!match) return 45;
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("h")) return num * 60;
  return num;
}

function deriveDifficulty(phaseNumber: number): "Beginner" | "Intermediate" | "Advanced" {
  if (phaseNumber <= 5) return "Beginner";
  if (phaseNumber <= 11) return "Intermediate";
  return "Advanced";
}

function detectLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".py":
      return "Python";
    case ".ts":
      return "TypeScript";
    case ".tsx":
      return "TypeScript";
    case ".js":
      return "JavaScript";
    case ".jsx":
      return "JavaScript";
    case ".rs":
      return "Rust";
    case ".jl":
      return "Julia";
    case ".sh":
      return "Bash";
    case ".json":
      return "JSON";
    case ".yaml":
    case ".yml":
      return "YAML";
    case ".md":
      return "Markdown";
    case ".ipynb":
      return "Jupyter";
    default:
      return "Text";
  }
}

export function parseLessonDirectory(
  phaseNumber: number,
  phaseSlug: string,
  lessonDir: string
): ParsedLesson | null {
  const lessonFolder = path.basename(lessonDir);
  const fullSlug = `${phaseSlug}/${lessonFolder}`;

  // Find primary markdown file: docs/en.md or README.md
  let mdPath = path.join(lessonDir, "docs", "en.md");
  if (!fs.existsSync(mdPath)) {
    mdPath = path.join(lessonDir, "README.md");
    if (!fs.existsSync(mdPath)) {
      return null;
    }
  }

  const rawMd = fs.readFileSync(mdPath, "utf8").replace(/\0/g, "");
  const markdownHash = computeSha256(rawMd);

  // Extract Title from first header # Title
  const titleMatch = rawMd.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : lessonFolder;

  // Extract tagline / quote > quote or first non-heading paragraph
  let tagline = "";
  const quoteMatch = rawMd.match(/^>\s+(.+)$/m);
  if (quoteMatch) {
    tagline = quoteMatch[1].trim();
  } else {
    const afterTitle = rawMd.replace(/^#\s+[^\n\r]+/m, "").trim();
    const firstPara = afterTitle.split(/\n\s*\n/)[0];
    if (firstPara && !firstPara.startsWith("#") && !firstPara.startsWith("!")) {
      tagline = firstPara.replace(/\n/g, " ").trim();
    }
  }

  // Extract metadata fields like **Type:**, **Languages:**, **Prerequisites:**, **Time:**
  let lessonType: "Build" | "Learn" = "Build";
  const typeMatch = rawMd.match(/\*\*Type:\*\*\s*([A-Za-z]+)/i);
  if (typeMatch && typeMatch[1].toLowerCase() === "learn") {
    lessonType = "Learn";
  }

  let languages: string[] = [];
  const langMatch = rawMd.match(/\*\*Languages:\*\*\s*([^\n\r*]+)/i);
  if (langMatch) {
    languages = langMatch[1]
      .split(/[,/|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  let prerequisitesText = "";
  const prereqMatch = rawMd.match(/\*\*Prerequisites:\*\*\s*([^\n\r*]+)/i);
  if (prereqMatch) {
    prerequisitesText = prereqMatch[1].trim();
  }

  let estimatedMinutes = 45;
  const timeMatch = rawMd.match(/\*\*Time:\*\*\s*([^\n\r*]+)/i);
  if (timeMatch) {
    estimatedMinutes = parseTimeInMinutes(timeMatch[1]);
  }

  // Extract Learning Objectives
  const learningObjectives: string[] = [];
  const objectivesSection = rawMd.match(
    /##\s+Learning Objectives\s*([\s\S]*?)(?=##|\Z)/i
  );
  if (objectivesSection) {
    const lines = objectivesSection[1].split("\n");
    for (const line of lines) {
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (bullet) {
        learningObjectives.push(bullet[1].trim());
      }
    }
  }

  // Generate Stable Canonical Content Hash
  // SHA-256 of normalized (title + sorted learning objectives + phaseNumber)
  const normTitle = title.toLowerCase().trim();
  const normObj = learningObjectives
    .map((o) => o.toLowerCase().trim())
    .sort()
    .join("|");
  const contentSignature = `${normTitle}::${normObj}::${lessonType}`;
  const contentHash = computeSha256(contentSignature);

  // Check code/ folder and lessonDir for code files and notebooks
  const codeFiles: ParsedCodeFile[] = [];
  const codeDir = path.join(lessonDir, "code");
  let hasNotebook = false;

  // Check if notebook exists in lessonDir directly
  const lessonEntries = fs.readdirSync(lessonDir, { withFileTypes: true });
  for (const entry of lessonEntries) {
    if (entry.isFile() && entry.name.endsWith(".ipynb")) {
      hasNotebook = true;
    }
  }

  const scanDir = (dir: string, baseRel: string = "") => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "docs" ||
        entry.name === "outputs" ||
        entry.name === "README.md" ||
        entry.name === "quiz.json"
      ) {
        continue;
      }

      const full = path.join(dir, entry.name);
      const rel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== "code") {
          scanDir(full, rel);
        }
      } else if (entry.isFile()) {
        const stats = fs.statSync(full);
        if (entry.name.endsWith(".ipynb")) hasNotebook = true;

        let content: string | undefined;
        const ext = path.extname(entry.name).toLowerCase();
        const textExtensions = new Set([
          ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".jl", ".sh", ".bash",
          ".json", ".yaml", ".yml", ".md", ".txt", ".toml", ".sql", ".env",
          ".css", ".html", ".c", ".cpp", ".h", ".cu", ".cuh", ".proto"
        ]);

        if (textExtensions.has(ext) && stats.size < 100000) {
          try {
            const text = fs.readFileSync(full, "utf8");
            content = text.replace(/\0/g, "");
          } catch {
            // binary or decode issue
          }
        }
        codeFiles.push({
          filename: entry.name,
          relativePath: rel,
          language: detectLanguage(entry.name),
          sizeBytes: stats.size,
          content,
        });
      }
    }
  };

  if (fs.existsSync(codeDir)) {
    scanDir(codeDir);
  } else {
    scanDir(lessonDir);
  }

  // Check outputs/ folder
  const outputs: string[] = [];
  const outDir = path.join(lessonDir, "outputs");
  if (fs.existsSync(outDir)) {
    try {
      const outEntries = fs.readdirSync(outDir);
      outputs.push(...outEntries.filter((f) => !f.startsWith(".")));
    } catch {
      // ignore
    }
  }

  // Check quiz.json
  const quizzes: ParsedQuizQuestion[] = [];
  const quizPath = path.join(lessonDir, "quiz.json");
  if (fs.existsSync(quizPath)) {
    try {
      const quizJson = JSON.parse(fs.readFileSync(quizPath, "utf8"));
      if (Array.isArray(quizJson.questions)) {
        quizJson.questions.forEach(
          (
            q: {
              stage?: string;
              question?: string;
              options?: string[];
              correct?: number;
              explanation?: string;
            },
            idx: number
          ) => {
            quizzes.push({
              stage: q.stage === "pre" ? "pre" : "post",
              questionOrder: idx + 1,
              questionText: q.question || "",
              options: Array.isArray(q.options) ? q.options : [],
              correctAnswer: typeof q.correct === "number" ? q.correct : 0,
              explanation: q.explanation || "",
            });
          }
        );
      }
    } catch (err) {
      console.warn(`Warning: failed to parse quiz.json in ${fullSlug}`, err);
    }
  }

  // If languages were not explicitly in markdown, derive from detected code files
  const resolvedLanguages =
    languages.length > 0
      ? languages
      : Array.from(
          new Set(
            codeFiles
              .map((c) => c.language)
              .filter((l) => l !== "Markdown" && l !== "Text")
          )
        );

  return {
    phaseNumber,
    phaseSlug,
    lessonFolder,
    slug: fullSlug,
    lessonSlug: lessonFolder,
    title,
    tagline,
    difficulty: deriveDifficulty(phaseNumber),
    estimatedMinutes,
    lessonType,
    languages: resolvedLanguages,
    prerequisitesText,
    learningObjectives,
    markdownContent: rawMd,
    markdownHash,
    contentHash,
    hasCode: codeFiles.length > 0,
    hasQuiz: quizzes.length > 0,
    hasNotebook,
    codeFiles,
    outputs,
    quizzes,
  };
}

export function parseAllPhases(repoPath: string): ParsedPhase[] {
  const phasesDir = path.join(repoPath, "phases");
  if (!fs.existsSync(phasesDir)) {
    throw new Error(`Phases directory not found at: ${phasesDir}`);
  }

  const phaseEntries = fs
    .readdirSync(phasesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const parsedPhases: ParsedPhase[] = [];

  for (const phaseFolder of phaseEntries) {
    const phasePath = path.join(phasesDir, phaseFolder);
    const match = phaseFolder.match(/^(\d+)-(.*)$/);
    if (!match) continue;

    const phaseNumber = parseInt(match[1], 10);
    const slug = phaseFolder;
    const permanentKey = `phase-${match[1]}-${match[2]}`;

    // Read Phase README for title and description
    let title = phaseFolder
      .split("-")
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    let description = "";

    const phaseReadme = path.join(phasePath, "README.md");
    if (fs.existsSync(phaseReadme)) {
      const readmeText = fs.readFileSync(phaseReadme, "utf8");
      const titleM = readmeText.match(/^#\s+(.+)$/m);
      if (titleM) title = titleM[1].trim();

      const descM = readmeText.match(/^([^#\n\r][^\n\r]+)/m);
      if (descM) description = descM[1].trim();
    }

    // Read Lessons inside this phase folder
    const lessonEntries = fs
      .readdirSync(phasePath, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const lessons: ParsedLesson[] = [];
    for (const lessonFolder of lessonEntries) {
      const lessonDir = path.join(phasePath, lessonFolder);
      const parsed = parseLessonDirectory(phaseNumber, slug, lessonDir);
      if (parsed) {
        lessons.push(parsed);
      }
    }

    parsedPhases.push({
      phaseNumber,
      permanentKey,
      slug,
      title,
      description,
      lessons,
    });
  }

  return parsedPhases;
}

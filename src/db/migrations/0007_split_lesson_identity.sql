ALTER TABLE "canonical_lessons" DROP CONSTRAINT IF EXISTS "canonical_lessons_content_hash_unique";
--> statement-breakpoint
DO $$
DECLARE
  original_id uuid;
  split_id uuid;
BEGIN
  SELECT id
    INTO original_id
    FROM canonical_lessons
   WHERE current_slug = '09-vision-transformers'
   ORDER BY created_at, id
   LIMIT 1;

  IF original_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM canonical_lessons
     WHERE current_slug = '14-vision-transformers'
  ) THEN
    RETURN;
  END IF;

  split_id := gen_random_uuid();

  INSERT INTO canonical_lessons (
    id,
    canonical_phase_id,
    content_hash,
    current_slug,
    default_title,
    tagline,
    difficulty,
    estimated_minutes,
    is_deprecated,
    created_at,
    updated_at
  )
  SELECT
    split_id,
    p.id,
    l.content_hash,
    '14-vision-transformers',
    l.default_title,
    l.tagline,
    l.difficulty,
    l.estimated_minutes,
    l.is_deprecated,
    l.created_at,
    NOW()
  FROM canonical_lessons l
  JOIN canonical_phases p ON p.default_slug = '04-computer-vision'
  WHERE l.id = original_id;

  INSERT INTO lesson_revisions (
    id,
    revision_id,
    canonical_lesson_id,
    title,
    markdown_content,
    markdown_hash,
    lesson_type,
    languages,
    learning_objectives,
    has_code,
    has_quiz,
    has_notebook,
    code_files,
    outputs,
    created_at
  )
  SELECT
    gen_random_uuid(),
    revision_id,
    split_id,
    title,
    markdown_content,
    markdown_hash,
    lesson_type,
    languages,
    learning_objectives,
    has_code,
    has_quiz,
    has_notebook,
    code_files,
    outputs,
    created_at
  FROM lesson_revisions
  WHERE canonical_lesson_id = original_id
  ON CONFLICT (revision_id, canonical_lesson_id) DO NOTHING;
END $$;

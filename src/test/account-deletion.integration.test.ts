import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TEST_USER_ID = "00000000-0000-4000-8000-0000000000ab";
const OTHER_USER_ID = "00000000-0000-4000-8000-0000000000ac";
const LESSON_ID = "11111111-1111-4111-8111-1111111111ab";
const RESOURCE_ID = "22222222-2222-4222-8222-2222222222ab";
const QUIZ_ID = "33333333-3333-4333-8333-3333333333ab";
const PROJECT_PROGRESS_ID = "44444444-4444-4444-8444-4444444444ab";
const PROJECT_EVIDENCE_ID = "55555555-5555-4555-8555-5555555555ab";
const PROJECT_ASSESSMENT_ID = "66666666-6666-4666-8666-6666666666ab";
const ROADMAP_ID = "77777777-7777-4777-8777-7777777777ab";
const REVIEW_ID = "88888888-8888-4888-8888-8888888888ab";
const PROFILE_ID = "99999999-9999-4999-8999-9999999999ab";
const DEVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
const BATCH_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbab";
const CONFLICT_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccab";
const TOMBSTONE_ID = "dddddddd-dddd-4ddd-8ddd-ddddddddddab";
const SESSION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeab";

const authState = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/lib/auth/session", () => ({
  getAuthenticatedUserId: async () => authState.userId,
}));

// Verify exact test database identity: localhost:5432/ai_engineer_os_test
const hasTestDatabase = process.env.DATABASE_URL === "postgresql://ai_engineer_os:local_dev_password@localhost:5432/ai_engineer_os_test";
// Use test database for integration tests
const describeWithDatabase = hasTestDatabase ? describe : describe.skip;

describeWithDatabase("account deletion against PostgreSQL", () => {
  let dbModule: typeof import("@/db");
  let sql: ReturnType<typeof import("postgres")>;
  let deleteAccount: () => Promise<Response>;

  beforeAll(async () => {
    dbModule = await import("@/db");
    sql = dbModule.getDbClient();
    ({ DELETE: deleteAccount } = await import("@/app/api/account/delete/route"));
    await sql`DELETE FROM users WHERE id IN (${TEST_USER_ID}, ${OTHER_USER_ID})`;
    await sql`DELETE FROM quizzes WHERE id = ${QUIZ_ID}`;
    await sql`DELETE FROM canonical_lessons WHERE id = ${LESSON_ID}`;
    await sql`DELETE FROM resources WHERE id = ${RESOURCE_ID}`;
    await sql`DELETE FROM canonical_phases WHERE id = '12121212-1212-4121-8121-121212121212'`;
    await sql`
      INSERT INTO users (id, email) VALUES
        (${TEST_USER_ID}, 'account-delete-a@example.invalid'),
        (${OTHER_USER_ID}, 'account-delete-b@example.invalid')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO canonical_phases (id, phase_number, permanent_key, default_slug, default_title)
      VALUES ('12121212-1212-4121-8121-121212121212', 99, 'phase-test', 'phase-test', 'Test Phase')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO canonical_lessons (id, canonical_phase_id, content_hash, current_slug, default_title)
      VALUES (${LESSON_ID}, '12121212-1212-4121-8121-121212121212', repeat('a', 64), 'test-lesson', 'Test Lesson')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO resources (id, resource_key, title, canonical_url, canonical_url_hash, resource_type)
      VALUES (${RESOURCE_ID}, 'account-delete-resource', 'Test Resource', 'https://example.invalid/resource',
        repeat('b', 64), 'article')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO quizzes (id, canonical_lesson_id, stage, question_order, question_text, options, correct_answer)
      VALUES (${QUIZ_ID}, ${LESSON_ID}, 'post', 1, 'Test?', '[]', 0)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO portfolio_profiles (id, user_id, published, username, display_name)
      VALUES (${PROFILE_ID}, ${TEST_USER_ID}, true, 'account-delete-a', 'Account Delete A')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO user_lesson_progress (id, user_id, lesson_key, status)
      VALUES (${LESSON_ID}, ${TEST_USER_ID}, 'phase-test/test-lesson', 'in_progress')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO user_resource_progress (id, user_id, resource_id, status)
      VALUES ('10101010-1010-4010-8010-101010101010', ${TEST_USER_ID}, ${RESOURCE_ID}, 'started')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO notes (id, user_id, lesson_key, content)
      VALUES ('20202020-2020-4020-8020-202020202020', ${TEST_USER_ID}, 'phase-test/test-lesson', 'private note')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO bookmarks (id, user_id, lesson_key, note)
      VALUES ('30303030-3030-4030-8030-303030303030', ${TEST_USER_ID}, 'phase-test/test-lesson', 'private bookmark')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO study_sessions (id, user_id, client_session_id, lesson_key, started_at, duration_seconds)
      VALUES ('40404040-4040-4040-8040-404040404040', ${TEST_USER_ID},
        '50505050-5050-4050-8050-505050505050', 'phase-test/test-lesson', now(), 30)
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO quiz_attempts (id, user_id, quiz_id, score, max_score, answers, attempt_id)
      VALUES ('60606060-6060-4060-8060-606060606060', ${TEST_USER_ID}, ${QUIZ_ID}, 1, 1, '{}',
        '70707070-7070-4070-8070-707070707070')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO project_progress (id, user_id, lesson_key, project_id)
      VALUES (${PROJECT_PROGRESS_ID}, ${TEST_USER_ID}, 'phase-test/test-lesson', 'account-delete-project')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO project_evidence (id, user_id, project_id, kind)
      VALUES (${PROJECT_EVIDENCE_ID}, ${TEST_USER_ID}, 'account-delete-project', 'note')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO project_self_assessments (id, user_id, project_id)
      VALUES (${PROJECT_ASSESSMENT_ID}, ${TEST_USER_ID}, 'account-delete-project')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO roadmap_state (id, user_id, state)
      VALUES (${ROADMAP_ID}, ${TEST_USER_ID}, '{}')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO review_history (id, user_id, skill_id)
      VALUES (${REVIEW_ID}, ${TEST_USER_ID}, 'account-delete-skill')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO devices (id, user_id, device_uuid)
      VALUES (${DEVICE_ID}, ${TEST_USER_ID}, 'ffffffff-ffff-4fff-8fff-ffffffffffff')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO sync_batches (id, user_id, client_batch_id, status)
      VALUES (${BATCH_ID}, ${TEST_USER_ID}, 'abababab-abab-4aba-8aba-abababababab', 'applied')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO sync_conflicts (id, user_id, entity_type, entity_id, local_data, remote_data, conflict_state)
      VALUES (${CONFLICT_ID}, ${TEST_USER_ID}, 'lesson', 'account-delete-entity', '{}', '{}', 'unresolved')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO tombstones (id, user_id, entity_id, entity_type)
      VALUES (${TOMBSTONE_ID}, ${TEST_USER_ID}, 'account-delete-entity', 'lesson')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO sessions (id, session_token, user_id, expires)
      VALUES (${SESSION_ID}, 'account-delete-session', ${TEST_USER_ID}, now() + interval '1 day')
      ON CONFLICT (id) DO NOTHING
    `;
  });

  afterAll(async () => {
    await sql`DROP TRIGGER IF EXISTS account_delete_failure ON users`;
    await sql`DROP FUNCTION IF EXISTS account_delete_failure()`;
    await sql`DELETE FROM users WHERE id IN (${TEST_USER_ID}, ${OTHER_USER_ID})`;
    await sql`DELETE FROM quizzes WHERE id = ${QUIZ_ID}`;
    await sql`DELETE FROM canonical_lessons WHERE id = ${LESSON_ID}`;
    await sql`DELETE FROM resources WHERE id = ${RESOURCE_ID}`;
    await sql`DELETE FROM canonical_phases WHERE id = '12121212-1212-4121-8121-121212121212'`;
    await sql.end();
  });

  it("rejects unauthenticated deletion", async () => {
    authState.userId = null;
    expect((await deleteAccount()).status).toBe(401);
  });

  it("deletes only the authenticated user's records and invalidates sessions", async () => {
    authState.userId = TEST_USER_ID;
    await sql`
      INSERT INTO notes (id, user_id, lesson_key, content)
      VALUES ('21212121-2121-4121-8121-212121212121', ${OTHER_USER_ID}, 'phase-test/test-lesson', 'keep')
      ON CONFLICT (id) DO NOTHING
    `;
    expect((await deleteAccount()).status).toBe(200);

    const deleted = await sql`
      SELECT
        (SELECT count(*) FROM users WHERE id = ${TEST_USER_ID}) AS users,
        (SELECT count(*) FROM notes WHERE user_id = ${TEST_USER_ID}) AS notes,
        (SELECT count(*) FROM portfolio_profiles WHERE user_id = ${TEST_USER_ID}) AS portfolio,
        (SELECT count(*) FROM sessions WHERE user_id = ${TEST_USER_ID}) AS sessions
    `;
    expect(deleted[0]).toMatchObject({ users: "0", notes: "0", portfolio: "0", sessions: "0" });
    expect(Number((await sql`SELECT count(*) FROM users WHERE id = ${OTHER_USER_ID}`)[0].count)).toBe(1);
    expect(Number((await sql`SELECT count(*) FROM notes WHERE user_id = ${OTHER_USER_ID}`)[0].count)).toBe(1);

    const { GET: getPublicPortfolio } = await import("@/app/api/portfolio/public/[username]/route");
    const publicResponse = await getPublicPortfolio(new Request("http://localhost") as never, {
      params: Promise.resolve({ username: "account-delete-a" }),
    });
    expect(publicResponse.status).toBe(404);
  });

  it("rolls back all deletion statements when the database rejects the user delete", async () => {
    await sql`
      INSERT INTO users (id, email) VALUES (${TEST_USER_ID}, 'account-delete-a@example.invalid')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      INSERT INTO portfolio_profiles (id, user_id, published, username)
      VALUES (${PROFILE_ID}, ${TEST_USER_ID}, true, 'account-delete-a')
      ON CONFLICT (id) DO NOTHING
    `;
    await sql`
      CREATE OR REPLACE FUNCTION account_delete_failure() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced account deletion rollback'; END $$;
    `;
    await sql`
      CREATE TRIGGER account_delete_failure BEFORE DELETE ON users
      FOR EACH ROW EXECUTE FUNCTION account_delete_failure()
    `;

    authState.userId = TEST_USER_ID;
    expect((await deleteAccount()).status).toBe(500);
    expect(Number((await sql`SELECT count(*) FROM users WHERE id = ${TEST_USER_ID}`)[0].count)).toBe(1);
    expect(Number((await sql`SELECT count(*) FROM portfolio_profiles WHERE user_id = ${TEST_USER_ID}`)[0].count)).toBe(1);
  });

  it("is safe to retry and does not recreate a deleted account", async () => {
    await sql`DROP TRIGGER IF EXISTS account_delete_failure ON users`;
    await sql`DROP FUNCTION IF EXISTS account_delete_failure()`;
    authState.userId = TEST_USER_ID;
    expect((await deleteAccount()).status).toBe(200);
    expect((await deleteAccount()).status).toBe(200);
    expect(Number((await sql`SELECT count(*) FROM users WHERE id = ${OTHER_USER_ID}`)[0].count)).toBe(1);

    const { POST } = await import("@/app/api/sync/v1/route");
    const staleSync = await POST({
      json: async () => ({
        clientBatchId: "abababab-abab-4aba-8aba-abababababac",
        deviceId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        lastSyncCursor: null,
        mutations: [],
      }),
    } as never);
    expect(staleSync.status).toBe(500);
  });
});

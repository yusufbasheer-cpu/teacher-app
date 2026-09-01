from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = REPO_ROOT / "supabase" / "schema.sql"
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
LESSON_GENERATOR = REPO_ROOT / "src" / "components" / "lesson-plan" / "lesson-plan-generator.tsx"
PPTX_TEMPLATE = REPO_ROOT / "src" / "lib" / "pptx-template.ts"
SCHOOL_TEMPLATE_UPLOAD = (
    REPO_ROOT / "src" / "app" / "api" / "school-template" / "upload" / "route.ts"
)
SCHOOL_TEMPLATE_ROUTE = REPO_ROOT / "src" / "app" / "api" / "school-template" / "route.ts"


def _normalized_sql() -> str:
    return " ".join(SCHEMA_SQL.read_text(encoding="utf-8").lower().split())


def _normalized_file(path: Path) -> str:
    return " ".join(path.read_text(encoding="utf-8").lower().split())


def test_lesson_plans_schema_preserves_owner_rls_contract() -> None:
    sql = _normalized_sql()

    assert "create table if not exists public.lesson_plans" in sql
    assert "user_id uuid not null references auth.users(id) on delete cascade" in sql
    assert "alter table public.lesson_plans enable row level security" in sql

    assert 'create policy "users can insert their own lesson plans"' in sql
    assert "for insert with check (auth.uid() = user_id)" in sql

    assert 'create policy "users can view their own lesson plans"' in sql
    assert "for select using (auth.uid() = user_id)" in sql

    assert 'create policy "users can update their own lesson plans"' in sql
    assert (
        "for update using (auth.uid() = user_id) with check (auth.uid() = user_id)"
        in sql
    )

    assert 'create policy "users can delete their own lesson plans"' in sql
    assert "for delete using (auth.uid() = user_id)" in sql


def test_lesson_plans_baseline_reconciliation_migration_matches_schema_contract() -> None:
    migration = _normalized_file(
        MIGRATIONS_DIR / "20260101000000_lesson_plans_baseline_reconciliation.sql"
    )

    # Fresh-bootstrap ordering: this file must sort before the earliest
    # ALTER-style lesson_plans migration, which assumes the table exists.
    earliest_alter_migration = "20260210120000_lesson_plans_curriculum_chapter.sql"
    assert (
        "20260101000000_lesson_plans_baseline_reconciliation.sql" < earliest_alter_migration
    )

    # Existing-database safety: the whole baseline is guarded by a single
    # existence check, so it is a no-op wherever lesson_plans already
    # exists (every currently deployed environment).
    assert "if not exists (" in migration
    assert (
        "select 1 from information_schema.tables where table_schema = 'public' "
        "and table_name = 'lesson_plans'"
        in migration
    )

    # The guarded baseline must match DATABASE_BASELINE_SPEC.md's verified
    # pre-202602 shape — the same contract fragments the schema.sql test
    # above protects, so schema.sql and this migration cannot silently
    # diverge on the owner-RLS contract.
    assert "user_id uuid not null references auth.users(id) on delete cascade" in migration
    assert "alter table public.lesson_plans enable row level security" in migration
    assert 'create policy "users can insert their own lesson plans"' in migration
    assert "for insert with check (auth.uid() = user_id)" in migration
    assert 'create policy "users can view their own lesson plans"' in migration
    assert "for select using (auth.uid() = user_id)" in migration

    # This baseline intentionally does NOT include the later update/delete
    # policies or curriculum_type/chapter/curriculum_framework columns —
    # those are added by the existing later migrations that already assume
    # the table exists, exactly as documented in DATABASE_BASELINE_SPEC.md.
    # (Checked as column/policy SQL fragments, not bare substrings, since
    # the migration's own explanatory comments reference those later
    # migrations by filename.)
    assert "curriculum_type text" not in migration
    assert "for update using" not in migration
    assert "for delete using" not in migration


def test_saved_lessons_later_migrations_preserve_verified_columns() -> None:
    migrations = {
        path.name: _normalized_file(path)
        for path in MIGRATIONS_DIR.glob("*saved_lessons*.sql")
    }
    moderation = _normalized_file(
        MIGRATIONS_DIR / "20260825180000_content_moderation.sql"
    )

    assert (
        "20260610120000_saved_lessons_learning_objectives.sql" in migrations
    )
    assert (
        "alter table saved_lessons add column if not exists "
        "learning_objectives text not null default ''"
        in migrations["20260610120000_saved_lessons_learning_objectives.sql"]
    )

    assert "20260825140000_saved_lessons_chapter.sql" in migrations
    assert (
        "alter table public.saved_lessons add column if not exists chapter text not null default ''"
        in migrations["20260825140000_saved_lessons_chapter.sql"]
    )

    assert (
        "alter table public.saved_lessons add column if not exists "
        "flagged boolean not null default false"
        in moderation
    )
    assert (
        "alter table public.saved_lessons add column if not exists "
        "flagged_by uuid references auth.users(id)"
        in moderation
    )
    assert (
        "alter table public.saved_lessons add column if not exists deleted_at timestamptz"
        in moderation
    )


def test_saved_lessons_browser_autosave_contract_remains_visible() -> None:
    source = _normalized_file(LESSON_GENERATOR)

    assert '.from("saved_lessons") .insert' in source
    for field in (
        "user_id",
        "subject",
        "grade",
        "topic",
        "curriculum",
        "learning_objectives",
        "lesson_content",
        "ppt_content",
        "created_at",
        "chapter",
    ):
        assert field in source

    assert "20260825140000_saved_lessons_chapter.sql" in source


def test_school_templates_embedded_contract_and_runtime_debt_are_visible() -> None:
    setup_comment = _normalized_file(PPTX_TEMPLATE)
    upload_route = _normalized_file(SCHOOL_TEMPLATE_UPLOAD)
    crud_route = _normalized_file(SCHOOL_TEMPLATE_ROUTE)

    assert "create table if not exists school_templates" in setup_comment
    assert "user_id uuid references auth.users(id) on delete cascade not null" in setup_comment
    assert "unique(user_id)" in setup_comment
    assert "alter table school_templates enable row level security" in setup_comment
    assert 'create policy "users manage own template" on school_templates' in setup_comment
    assert "using (auth.uid() = user_id) with check (auth.uid() = user_id)" in setup_comment

    for field in (
        "original_filename",
        "thumbnail_base64",
        "primary_color",
        "accent_color",
        "background_color",
        "dark_color",
        "font_heading",
        "font_body",
        "logo_base64",
        "file_data",
    ):
        assert field in upload_route

    assert '.from("school_templates") .upsert' in upload_route
    assert '{ onconflict: "user_id" }' in upload_route
    assert "alter table school_templates add column if not exists logo_base64 text" in upload_route
    assert "alter table school_templates add column if not exists file_data text" in upload_route

    assert '.from("school_templates") .delete() .eq("user_id", user.id)' in crud_route
    assert "original_filename, thumbnail_base64, primary_color" in crud_route

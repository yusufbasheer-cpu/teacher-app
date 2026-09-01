from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = REPO_ROOT / "supabase" / "schema.sql"


def _normalized_sql() -> str:
    return " ".join(SCHEMA_SQL.read_text(encoding="utf-8").lower().split())


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

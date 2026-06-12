from pathlib import Path

from pglast import parse_sql


def main():
    migrations = sorted(Path("supabase/migrations").glob("*.sql"))
    if not migrations:
        raise SystemExit("No SQL migrations found")

    for migration in migrations:
        parse_sql(migration.read_text(encoding="utf-8"))
        print(f"OK {migration.name}")


if __name__ == "__main__":
    main()

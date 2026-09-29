"""The scraper's `seen` set and the prod unique constraint must agree on what
"the same job" means. They didn't: `seen` keyed on the raw lowercase
(company, role, location) triple while `internships_fingerprint_key` keys on
job_fingerprint(), which also strips punctuation. Two spellings of one company
therefore got distinct `seen` keys but one fingerprint, putting both rows in a
single execute_values page and aborting the scrape with a UniqueViolation.

Run: python3 test_fingerprint_dedup.py
"""

from read_db import job_fingerprint

# Two listings for one job. Distinct raw keys, one fingerprint.
PAIRS = [
    ("Acme, Inc.", "Acme Inc."),
    ("Acme  Inc", "Acme Inc."),          # whitespace collapse
    ("Widgets, LLC", "Widgets LLC"),
    ("Beta (USA) Co.", "Beta USA Co."),
]

# Genuinely different jobs that must survive: different role, different
# location. Note these are NOT collapse pairs -- norm deletes punctuation
# without inserting a space and strips non-ASCII, so "Acme,Inc."/"Café Labs"/
# "Foo-Bar" all fingerprint differently from their lookalikes.
DISTINCT = [
    ("Acme, Inc.", "Engineer", "NYC"),
    ("Acme, Inc.", "Designer", "NYC"),
    ("Acme, Inc.", "Engineer", "Remote"),
    ("Foo-Bar", "Engineer", "NYC"),
]


def dedup_key(job):
    """Mirrors the scraper's `seen` key. If this drifts from job_fingerprint,
    the test below fails."""
    return job_fingerprint(job["company"], job["role"], job["location"])


def main():
    # The upsert is a bare string literal, so py_compile says nothing about it.
    # A duplicated clause here only surfaces as a psycopg2 SyntaxError against
    # prod, which is how the "ON CONFLICT DO UPDATE / DO UPDATE SET" typo got
    # pushed. Check the shape instead.
    import re as _re
    from scraper import _UPSERT_SQL

    flat = " ".join(_UPSERT_SQL.split())
    assert "ON CONFLICT (" not in flat, "conflict target reintroduced"
    assert flat.count("DO UPDATE") == 1, flat
    assert _re.search(r"\bON CONFLICT\s+DO UPDATE SET\b", flat), flat
    # The SET list must omit the columns the upsert arbitrates, so a conflict
    # keeps the pre-existing row's identity (notably its link).
    set_list = flat.split("DO UPDATE SET", 1)[1]
    for col in ("company", "role", "location", "link"):
        assert f"{col} = EXCLUDED" not in set_list, f"SET list overwrites {col}"

    for a, b in PAIRS:
        ja = {"company": a, "role": "Engineer", "location": "NYC"}
        jb = {"company": b, "role": "Engineer", "location": "NYC"}
        raw_a = (a.lower(), "engineer", "nyc")
        raw_b = (b.lower(), "engineer", "nyc")
        assert job_fingerprint(**ja) == job_fingerprint(**jb), (a, b)
        # The old key failed to collapse these; the new one must.
        if raw_a != raw_b:
            assert dedup_key(ja) == dedup_key(jb), f"dedup_key missed {a!r}/{b!r}"

    seen = set()
    for company, role, loc in DISTINCT:
        k = dedup_key({"company": company, "role": role, "location": loc})
        assert k not in seen, f"over-merged distinct jobs: {company}/{role}/{loc}"
        seen.add(k)

    # The backfill must be greedy, not blind. Prod already holds content
    # duplicates, and internships_fingerprint_key forbids two rows sharing a
    # fingerprint -- filling every NULL row blindly raised UniqueViolation and
    # killed the scrape.
    def greedy_backfill(rows, taken=frozenset()):
        taken = set(taken)
        out = []
        for rid, company, role, loc in rows:
            fp = job_fingerprint(company, role, loc)
            if fp in taken:
                continue
            taken.add(fp)
            out.append((rid, fp))
        return out

    null_rows = [
        (1, "Acme, Inc.", "Engineer", "NYC"),
        (2, "Acme Inc.", "Engineer", "NYC"),      # same fingerprint as row 1
        (3, "Widgets, LLC", "Engineer", "NYC"),
        (4, "Widgets LLC", "Engineer", "NYC"),     # same fingerprint as row 3
    ]
    got = greedy_backfill(null_rows)
    assert [r[0] for r in got] == [1, 3], got
    assert len({fp for _, fp in got}) == len(got), "backfill emitted a duplicate"

    # A NULL row colliding with an already-populated row must also be skipped.
    seeded = greedy_backfill(null_rows, taken={job_fingerprint("Acme Inc.", "Engineer", "NYC")})
    assert 1 not in [r[0] for r in seeded], seeded

    print("OK: seen-key and fingerprint agree; distinct jobs kept; backfill greedy")


if __name__ == "__main__":
    main()

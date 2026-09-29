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

    print("OK: seen-key and fingerprint agree; distinct jobs still kept")


if __name__ == "__main__":
    main()

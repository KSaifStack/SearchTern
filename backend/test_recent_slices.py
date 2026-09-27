import sys
sys.path.insert(0, "/home/kankroid/Downloads/SearchTern/backend")

from fastapi.testclient import TestClient
import api

client = TestClient(api.app)


def rows(v):
    api.read_db.recent_internships = lambda: v


def get(qs):
    return client.get(f"/recent{qs}").json()


# 11 rows, 3 slices -> 4/4/3, nothing lost, nothing duplicated
rows([{"id": i, "date": str(i)} for i in range(11)])
s1, s2, s3 = get("?part=1&parts=3"), get("?part=2&parts=3"), get("?part=3&parts=3")
ids = lambda s: [j["id"] for j in s["result"]]
assert [len(s["result"]) for s in (s1, s2, s3)] == [4, 4, 3], [len(s["result"]) for s in (s1, s2, s3)]
assert sorted(ids(s1) + ids(s2) + ids(s3)) == list(range(11))
assert all(s["count"] == 11 and s["parts"] == 3 for s in (s1, s2, s3))

# unparametered /recent still returns everything, in the original order
full = get("")
assert len(full["result"]) == 11 and ids(full) == list(range(11)), ids(full)
assert full["part"] == 0 and full["parts"] == 1

# out-of-range part falls back to the full list rather than an empty one
assert len(get("?part=9&parts=3")["result"]) == 11

# parts is capped at 8: an absurd request degrades to 8 slices, still lossless
capped = [get(f"?part={p}&parts=20") for p in range(1, 9)]
assert all(s["parts"] == 8 and s["count"] == 11 for s in capped)
assert sorted(i for s in capped for i in ids(s)) == list(range(11))

# more slices than rows: one row per slice, the surplus slices come back empty
# rather than erroring
rows([{"id": i, "date": str(i)} for i in range(3)])
assert ids(get("?part=1&parts=8")) == [0]
assert ids(get("?part=3&parts=8")) == [2]
assert ids(get("?part=4&parts=8")) == []

# slices are newest-first, and the sort is numeric rather than lexical
rows([{"id": i, "date": d} for i, d in
      zip(range(6), ["2", "10", "0", "1", "0.5", "3"])])
first = get("?part=1&parts=3")
assert [j["date"] for j in first["result"]] == ["0", "0.5"], first
# "10" must not sort before "2" — a lexical sort would put it there
assert [j["date"] for j in get("?part=3&parts=3")["result"]] == ["3", "10"], get("?part=3&parts=3")

# unparseable date sorts last instead of blowing up
rows([{"id": 0, "date": "0"}, {"id": 1, "date": None}])
assert ids(get("?part=1&parts=2")) == [0], ids(get("?part=1&parts=2"))
assert ids(get("?part=2&parts=2")) == [1], ids(get("?part=2&parts=2"))

# revalidation: same slice twice reuses the ETag, so a scraper that changes
# nothing costs the client a 304 rather than 110KB
r = client.get("/recent?part=1&parts=3")
assert r.status_code == 200
r2 = client.get("/recent?part=1&parts=3", headers={"If-None-Match": r.headers["etag"]})
assert r2.status_code == 304, r2.status_code

print("ok")

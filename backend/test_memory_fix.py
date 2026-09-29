import asyncio
import gc
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault("API_KEY", "test-only")

import api
import read_db
import scraper


class _ClientEncoding:
    # execute_values encodes the statement through cur.connection.encoding,
    # looked up in psycopg2.extensions.encodings — whose key is "UTF8".
    encoding = "UTF8"


class FakeCursor:
    def __init__(self, constraint=True):
        self.constraint = constraint
        self.row = None
        self.queries = []
        self.rows = []
        self.mogrified = []
        self.connection = _ClientEncoding()

    def execute(self, query, params=None):
        # execute_values hands over the encoded statement as bytes; a real
        # cursor takes either, so this does too.
        if isinstance(query, bytes):
            query = query.decode("utf8", "replace")
        self.queries.append(query)
        if "pg_get_constraintdef" in query:
            self.row = ("UNIQUE (company, role, location, link)",) if self.constraint else None
        elif "DELETE FROM internships" in query:
            self.row = None

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows

    def mogrify(self, query, params=None):
        # execute_values folds the rows into the statement via mogrify, so
        # keeping the params here is the only way to assert on what a batch
        # actually wrote. It hands the query in already encoded and expects
        # bytes back, which it then joins.
        encoded = query if isinstance(query, bytes) else query.encode("utf8")
        self.mogrified.append((encoded.decode("utf8", "replace"), params))
        return encoded

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class FakeConnection:
    def __init__(self, constraint=True):
        self.cursor_obj = FakeCursor(constraint)
        self.closed = False
        self.commits = 0

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.commits += 1

    def close(self):
        self.closed = True


class MemoryFixTests(unittest.TestCase):
    def test_one_bad_source_does_not_abort_the_others(self):
        """9c34832 made every source error raise, which skipped the upsert for
        every healthy source too. One 429 must not cost the whole run."""
        connection = FakeConnection()
        job = {
            "company": "Example", "role": "Intern", "location": "New York, NY",
            "date": "0", "link": "https://example.com/job", "type": "internship",
            "season": "2027", "ats": "", "description": None,
        }
        with patch.object(scraper, "scrape_simplify_readme", side_effect=RuntimeError("HTTP 429")), \
             patch.object(scraper, "scrape_markdown_readme", return_value=[job]), \
             patch.object(scraper, "scrape_searchtern_listings", return_value=[]), \
             patch.object(scraper.psycopg2, "connect", return_value=connection), \
             patch.object(scraper, "execute_values") as ev:
            result = scraper._update_database()
        ev.assert_called_once()
        self.assertIn("source failures", result)
        self.assertTrue(result.startswith("Done! 1 listings upserted."))

    def test_failed_source_suppresses_the_stale_purge(self):
        """A source we could not read may own rows that are genuinely still
        open — purging on their last_seen_at would delete live listings."""
        connection = FakeConnection()
        job = {
            "company": "Example", "role": "Intern", "location": "New York, NY",
            "date": "0", "link": "https://example.com/job", "type": "internship",
            "season": "2027", "ats": "", "description": None,
        }
        with patch.object(scraper, "scrape_simplify_readme", side_effect=RuntimeError("boom")), \
             patch.object(scraper, "scrape_markdown_readme", return_value=[job]), \
             patch.object(scraper, "scrape_searchtern_listings", return_value=[]), \
             patch.object(scraper.psycopg2, "connect", return_value=connection), \
             patch.object(scraper, "execute_values"):
            scraper._update_database()
        purges = [q for q in connection.cursor_obj.queries if "last_seen_at <" in q]
        self.assertEqual(purges, [], "stale-row purge ran despite a failed source")

    def test_failed_write_aborts_rather_than_reporting_success(self):
        connection = FakeConnection()
        job = {
            "company": "Example", "role": "Intern", "location": "New York, NY",
            "date": "0", "link": "https://example.com/job", "type": "internship",
            "season": "2027", "ats": "", "description": None,
        }
        with patch.object(scraper, "scrape_simplify_readme", return_value=[job]), \
             patch.object(scraper, "scrape_markdown_readme", return_value=[]), \
             patch.object(scraper, "scrape_searchtern_listings", return_value=[]), \
             patch.object(scraper.psycopg2, "connect", return_value=connection), \
             patch.object(scraper, "execute_values", side_effect=RuntimeError("write failed")):
            with self.assertRaises(RuntimeError):
                scraper._update_database()
        self.assertTrue(connection.closed)

    def test_local_lock_skips_second_scrape(self):
        scraper._update_lock.acquire()
        try:
            with patch.object(scraper.psycopg2, "connect") as connect:
                self.assertIsNone(scraper.update_database())
                connect.assert_not_called()
        finally:
            scraper._update_lock.release()

    def test_advisory_lock_skips_locked_scrape(self):
        connection = FakeConnection()
        connection.cursor_obj.row = (False,)
        with patch.object(scraper.psycopg2, "connect", return_value=connection), patch.object(
            scraper, "_update_database"
        ) as update:
            self.assertIsNone(scraper.update_database())
            update.assert_not_called()
        self.assertTrue(connection.closed)
        self.assertEqual(connection.commits, 0)

    def test_advisory_lock_allows_scrape_and_closes_connection(self):
        connection = FakeConnection()
        connection.cursor_obj.row = (True,)
        with patch.object(scraper.psycopg2, "connect", return_value=connection), patch.object(
            scraper, "_update_database", return_value="done"
        ) as update:
            self.assertEqual(scraper.update_database(), "done")
            update.assert_called_once_with()
        self.assertTrue(connection.closed)
        self.assertEqual(connection.commits, 1)

    def test_write_connection_closes_on_database_failure(self):
        connection = FakeConnection()
        job = {
            "company": "Example",
            "role": "Intern",
            "location": "New York, NY",
            "date": "0",
            "link": "https://example.com/job",
            "type": "internship",
            "season": "2027",
            "ats": "",
            "description": "description",
        }
        with patch.object(scraper, "scrape_simplify_readme", return_value=[job]), patch.object(
            scraper, "scrape_markdown_readme", return_value=[]
        ), patch.object(scraper, "scrape_searchtern_listings", return_value=[]), patch.object(
            scraper.psycopg2, "connect", return_value=connection
        ), patch.object(scraper, "execute_values", side_effect=RuntimeError("write failed")):
            with self.assertRaises(RuntimeError):
                scraper._update_database()
        self.assertTrue(connection.closed)

    def test_streaming_feed_sets_decode_content(self):
        """raw.githubusercontent.com always answers Content-Encoding: gzip, and
        urllib3 does not decompress on raw.read(). Without decode_content, ijson
        raises on every fetch — and per-source error handling would then swallow
        it, leaving the feed contributing zero rows forever with a clean log."""
        job = {"link": "https://example.com/x", "company": "C", "role": "R",
               "location": "Austin, TX", "date": "0"}
        response = Mock(status_code=200)
        response.raw.decode_content = False
        with patch.object(scraper.requests, "get", return_value=response), \
             patch.object(scraper.ijson, "items", return_value=iter([job])) as items:
            rows = list(scraper.scrape_searchtern_listings("https://example.com/f.json"))
        items.assert_called_once_with(response.raw, "item")
        self.assertTrue(response.raw.decode_content, "decode_content was not set")
        self.assertEqual(len(rows), 1)
        response.close.assert_called()

    def test_pool_slot_is_returned_when_a_query_raises(self):
        """The pool keys _used by id(conn): a caller that raises before its
        conn.close() leaks the slot permanently and getconn() eventually raises
        PoolError for everyone. __del__ returns it."""
        pool, conn = Mock(), FakeConnection()
        with patch.object(read_db, "_get_pool", return_value=pool):
            pooled = read_db._PooledConn(conn)
            del pooled
            gc.collect()
        pool.putconn.assert_called_once_with(conn)

    def test_list_projection_omits_descriptions(self):
        self.assertNotIn("description", read_db._JOB_LIST_COLUMNS)
        self.assertIn("company", read_db._JOB_LIST_COLUMNS)

    def test_startup_does_not_scrape(self):
        calls = []
        original = api.scraper.update_database
        api.scraper.update_database = lambda: calls.append("scrape")
        try:
            async def run_lifespan():
                async with api.lifespan(api.app):
                    await asyncio.sleep(0)

            asyncio.run(run_lifespan())
        finally:
            api.scraper.update_database = original
        self.assertEqual(calls, [])

    # ── /count and /jobs/lookup used to read the whole table ──────────────────

    def test_count_and_lookup_never_read_the_whole_table(self):
        """Both went through recent_internships(): /count returned len() of a
        ~10MB pull, and /jobs/lookup walked all 13k rows in Python per request.
        That whole-table read is most of the Supabase egress, so it is worth a
        test that fails if either endpoint regresses to it."""
        conn = FakeConnection()
        with patch.object(read_db, "get_conn", return_value=conn), \
             patch.object(read_db, "snapshot",
                          side_effect=AssertionError("read the whole table")), \
             patch.object(read_db, "recent_internships",
                          side_effect=AssertionError("read the whole table")):
            self.assertEqual(read_db.count_internships(), 0)
            self.assertIsNone(read_db.find_internship_id("Acme, Inc.", "Intern", "Remote"))
        queries = " ".join(conn.cursor_obj.queries)
        self.assertIn("SELECT count(*) FROM internships", queries)
        self.assertIn("WHERE fingerprint = %s", queries)

    def test_fingerprint_ignores_case_and_punctuation(self):
        """Tracked jobs key off this string, so it has to survive the tidying
        the frontend does before it ever reaches the API."""
        self.assertEqual(
            read_db.job_fingerprint("Acme, Inc.", "C++ Intern", "New York, NY"),
            read_db.job_fingerprint("acme inc", "c intern", "new york ny"),
        )
        self.assertNotEqual(
            read_db.job_fingerprint("Acme", "Intern", "Remote"),
            read_db.job_fingerprint("Acme", "Intern", "SF"),
        )

    def test_upsert_stores_the_fingerprint_the_reader_looks_up(self):
        """The scraper writes it and /jobs/lookup reads it. If the two copies
        ever disagree the result is a 404 on every tracked job that looks
        perfectly healthy, so pin them to one implementation."""
        cursor = FakeCursor()
        row = {"company": "Acme, Inc.", "role": "C++ Intern",
               "location": "New York, NY", "date": "0", "link": "https://x/y",
               "type": "internship", "season": "2027", "ats": "",
               "description": None}
        scraper._flush(cursor, [row], None)
        # execute_values mogrifies a row template; the assembled statement is
        # what reaches execute().
        sql, params = cursor.queries[-1], cursor.mogrified[0][1]
        self.assertIn("fingerprint", sql)
        self.assertIn("fingerprint = EXCLUDED.fingerprint", sql)
        self.assertIn(
            read_db.job_fingerprint("acme inc", "c intern", "new york ny"),
            list(params),
        )

    def test_backfill_reconciles_every_row_not_just_nulls(self):
        """Rows written before the column existed, plus rows whose stored value
        is not the normaliser's own value for their own columns. The normaliser
        has to be the Python one rather than a SQL translation of the same
        regexes: per-field .strip() versus a single btrim over the joined
        string drifts for one, and a drifted fingerprint silently 404s until
        that row is re-scraped.

        A drifted row is not cosmetic. The upsert arbitrates on (fingerprint)
        and nothing else, so a row the normaliser disagrees with is invisible
        to that arbiter while still holding (company, role, location, link) --
        an insert matching it there aborts the whole run. That killed every
        scrape for 52 rows holding a foreign normaliser's value. So the pass
        must not stop at IS NULL."""
        cursor = FakeCursor()
        self.assertEqual(scraper._backfill_fingerprints(cursor), 0)
        self.assertEqual(cursor.mogrified, [])

        fp = read_db.job_fingerprint("acme inc", "c intern", "new york ny")
        # A NULL is filled in.
        cursor = FakeCursor()
        cursor.rows = [(1, "Acme, Inc.", "C++ Intern", "New York, NY", None)]
        self.assertEqual(scraper._backfill_fingerprints(cursor), 1)
        sql, params = cursor.queries[-1], cursor.mogrified[0][1]
        self.assertIn("SET fingerprint", sql)
        self.assertIn(fp, list(params))

        # A drifted value is corrected.
        cursor = FakeCursor()
        cursor.rows = [(2, "American Express", "Intern", "NYC",
                        "american express|intern|ny")]
        self.assertEqual(scraper._backfill_fingerprints(cursor), 1)
        self.assertIn(
            read_db.job_fingerprint("american express", "intern", "nyc"),
            list(cursor.mogrified[0][1]),
        )

        # A row already carrying the right value is left alone -- no write.
        cursor = FakeCursor()
        cursor.rows = [(3, "Acme, Inc.", "C++ Intern", "New York, NY", fp)]
        self.assertEqual(scraper._backfill_fingerprints(cursor), 0)
        self.assertEqual(cursor.mogrified, [])


if __name__ == "__main__":
    unittest.main()

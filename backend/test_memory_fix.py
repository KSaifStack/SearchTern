import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
os.environ.setdefault("API_KEY", "test-only")

import api
import read_db
import scraper


class FakeCursor:
    def __init__(self, constraint=True):
        self.constraint = constraint
        self.row = None

    def execute(self, query, params=None):
        if "pg_get_constraintdef" in query:
            self.row = ("UNIQUE (company, role, location, link)",) if self.constraint else None

    def fetchone(self):
        return self.row


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
    def test_source_failure_aborts_before_write_connection(self):
        with patch.object(scraper, "scrape_simplify_readme", side_effect=RuntimeError("source failed")), patch.object(
            scraper.psycopg2, "connect"
        ) as connect:
            with self.assertRaises(RuntimeError):
                scraper._update_database()
            connect.assert_not_called()

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


if __name__ == "__main__":
    unittest.main()

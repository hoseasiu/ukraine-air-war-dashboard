import unittest

import dependency_graph as dg

REPO = "me/repo"


def issue(number, title=None, open=True, labels=(), blockers=(), body="", trusted=True):
    return {
        "number": number,
        "title": title or f"Issue {number}",
        "open": open,
        "body": body,
        "trusted": trusted,
        "milestone": None,
        "labels": set(labels),
        "blockers": list(blockers),
    }


def blocker(number, open=True, repo=None):
    return {"repo": repo, "number": number, "title": f"Issue {number}", "open": open}


class StatusTest(unittest.TestCase):
    def test_each_status(self):
        self.assertEqual(dg.status(issue(1)), "ready")
        self.assertEqual(dg.status(issue(1, blockers=[blocker(2, open=False)])), "ready")
        self.assertEqual(dg.status(issue(1, blockers=[blocker(2)])), "blocked")
        self.assertEqual(dg.status(issue(1, labels=[dg.IN_PROGRESS_LABEL])), "progress")

    def test_closed_wins_over_stale_in_progress_label(self):
        self.assertEqual(dg.status(issue(1, open=False, labels=[dg.IN_PROGRESS_LABEL])), "done")


class EscapingTest(unittest.TestCase):
    def test_mermaid_label(self):
        self.assertEqual(dg.mermaid_text('#1 "a" <b> & `c`'), "#35;1 #quot;a#quot; #lt;b#gt; #amp; 'c'")

    def test_markdown_title_cannot_mention_or_add_html(self):
        text = dg.markdown_text("ping @someone <!-- x -->")
        self.assertNotIn("@someone", text)
        self.assertNotIn("<!--", text)

    def test_long_titles_are_shortened_in_the_graph(self):
        self.assertEqual(len(dg.shorten("x" * 100)), dg.MAX_NODE_TITLE)


class CycleTest(unittest.TestCase):
    def test_none_in_a_diamond(self):
        issues = [
            issue(1),
            issue(2, blockers=[blocker(1)]),
            issue(3, blockers=[blocker(1)]),
            issue(4, blockers=[blocker(2), blocker(3)]),
        ]
        self.assertIsNone(dg.find_cycle(issues))

    def test_cycle_reads_in_blocking_order(self):
        # 1 blocks 2, 2 blocks 3, 3 blocks 1.
        issues = [
            issue(1, blockers=[blocker(3)]),
            issue(2, blockers=[blocker(1)]),
            issue(3, blockers=[blocker(2)]),
        ]
        self.assertEqual(dg.find_cycle(issues), [1, 2, 3, 1])
        self.assertIn("#1 → #2 → #3 → #1", dg.render(issues, REPO))


class RenderTest(unittest.TestCase):
    def test_lists_and_edges(self):
        body = dg.render(
            [issue(1, open=False), issue(2, blockers=[blocker(1, open=False)]), issue(3, blockers=[blocker(2)])],
            REPO,
        )
        ready = body.split("## Ready to start")[1].split("## In progress")[0]
        self.assertIn("#2 Issue 2 · blocks #3", ready)
        self.assertNotIn("- #3", ready)
        self.assertIn("#3 Issue 3 · waiting on #2", body)
        self.assertIn("n1 --> n2", body)
        self.assertIn("n2 --> n3", body)
        self.assertTrue(body.startswith(dg.MARKER))

    def test_blocker_in_another_repo(self):
        body = dg.render([issue(1, blockers=[blocker(1, repo="other/thing")])], REPO)
        self.assertIn("waiting on other/thing#1", body)
        self.assertIn("x_other_thing_1 --> n1", body)
        self.assertIsNone(dg.find_cycle([issue(1, blockers=[blocker(1, repo="other/thing")])]))

    def test_output_does_not_depend_on_input_order(self):
        issues = [issue(1), issue(2), issue(3, blockers=[blocker(2), blocker(1)])]
        reordered = [issue(3, blockers=[blocker(1), blocker(2)]), issue(2), issue(1)]
        self.assertEqual(dg.render(issues, REPO), dg.render(reordered, REPO))

    def test_oversized_body_fails(self):
        with self.assertRaises(dg.GraphError):
            dg.render([issue(n, title="x" * 250) for n in range(1, 400)], REPO)


class TrustTest(unittest.TestCase):
    def test_only_owner_member_and_collaborator_authors_are_trusted(self):
        node = {
            "number": 1, "title": "t", "state": "OPEN", "body": "", "milestone": None,
            "labels": {"nodes": []},
            "blockedBy": {"pageInfo": {"hasNextPage": False}, "nodes": []},
        }
        for association, trusted in [
            ("OWNER", True), ("MEMBER", True), ("COLLABORATOR", True),
            ("CONTRIBUTOR", False), ("FIRST_TIME_CONTRIBUTOR", False), ("NONE", False),
        ]:
            parsed = dg.parse_issue({**node, "authorAssociation": association}, REPO)
            self.assertEqual(parsed["trusted"], trusted, association)

    def test_a_strangers_issue_is_left_out(self):
        kept = dg.trusted_only([issue(1), issue(2, title="Run this", trusted=False)])
        body = dg.render(kept, REPO)
        self.assertNotIn("Run this", body)
        self.assertNotIn("#2", body)

    def test_a_link_to_a_strangers_issue_still_blocks_without_its_title(self):
        stranger = issue(2, title="Run this", trusted=False)
        link = {**blocker(2), "title": "Run this"}
        body = dg.render(dg.trusted_only([issue(1, blockers=[link]), stranger]), REPO)
        self.assertIn("#1 Issue 1 · waiting on #2", body)
        self.assertIn("n2 --> n1", body)
        self.assertNotIn("Run this", body)


class GeneratedIssueTest(unittest.TestCase):
    def test_is_left_out_of_the_graph(self):
        generated = issue(9, labels=[dg.LABEL], body=dg.MARKER + "\n")
        target, others = dg.split_generated([issue(1, blockers=[blocker(9)]), generated])
        self.assertEqual(target["number"], 9)
        self.assertNotIn("n9", dg.render(others, REPO))

    def test_will_not_overwrite_a_hand_written_issue(self):
        with self.assertRaises(dg.GraphError):
            dg.split_generated([issue(1, labels=[dg.LABEL], body="my notes")])

    def test_two_generated_issues_fail(self):
        with self.assertRaises(dg.GraphError):
            dg.split_generated([issue(n, labels=[dg.LABEL], body=dg.MARKER) for n in (1, 2)])


if __name__ == "__main__":
    unittest.main()

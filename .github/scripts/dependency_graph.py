"""Keep one generated issue showing the issue dependency graph and list.

GitHub's native "blocked by" links are the only source. Needs the `gh` CLI,
signed in or with GH_TOKEN set.

    python .github/scripts/dependency_graph.py            # create or update the issue
    python .github/scripts/dependency_graph.py --dry-run  # print the body, write nothing
"""

import argparse
import json
import os
import re
import subprocess
import sys

LABEL = "auto:dependency-graph"
IN_PROGRESS_LABEL = "agent:in-progress"
OWNER_LABEL = "needs:owner"
MARKER = "<!-- dependency-graph: generated, do not edit -->"
TITLE = "Issue dependency graph (auto-generated)"
WORKFLOW = "dependency-graph.yml"
MAX_BODY = 65536
MAX_NODE_TITLE = 40

STATUS_TEXT = {"done": "done", "ready": "ready", "progress": "in progress", "blocked": "blocked"}
STATUS_STYLE = {
    "done": "fill:#eeeeee,stroke:#767676,color:#333333",
    "ready": "fill:#d9f0d3,stroke:#1b7837,color:#000000,stroke-width:3px",
    "progress": "fill:#fff1b8,stroke:#8a6d00,color:#000000,stroke-width:3px",
    "blocked": "fill:#ffffff,stroke:#555555,color:#000000,stroke-dasharray:5 4",
}

QUERY = """
query($owner: String!, $name: String!, $endCursor: String) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, after: $endCursor, orderBy: {field: CREATED_AT, direction: ASC}) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title state body
        milestone { title }
        labels(first: 100) { nodes { name } }
        blockedBy(first: 50) {
          pageInfo { hasNextPage }
          nodes { number title state repository { nameWithOwner } }
        }
      }
    }
  }
}
"""


class GraphError(Exception):
    pass


def gh(*args, payload=None):
    result = subprocess.run(
        ["gh", *args],
        input=None if payload is None else json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode:
        raise GraphError(f"gh {' '.join(args[:3])} failed: {result.stderr.strip()}")
    return result.stdout


def fetch_issues(repo):
    owner, name = repo.split("/")
    issues, cursor = [], None
    while True:
        args = ["api", "graphql", "-f", f"query={QUERY}", "-f", f"owner={owner}", "-f", f"name={name}"]
        if cursor:
            args += ["-f", f"endCursor={cursor}"]
        page = json.loads(gh(*args))["data"]["repository"]["issues"]
        issues += [parse_issue(node, repo) for node in page["nodes"]]
        if not page["pageInfo"]["hasNextPage"]:
            return issues
        cursor = page["pageInfo"]["endCursor"]


def parse_issue(node, repo):
    if node["blockedBy"]["pageInfo"]["hasNextPage"]:
        raise GraphError(f"#{node['number']} has more than 50 blockers; add pagination")
    blockers = []
    for blocker in node["blockedBy"]["nodes"]:
        other = blocker["repository"]["nameWithOwner"]
        blockers.append(
            {
                "repo": None if other.lower() == repo.lower() else other,
                "number": blocker["number"],
                "title": blocker["title"],
                "open": blocker["state"] == "OPEN",
            }
        )
    return {
        "number": node["number"],
        "title": node["title"],
        "open": node["state"] == "OPEN",
        "body": node["body"] or "",
        "milestone": node["milestone"]["title"] if node["milestone"] else None,
        "labels": {label["name"] for label in node["labels"]["nodes"]},
        "blockers": blockers,
    }


def split_generated(issues):
    """Return (the generated issue or None, every other issue)."""
    generated = [i for i in issues if LABEL in i["labels"]]
    if len(generated) > 1:
        numbers = ", ".join(f"#{i['number']}" for i in generated)
        raise GraphError(f"More than one issue has the {LABEL} label: {numbers}")
    if generated and not generated[0]["body"].startswith(MARKER):
        raise GraphError(
            f"#{generated[0]['number']} has the {LABEL} label but wasn't generated; not overwriting it"
        )
    target = generated[0] if generated else None
    return target, [i for i in issues if i is not target]


def prepare(issues):
    """Sort issues and blockers, and drop links to the generated issue."""
    numbers = {i["number"] for i in issues}
    prepared = []
    for issue in sorted(issues, key=lambda i: i["number"]):
        blockers = [b for b in issue["blockers"] if b["repo"] or b["number"] in numbers]
        blockers.sort(key=lambda b: (b["repo"] or "", b["number"]))
        prepared.append({**issue, "blockers": blockers})
    return prepared


def status(issue):
    if not issue["open"]:
        return "done"
    if IN_PROGRESS_LABEL in issue["labels"]:
        return "progress"
    if any(b["open"] for b in issue["blockers"]):
        return "blocked"
    return "ready"


def find_cycle(issues):
    """Return one cycle as a list of issue numbers (first repeated last), or None."""
    graph = {i["number"]: [b["number"] for b in i["blockers"] if not b["repo"]] for i in issues}
    finished, path = set(), []

    def visit(number):
        if number in path:
            return path[path.index(number) :] + [number]
        if number in finished:
            return None
        path.append(number)
        for blocker in graph.get(number, []):
            cycle = visit(blocker)
            if cycle:
                return cycle
        path.pop()
        finished.add(number)
        return None

    for number in sorted(graph):
        cycle = visit(number)
        if cycle:
            # The walk follows "blocked by"; reverse it to read as "blocks".
            return cycle[::-1]
    return None


def ref(blocker):
    return f"{blocker['repo'] or ''}#{blocker['number']}"


def markdown_text(text):
    """Make a title safe in the issue body: no HTML, and no @mention notifications."""
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r"@(?=\w)", "@​", text)


def mermaid_text(text):
    """Escape text for a quoted Mermaid label, using Mermaid's entity codes."""
    codes = {"#": "#35;", '"': "#quot;", "&": "#amp;", "<": "#lt;", ">": "#gt;", "`": "'"}
    return "".join(codes.get(char, char) for char in " ".join(text.split()))


def shorten(text, limit=MAX_NODE_TITLE):
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def node_id(blocker):
    if not blocker["repo"]:
        return f"n{blocker['number']}"
    return "x_" + re.sub(r"\W", "_", blocker["repo"]) + f"_{blocker['number']}"


def render_graph(issues):
    lines = ["```mermaid", "flowchart LR"]
    external = {}
    for issue in issues:
        state = status(issue)
        note = STATUS_TEXT[state]
        if state != "done" and OWNER_LABEL in issue["labels"]:
            note += " · needs owner"
        label = f"{mermaid_text('#' + str(issue['number']) + ' ' + shorten(issue['title']))}<br/>{note}"
        lines.append(f'  n{issue["number"]}["{label}"]:::{state}')
        for blocker in issue["blockers"]:
            if blocker["repo"]:
                external[node_id(blocker)] = blocker
    for key, blocker in sorted(external.items()):
        state = "blocked" if blocker["open"] else "done"
        note = "open" if blocker["open"] else "done"
        lines.append(f'  {key}["{mermaid_text(ref(blocker))}<br/>{note}"]:::{state}')
    for issue in issues:
        for blocker in issue["blockers"]:
            lines.append(f"  {node_id(blocker)} --> n{issue['number']}")
    lines += [f"  classDef {name} {style}" for name, style in STATUS_STYLE.items()]
    lines.append("```")
    return lines


def render_entry(issue, unblocks):
    parts = [f"- #{issue['number']} {markdown_text(issue['title'])}"]
    if issue["milestone"]:
        parts.append(markdown_text(issue["milestone"]))
    if issue["open"]:
        if OWNER_LABEL in issue["labels"]:
            parts.append("**needs owner**")
        waiting = [ref(b) for b in issue["blockers"] if b["open"]]
        if waiting:
            parts.append("waiting on " + ", ".join(waiting))
        downstream = unblocks.get(issue["number"])
        if downstream:
            parts.append("blocks " + ", ".join(f"#{n}" for n in downstream))
    return " · ".join(parts)


def render(issues, repo):
    issues = prepare(issues)
    unblocks = {}
    for issue in issues:
        for blocker in issue["blockers"]:
            if not blocker["repo"] and issue["open"]:
                unblocks.setdefault(blocker["number"], []).append(issue["number"])

    groups = {state: [i for i in issues if status(i) == state] for state in STATUS_TEXT}
    counts = " · ".join(
        f"**{len(groups[state])}** {STATUS_TEXT[state]}"
        for state in ("ready", "progress", "blocked", "done")
    )

    lines = [
        MARKER,
        "> [!NOTE]",
        "> This issue is generated from GitHub's \"blocked by\" links. **Edits here are overwritten.**",
        "> To change a dependency, open the blocked issue and use **Relationships** in the sidebar.",
        "> It updates when issues change and every 6 hours. Changing only a link doesn't start an update;"
        f" to update now, [run the workflow](https://github.com/{repo}/actions/workflows/{WORKFLOW}).",
        "",
        counts,
        "",
    ]

    cycle = find_cycle(issues)
    if cycle:
        lines += [
            "> [!WARNING]",
            "> Dependency cycle, so these can never become ready: " + " → ".join(f"#{n}" for n in cycle),
            "",
        ]

    lines += ["## Graph", "", "Arrows point from a blocker to the issue it blocks.", ""]
    lines += render_graph(issues)

    for state, heading in (("ready", "Ready to start"), ("progress", "In progress"), ("blocked", "Blocked")):
        lines += ["", f"## {heading}", ""]
        lines += [render_entry(i, unblocks) for i in groups[state]] or ["None."]

    lines += ["", "## Done", ""]
    if groups["done"]:
        lines += ["<details>", f"<summary>{len(groups['done'])} closed</summary>", ""]
        lines += [render_entry(i, unblocks) for i in groups["done"]]
        lines += ["", "</details>"]
    else:
        lines.append("None.")

    body = "\n".join(lines) + "\n"
    if len(body) > MAX_BODY:
        raise GraphError(f"Body is {len(body)} characters; GitHub's limit is {MAX_BODY}")
    return body


def normalize(body):
    return body.replace("\r\n", "\n").strip()


def publish(repo, target, body):
    if target is None:
        gh(
            "label", "create", LABEL, "--repo", repo, "--force",
            "--color", "BFD4F2", "--description", "The generated issue dependency graph",
        )
        created = json.loads(
            gh(
                "api", "-X", "POST", f"repos/{repo}/issues", "--input", "-",
                payload={"title": TITLE, "body": body, "labels": [LABEL]},
            )
        )
        print(f"Created {created['html_url']}")
    elif normalize(target["body"]) == normalize(body):
        print(f"#{target['number']} is already up to date")
    else:
        gh("api", "-X", "PATCH", f"repos/{repo}/issues/{target['number']}", "--input", "-", payload={"body": body})
        print(f"Updated #{target['number']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="print the body and write nothing")
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"), help="owner/name")
    args = parser.parse_args()
    # The Windows console default (cp1252) can't print every title.
    sys.stdout.reconfigure(encoding="utf-8")

    try:
        repo = args.repo or gh("repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner").strip()
        target, issues = split_generated(fetch_issues(repo))
        body = render(issues, repo)
        if args.dry_run:
            print(body, end="")
        else:
            publish(repo, target, body)
        cycle = find_cycle(prepare(issues))
        if cycle:
            raise GraphError("Dependency cycle: " + " -> ".join(f"#{n}" for n in cycle))
    except GraphError as error:
        sys.exit(f"error: {error}")


if __name__ == "__main__":
    main()

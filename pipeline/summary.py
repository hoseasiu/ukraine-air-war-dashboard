"""The summary report that ends a build: headline numbers, taken from the built tables.

It's printed for checking, and nothing reads it back. The site works out its own
figures from the tables, so don't type these into it. It's plain ASCII, because the
Windows console can't print everything.
"""

from pipeline.strikes import MISSILE_RATES_END_BEFORE, month_end

EW_CAVEAT = '"Destroyed" includes weapons lost to electronic warfare.'


def _sum(rows, column):
    return sum(row[column] or 0 for row in rows)


def intercept_share(rows):
    """(destroyed, launches with an outcome) over monthly rows, all classes together."""
    return _sum(rows, "destroyed"), _sum(rows, "launched_with_outcome")


def mean_area_hours(alerts):
    """(mean over areas of each area's total hours, number of areas, number of months)."""
    totals = {}
    for row in alerts["rows"]:
        totals[row["oblast"]] = totals.get(row["oblast"], 0) + row["hours"]
    months = {row["month"] for row in alerts["rows"]}
    return sum(totals.values()) / len(totals), len(totals), len(months)


def _share_line(first, last, rows):
    destroyed, launched = intercept_share(rows)
    if not launched:
        return f"    {first} to {last}: no launches with an outcome"
    return (
        f"    {first} to {last}: {destroyed / launched:.1%} "
        f"({destroyed:,} of {launched:,} launches with an outcome)"
    )


def _stop_1(monthly, alerts):
    rows = monthly["rows"]
    first, last = monthly["first_day"], monthly["last_day"]
    restriction = monthly["restriction_from"]
    before = [r for r in rows if r["month"] < MISSILE_RATES_END_BEFORE]
    lines = [
        "Guided stop 1",
        f"  Weapons reported launched, {first} to {last}: {_sum(rows, 'launched'):,}",
        "    Counted classes, national military reports, daytime reports included.",
        f"    MISSILE-REPORTING RESTRICTION from {restriction}: some missile counts are",
        "    unpublished, and the total leaves them out. Entries (one per report and",
        f"    model) with no known launch count: {_sum(rows, 'n_unknown_launched'):,}.",
        "  Share reported destroyed, all counted classes together:",
    ]
    if before:
        end = month_end(max(r["month"] for r in before)).isoformat()
        lines.append(_share_line(first, min(end, last), before))
    else:
        lines.append(f"    none: no rows before {MISSILE_RATES_END_BEFORE}")
    lines += [
        f"    {EW_CAVEAT}",
        "    All-class shares stop at July 31, 2026, before missile reporting was",
        "    restricted (owner's decision, docs/plan.md section 11).",
    ]
    mean, areas, months = mean_area_hours(alerts)
    excluded = ", ".join(a["name"] for a in alerts["excluded_areas"]) or "none"
    lines += [
        f"  Alert hours, mean per area, {alerts['first_day']} to {alerts['last_day']}:",
        f"    {mean / months:,.1f} hours in an average month. Areas: {areas}.",
        f"    Excluded, not zero: {excluded}.",
        "    Each area is the average of its raions. Some ends may be assumed, and months",
        "    from 2025 are only partly comparable because of the switch to raion alerts.",
    ]
    return lines


def _strikes(nights, monthly):
    by_class = {}
    for row in monthly["rows"]:
        by_class.setdefault(row["class"], []).append(row)
    totals = {class_id: _sum(rows, "launched") for class_id, rows in by_class.items()}
    lines = [
        f"Weapons reported launched by class, {monthly['first_day']} to {monthly['last_day']}",
        f"  Includes the missile-reporting restriction from {monthly['restriction_from']}.",
        "  Mixed rows aren't split, so other classes don't cover every launch of their kind.",
    ]
    lines += [
        f"  {class_id:<26}{total:>9,}"
        for class_id, total in sorted(totals.items(), key=lambda item: -item[1])
    ]
    lines += [
        f"Attack nights, daytime reports left out: {len({r['date'] for r in nights['rows']}):,}",
        "  A massive night had more weapons launched than 95% of its calendar year's nights.",
        "  The bar differs by year, so the counts aren't a trend.",
    ]
    for year in nights["massive"]["years"]:
        restricted = year["last_night"] >= nights["restriction_from"]
        note = "  (uses nights under the missile restriction)" if restricted else ""
        lines.append(
            f"  {year['year']}: more than {year['massive_above']:g} launched; "
            f"{year['n_massive']} of {year['n_nights']} nights{note}"
        )
    return lines


def _checks(reconciliation, sizes, budget):
    raw = reconciliation["raw_daily_file"]
    lines = [
        "Checks passed",
        f"  The strike tables reconcile with the {raw['rows']:,} raw rows. Rows by bucket:",
    ]
    lines += [
        f"    {name:<26}{bucket['rows']:>7,}"
        for name, bucket in reconciliation["buckets"].items()
    ]
    lines += [
        "  Every model string has a class, and no official alert ends before it starts.",
        f"  Site data and font: {sum(sizes.values()):,} of {budget:,} bytes "
        f"({len(sizes)} files, before compression).",
    ]
    return lines


def summary_report(nights, monthly, alerts, reconciliation, sizes, budget):
    """The report as one string, from the built tables (`alerts` is the monthly one)."""
    sections = (
        [f"Summary report (strike snapshot {monthly['last_day']})"],
        _stop_1(monthly, alerts),
        _strikes(nights, monthly),
        _checks(reconciliation, sizes, budget),
    )
    return "\n\n".join("\n".join(lines) for lines in sections)

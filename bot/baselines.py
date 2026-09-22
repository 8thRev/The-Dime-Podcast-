"""
Episode age normalized baselines for the weekly report.

Every comparison is per episode at the same age: an episode's day 7
downloads against the median day 7 downloads of the 8 episodes published
before it. Never week over week, never calendar based. See
docs/report-v2-spec.md, Phase 1 item 6.
"""

from datetime import date, timedelta
from statistics import median

CHECKPOINT_DAYS = (1, 3, 7, 14, 30, 60, 90)
BASELINE_WINDOW = 8
MIN_PRIOR_VALUES = 4


def day_n_values(daily: dict[str, int | float], published: date, as_of: date | None) -> dict:
    """Cumulative totals at each checkpoint day since publish.

    Day 1 is the publish day itself, so day 7 is the sum of the first seven
    calendar days. A checkpoint is only filled once its last day is on or
    before `as_of` (the last complete day of data); before that it is None,
    because a partial sum would read as a real low number.
    """
    out = {}
    for n in CHECKPOINT_DAYS:
        last_day = published + timedelta(days=n - 1)
        if as_of is None or last_day > as_of:
            out[f"day_{n}"] = None
            continue
        out[f"day_{n}"] = sum(
            v for d, v in daily.items() if published <= date.fromisoformat(d) <= last_day
        )
    return out


def weighted_average(daily: dict[str, dict], published: date, days: int, as_of: date | None, field: str) -> float | None:
    """Views weighted average of a per day rate (for example average view
    percentage) over the first `days` days. Weighting by views gives the
    same number YouTube would report for the whole window."""
    last_day = published + timedelta(days=days - 1)
    if as_of is None or last_day > as_of:
        return None
    total_views = 0
    weighted = 0.0
    for d, row in daily.items():
        if published <= date.fromisoformat(d) <= last_day:
            total_views += row["views"]
            weighted += row[field] * row["views"]
    return round(weighted / total_views, 2) if total_views else None


def compute_baseline(values_in_order: list[float | None], index: int) -> tuple[float | None, int]:
    """Median of the non null values among the BASELINE_WINDOW entries
    immediately before `index`, excluding `index` itself. Returns
    (baseline, sample_size); baseline is None when fewer than
    MIN_PRIOR_VALUES of those entries have a value."""
    prior = values_in_order[max(0, index - BASELINE_WINDOW):index]
    present = [v for v in prior if v is not None]
    if len(present) < MIN_PRIOR_VALUES:
        return None, len(present)
    return round(median(present), 2), len(present)


def baseline_record(value, value_reason: str | None, baseline, sample_size: int) -> dict:
    """The {value, baseline, ratio, sample_size, reason} block stored on an
    episode. reason explains every null so a missing ratio is never silent."""
    reason = None
    ratio = None
    if value is None:
        reason = value_reason or "no_value"
    elif baseline is None:
        reason = f"fewer_than_{MIN_PRIOR_VALUES}_prior_values ({sample_size} of previous {BASELINE_WINDOW})"
    elif baseline == 0:
        reason = "baseline_is_zero"
    else:
        ratio = round(value / baseline, 2)
    return {
        "value": value,
        "baseline": baseline,
        "ratio": ratio,
        "sample_size": sample_size,
        "reason": reason,
    }


def attach_baselines(episodes: list[dict], metrics: dict) -> None:
    """Fill episode["baselines"][key] for every metric.

    `episodes` must be sorted oldest first. `metrics` maps a metric key to a
    function episode -> (value, reason_if_none).
    """
    for key, getter in metrics.items():
        pairs = [getter(ep) for ep in episodes]
        values = [v for v, _ in pairs]
        for i, ep in enumerate(episodes):
            value, reason = pairs[i]
            baseline, n = compute_baseline(values, i)
            ep.setdefault("baselines", {})[key] = baseline_record(value, reason, baseline, n)

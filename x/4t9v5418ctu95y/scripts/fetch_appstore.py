"""Append today's App Store chart positions of the main AI assistants to data/appstore_history.json.

Runs daily from .github/workflows/appstore.yml; also imported by fetch_signals.py for the
one-day snapshot in signals.json. Source: Apple's public top-free iPhone chart feed (top 100).
Apps are matched by developer name so third-party "AI chat" lookalikes stay out.
Each snapshot also records the total number of ratings (and the average) for ChatGPT, Gemini and
Claude in every storefront, from Apple's public lookup endpoint; growth in that count is a
momentum signal that chart rank (one day's downloads) does not give.
"""
import json
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
HISTORY = ROOT / "data" / "appstore_history.json"

MARKETS = {
    "GBR": "gb", "DEU": "de", "FRA": "fr", "ESP": "es", "ITA": "it", "NLD": "nl", "BEL": "be", "IRL": "ie",
    "AUT": "at", "CHE": "ch", "SWE": "se", "NOR": "no", "DNK": "dk", "FIN": "fi", "POL": "pl", "PRT": "pt",
    "CZE": "cz", "ROU": "ro", "GRC": "gr", "HUN": "hu",
}

# Developer name (as listed on the App Store) -> product label.
AI_DEVELOPERS = {
    "OpenAI": "ChatGPT", "Google": "Gemini", "Anthropic": "Claude", "Microsoft": "Copilot",
    "Meta Platforms": "Meta AI", "X Corp": "Grok", "xAI": "Grok", "DeepSeek": "DeepSeek",
    "Perplexity": "Perplexity", "Mistral": "Le Chat",
}
AI_NAME_HINTS = ("chatgpt", "gemini", "claude", "copilot", "meta ai", "grok", "deepseek", "perplexity", "le chat")

# App Store IDs, checked against the developer name on the store (OpenAI, Google, Anthropic).
RATED_APPS = {"6448311069": "ChatGPT", "6477489729": "Gemini", "6473753684": "Claude"}
LOOKUP = "https://itunes.apple.com/lookup?id={ids}&country={cc}"

FEED = "https://rss.marketingtools.apple.com/api/v2/{cc}/apps/top-free/100/apps.json"
SOURCE = "Apple App Store, top free iPhone apps (top 100)"
PAGE = "https://apps.apple.com/{cc}/charts/iphone/top-free-apps/36"


def get(url: str, tries: int = 3) -> bytes:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "country-strategy-workbench/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except (TimeoutError, OSError) as e:
            print(f"  retry {attempt + 1}: {e}")
            time.sleep(4)
    raise RuntimeError(f"failed: {url}")


def fetch_chart(cc: str) -> tuple[list[dict], str]:
    """Return ([{rank, app}], feed date YYYY-MM-DD) for one storefront."""
    feed = json.loads(get(FEED.format(cc=cc)))["feed"]
    apps = []
    for i, a in enumerate(feed["results"]):
        dev = a.get("artistName", "")
        label = next((v for k, v in AI_DEVELOPERS.items() if dev.startswith(k)), None)
        # Keep each assistant's best rank only (Google ships more than one Gemini-named app).
        if label and any(h in a["name"].lower() for h in AI_NAME_HINTS) and label not in {x["app"] for x in apps}:
            apps.append({"rank": i + 1, "app": label})
    when = datetime.strptime(feed["updated"], "%a, %d %b %Y %H:%M:%S %z").astimezone(timezone.utc).strftime("%Y-%m-%d")
    return apps, when


def fetch_ratings(cc: str) -> dict[str, dict]:
    """Return {app: {count, avg}} for the tracked apps in one storefront."""
    rows = json.loads(get(LOOKUP.format(ids=",".join(RATED_APPS), cc=cc)))["results"]
    out = {}
    for r in rows:
        label = RATED_APPS.get(str(r.get("trackId")))
        if label and r.get("userRatingCount") is not None:
            out[label] = {"count": r["userRatingCount"], "avg": round(r.get("averageUserRating", 0), 3)}
    return out


def main() -> int:
    history = json.loads(HISTORY.read_text(encoding="utf-8")) if HISTORY.exists() else {
        "source": SOURCE, "url": PAGE.format(cc="gb"), "snapshots": []}
    history["ratings_source"] = "Apple App Store lookup, total ratings per storefront (ChatGPT, Gemini, Claude)"
    history["ratings_url"] = "https://performance-partners.apple.com/search-api"
    markets, ratings, dates = {}, {}, set()
    for iso3, cc in MARKETS.items():
        apps, when = fetch_chart(cc)
        markets[iso3] = apps
        ratings[iso3] = fetch_ratings(cc)
        dates.add(when)
        print(iso3, apps, ratings[iso3])
        time.sleep(0.3)
    date = max(dates)
    # One snapshot per feed date; a re-run on the same day replaces it.
    snaps = [s for s in history["snapshots"] if s["date"] != date]
    snaps.append({"date": date, "markets": markets, "ratings": ratings})
    history["snapshots"] = sorted(snaps, key=lambda s: s["date"])
    HISTORY.write_text(json.dumps(history, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"{len(history['snapshots'])} snapshots, latest {date}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

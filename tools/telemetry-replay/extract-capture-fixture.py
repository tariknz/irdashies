"""Extract a small, committable replay fixture from a telemetry capture.

Reads a capture directory (session.yaml + telemetry-*.jsonl.zst), takes a time
window from one session, downsamples it, keeps only the variables the overlay
processors read, and anonymises the roster so the fixture carries no real
customer IDs or driver names.

Usage:
  extract_fixture.py <capture-dir> --session N --from S --to S
                     [--hz N] [--name NAME] [--no-anon]

Writes JSON to stdout.
"""

import argparse
import json
import subprocess
import sys

# Everything the processors and stores read. Kept explicit so a fixture stays
# small and it is obvious what a scenario exercises.
FRAME_VARS = [
    "SessionTime",
    "SessionNum",
    "SessionState",
    "SessionFlags",
    "SessionTimeRemain",
    "SessionLapsRemain",
    "CamCarIdx",
    "IsReplayPlaying",
    "CarIdxPosition",
    "CarIdxClassPosition",
    "CarIdxClass",
    "CarIdxLap",
    "CarIdxLapCompleted",
    "CarIdxLapDistPct",
    "CarIdxTrackSurface",
    "CarIdxOnPitRoad",
    "CarIdxF2Time",
    "CarIdxEstTime",
    "CarIdxBestLapTime",
    "CarIdxLastLapTime",
    "CarIdxSessionFlags",
    "CarIdxTireCompound",
]

SOURCE_RATE_HZ = 30

# Fixtures are committed, so keep them small: full float precision costs more
# bytes than it buys accuracy for a processor test.
ROUNDING = {
    "SessionTime": 3,
    "SessionTimeRemain": 2,
    "CarIdxLapDistPct": 5,
    "CarIdxF2Time": 3,
    "CarIdxEstTime": 3,
    "CarIdxBestLapTime": 3,
    "CarIdxLastLapTime": 3,
}


def shrink(frame, car_count):
    """Rounds floats and trims per-car arrays to the size of the actual field."""
    out = {}
    for key, value in frame.items():
        if isinstance(value, list):
            value = value[:car_count]
            digits = ROUNDING.get(key)
            if digits is not None:
                value = [
                    round(v, digits) if isinstance(v, float) else v for v in value
                ]
        elif isinstance(value, float):
            digits = ROUNDING.get(key)
            if digits is not None:
                value = round(value, digits)
        out[key] = value
    return out


def read_frames(capture, session_num, t_from, t_to, hz):
    """Streams matching frames through zstd + jq, downsampled."""
    keep = ",".join(f'"{v}": .{v}' for v in FRAME_VARS)
    jq = (
        f"select(.SessionNum == {session_num}) | "
        f"select(.SessionTime >= {t_from} and .SessionTime <= {t_to}) | "
        "{" + keep + "}"
    )
    cmd = (
        f"cd {capture} && zstd -dcq telemetry-*.jsonl.zst | jq -c '{jq}' 2>/dev/null"
    )
    proc = subprocess.Popen(
        ["bash", "-lc", cmd], stdout=subprocess.PIPE, text=True
    )
    step = max(1, round(SOURCE_RATE_HZ / hz))
    frames = []
    for index, line in enumerate(proc.stdout):
        if index % step:
            continue
        line = line.strip()
        if not line:
            continue
        try:
            frames.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    proc.stdout.close()
    proc.wait()
    return frames


def parse_session_yaml(path):
    """Minimal YAML reader for the roster fields a fixture needs.

    The capture's session.yaml is iRacing's own dump. Rather than pull in a YAML
    dependency, read the handful of scalar fields under DriverInfo/Drivers.
    """
    drivers = []
    current = None
    weekend = {}
    sessions = []
    section = None
    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        for raw in handle:
            line = raw.rstrip("\n")
            stripped = line.strip()
            if line.startswith("WeekendInfo:"):
                section = "weekend"
                continue
            if line.startswith("DriverInfo:"):
                section = "drivers"
                continue
            if line.startswith("SessionInfo:"):
                section = "sessions"
                continue
            if line and not line.startswith(" "):
                section = None

            if section == "weekend" and ":" in stripped:
                key, _, value = stripped.partition(":")
                if key in ("TrackDisplayName", "TrackID", "TrackLength",
                           "NumCarClasses", "TeamRacing", "EventType"):
                    weekend[key] = value.strip()

            if section == "sessions" and stripped.startswith("- SessionNum:"):
                sessions.append({"SessionNum": int(stripped.split(":")[1])})
            if section == "sessions" and stripped.startswith("SessionType:") and sessions:
                sessions[-1]["SessionType"] = stripped.split(":", 1)[1].strip()

            if section == "drivers":
                if stripped.startswith("- CarIdx:"):
                    current = {"CarIdx": int(stripped.split(":")[1])}
                    drivers.append(current)
                elif current is not None and ":" in stripped:
                    key, _, value = stripped.partition(":")
                    key = key.strip()
                    if key in (
                        "UserName", "UserID", "CarNumber", "CarClassID",
                        "CarClassShortName", "CarClassColor", "CarClassRelSpeed",
                        "CarClassEstLapTime", "CarID", "TeamName", "IRating",
                        "LicString", "CarIsPaceCar", "IsSpectator", "FlairID",
                    ):
                        current[key] = value.strip()
    return weekend, drivers, sessions


SURNAMES = [
    "Adler", "Baumann", "Costa", "Duval", "Eriksen", "Faber", "Gallo", "Haas",
    "Ibarra", "Jensen", "Keller", "Lindqvist", "Moreau", "Novak", "Oliveira",
    "Petrov", "Quinn", "Rossi", "Sandberg", "Toledo", "Ueda", "Vogel", "Wexler",
    "Ximenes", "Yamada", "Zunino",
]


def anonymise(drivers):
    """Replaces real identities while keeping the field's shape intact."""
    for index, driver in enumerate(drivers):
        driver["UserID"] = str(900000 + index)
        first = chr(ord("A") + index % 26)
        driver["UserName"] = f"{first}. {SURNAMES[index % len(SURNAMES)]}{index // 26 or ''}"
        if driver.get("TeamName"):
            driver["TeamName"] = f"Team {index + 1}"
    return drivers


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("capture")
    parser.add_argument("--session", type=int, required=True)
    parser.add_argument("--from", dest="t_from", type=float, required=True)
    parser.add_argument("--to", dest="t_to", type=float, required=True)
    parser.add_argument("--hz", type=float, default=10)
    parser.add_argument("--name", default="")
    parser.add_argument("--no-anon", action="store_true")
    args = parser.parse_args()

    weekend, drivers, sessions = parse_session_yaml(f"{args.capture}/session.yaml")
    if not args.no_anon:
        drivers = anonymise(drivers)

    frames = read_frames(
        args.capture, args.session, args.t_from, args.t_to, args.hz
    )
    car_count = max((int(d["CarIdx"]) for d in drivers), default=63) + 1
    frames = [shrink(f, car_count) for f in frames]
    if not frames:
        print("no frames matched", file=sys.stderr)
        sys.exit(1)

    fixture = {
        "meta": {
            "name": args.name or args.capture.rstrip("/").split("/")[-1],
            "sessionNum": args.session,
            "from": frames[0]["SessionTime"],
            "to": frames[-1]["SessionTime"],
            "hz": args.hz,
            "frames": len(frames),
            "anonymised": not args.no_anon,
        },
        "weekend": weekend,
        "sessions": sessions,
        "drivers": drivers,
        "frames": frames,
    }
    json.dump(fixture, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()

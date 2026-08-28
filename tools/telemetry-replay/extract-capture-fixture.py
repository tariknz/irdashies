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
import glob
import json
import os
import subprocess
import sys
import tempfile

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

# Named subsets, so a scenario fixture only carries what it exercises. A pit
# fixture has no business shipping lap times for 60 cars.
VAR_SETS = {
    "pit": [
        "SessionTime", "SessionNum", "SessionState",
        "CarIdxOnPitRoad", "CarIdxTrackSurface", "CarIdxLap",
        "CarIdxLapDistPct",
    ],
    "standings": [
        "SessionTime", "SessionNum", "SessionState", "SessionFlags", "CamCarIdx",
        "CarIdxPosition", "CarIdxClassPosition", "CarIdxClass", "CarIdxLap",
        "CarIdxLapCompleted", "CarIdxLapDistPct", "CarIdxTrackSurface",
        "CarIdxOnPitRoad", "CarIdxF2Time", "CarIdxEstTime", "CarIdxBestLapTime",
        "CarIdxLastLapTime", "CarIdxSessionFlags", "CarIdxTireCompound",
    ],
}

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


def read_frames(capture, session_num, t_from, t_to, hz, variables, shards):
    """Streams matching frames through zstd + jq, downsampled."""
    keep = ",".join(f'"{v}": .{v}' for v in variables)
    jq = (
        f"select(.SessionNum == {session_num}) | "
        f"select(.SessionTime >= {t_from} and .SessionTime <= {t_to}) | "
        "{" + keep + "}"
    )
    # Resolve the shard glob here rather than in a shell string. A capture path
    # containing a space would otherwise split into several arguments to cd, and
    # the extraction would silently yield no frames.
    paths = sorted(glob.glob(os.path.join(capture, shards)))
    if not paths:
        print(f"no shards matched {shards} in {capture}", file=sys.stderr)
        sys.exit(1)

    unzstd = subprocess.Popen(
        ["zstd", "-dcq", *paths], stdout=subprocess.PIPE
    )
    # jq diagnostics go to a temp file rather than a pipe: we drain stdout to
    # completion first, and a pipe that filled up in the meantime would deadlock.
    with tempfile.TemporaryFile(mode="w+", encoding="utf-8") as jq_errors:
        proc = subprocess.Popen(
            ["jq", "-c", jq],
            stdin=unzstd.stdout,
            stdout=subprocess.PIPE,
            stderr=jq_errors,
            text=True,
        )
        unzstd.stdout.close()
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
        unzstd.wait()
        jq_errors.seek(0)
        message = jq_errors.read().strip()

    # A truncated shard or a mid-stream jq failure still emits frames before it
    # dies. Returning those would write a fixture that is quietly short instead
    # of obviously broken, and a short fixture reads as a real racing scenario.
    if unzstd.returncode:
        print(
            f"zstd failed ({unzstd.returncode}) reading shards in {capture}",
            file=sys.stderr,
        )
        sys.exit(1)
    if proc.returncode:
        print(f"jq failed ({proc.returncode}): {message}", file=sys.stderr)
        sys.exit(1)
    return frames


def parse_session_yaml(path):
    """Reads the roster, session list and results the overlay actually uses."""
    import yaml

    with open(path, "r", encoding="utf-8", errors="replace") as handle:
        doc = yaml.safe_load(handle)

    weekend_src = doc.get("WeekendInfo") or {}
    weekend = {
        key: weekend_src.get(key)
        for key in (
            "TrackDisplayName", "TrackID", "TrackLength", "NumCarClasses",
            "TeamRacing", "EventType",
        )
        if weekend_src.get(key) is not None
    }

    driver_src = doc.get("DriverInfo") or {}
    driver_info = {
        "DriverCarIdx": driver_src.get("DriverCarIdx"),
        "PaceCarIdx": driver_src.get("PaceCarIdx"),
    }
    driver_keys = (
        "CarIdx", "UserName", "UserID", "CarNumber", "CarClassID",
        "CarClassShortName", "CarClassColor", "CarClassRelSpeed",
        "CarClassEstLapTime", "CarID", "TeamName", "IRating", "LicString",
        "CarIsPaceCar", "IsSpectator", "FlairID",
    )
    drivers = [
        {k: d.get(k) for k in driver_keys if d.get(k) is not None}
        for d in (driver_src.get("Drivers") or [])
    ]

    # Gap, interval, position change and iRating all derive from these. Without
    # them a fixture can only exercise grouping and ordering.
    result_keys = (
        "Position", "ClassPosition", "CarIdx", "Lap", "Time", "FastestLap",
        "FastestTime", "LastTime", "LapsComplete", "LapsLed", "ReasonOutId",
    )
    sessions = []
    for entry in (doc.get("SessionInfo") or {}).get("Sessions") or []:
        sessions.append({
            "SessionNum": entry.get("SessionNum"),
            "SessionType": entry.get("SessionType"),
            "ResultsPositions": [
                {k: r.get(k) for k in result_keys if r.get(k) is not None}
                for r in (entry.get("ResultsPositions") or [])
            ],
            "ResultsFastestLap": [
                {k: r.get(k) for k in ("CarIdx", "FastestLap", "FastestTime")
                 if r.get(k) is not None}
                for r in (entry.get("ResultsFastestLap") or [])
            ],
        })

    qualifying = [
        {k: r.get(k) for k in result_keys if r.get(k) is not None}
        for r in ((doc.get("QualifyResultsInfo") or {}).get("Results") or [])
    ]

    return weekend, drivers, sessions, driver_info, qualifying


DRIVER_NAMES = [
    "Ayrton Senna", "Juan Fangio", "Alain Prost", "Michael Schumacher",
    "Jim Clark", "Jackie Stewart", "Niki Lauda", "James Hunt",
    "Gilles Villeneuve", "Stirling Moss", "Alberto Ascari", "Graham Hill",
    "Mario Andretti", "AJ Foyt", "Al Unser", "Richard Petty",
    "Dale Earnhardt", "Jeff Gordon", "Jimmie Johnson", "Sebastien Loeb",
    "Sebastien Ogier", "Tommi Makinen", "Walter Rohrl", "Juha Kankkunen",
    "Jacky Ickx", "Derek Bell", "Tom Kristensen", "Allan McNish",
    "Michele Alboreto", "Ronnie Peterson", "Jochen Rindt", "Jack Brabham",
    "John Surtees", "Mike Hawthorn", "Dan Gurney", "Denny Hulme",
    "Clay Regazzoni", "Carlos Reutemann", "Jacques Laffite", "Rene Arnoux",
    "Riccardo Patrese", "Nigel Mansell", "Nelson Piquet", "Gerhard Berger",
    "Jean Alesi", "Heinz Frentzen", "Rubens Barrichello", "Juan Montoya",
    "Kimi Raikkonen", "Fernando Alonso", "Jenson Button", "Mark Webber",
    "Felipe Massa", "Keke Rosberg", "Sebastian Vettel", "Lewis Hamilton",
    "Daniel Ricciardo", "Max Verstappen", "Charles Leclerc", "Lando Norris",
    "Janet Guthrie", "Shirley Muldowney", "Danica Patrick", "Simona Silvestro",
    "Tatiana Calderon", "Jamie Chadwick", "Michele Mouton", "Desire Wilson",
    "Lella Lombardi", "Sara Christian",
]


def anonymise(drivers):
    """Replaces real identities while keeping the field's shape intact.

    Famous drivers rather than invented surnames, so nobody mistakes a fixture
    for a real entry list, and so a failing test names someone memorable.
    """
    for index, driver in enumerate(drivers):
        driver["UserID"] = 900000 + index
        name = DRIVER_NAMES[index % len(DRIVER_NAMES)]
        suffix = index // len(DRIVER_NAMES)
        driver["UserName"] = f"{name} {suffix + 1}" if suffix else name
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
    parser.add_argument(
        "--shards", default="telemetry-*.jsonl.zst",
        help="glob of shards to read; narrow it when the window is known",
    )
    parser.add_argument(
        "--vars", choices=sorted(VAR_SETS), default=None,
        help="named variable subset; defaults to everything",
    )
    args = parser.parse_args()

    weekend, drivers, sessions, driver_info, qualifying = parse_session_yaml(
        f"{args.capture}/session.yaml"
    )
    if not args.no_anon:
        drivers = anonymise(drivers)

    variables = VAR_SETS[args.vars] if args.vars else FRAME_VARS
    frames = read_frames(
        args.capture, args.session, args.t_from, args.t_to, args.hz, variables,
        args.shards,
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
            "vars": args.vars or "all",
        },
        "weekend": weekend,
        "driverInfo": driver_info,
        "sessions": sessions,
        "qualifying": qualifying,
        "drivers": drivers,
        "frames": frames,
    }
    json.dump(fixture, sys.stdout, separators=(",", ":"))


if __name__ == "__main__":
    main()

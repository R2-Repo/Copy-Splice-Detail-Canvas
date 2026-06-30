"""SDC dev sidecar CLI — orchestrates headless TypeScript eval."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sdc.batch import print_batch_json, run_batch
from sdc.experimental.search import compare_search, experimental_search
from sdc.fixtures import preset_paths
from sdc.node_bridge import csv_path_payload, eval_command, repo_root
from sdc.report import run_summary_from_search, write_json_report


def _cmd_parse(args: argparse.Namespace) -> int:
    payload = csv_path_payload(args.csv)
    if args.include_graph:
        payload["includeGraph"] = True
    out = eval_command("parse", payload, timeout_s=args.timeout)
    print(json.dumps(out, indent=2))
    return 0


def _cmd_search(args: argparse.Namespace) -> int:
    payload = csv_path_payload(args.csv)
    config: dict = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    if args.time_budget_ms is not None:
        config["timeBudgetMs"] = args.time_budget_ms
    if args.seed is not None:
        config["seed"] = args.seed
    if config:
        payload["config"] = config
    response = eval_command("search", payload, timeout_s=args.timeout)
    if args.out_dir:
        out_dir = Path(args.out_dir)
        summary = run_summary_from_search(Path(args.csv), response)
        stem = Path(args.csv).stem
        write_json_report(out_dir / f"{stem}-run-summary.json", summary)
        write_json_report(out_dir / f"{stem}-search-response.json", response)
    print(json.dumps(response, indent=2))
    return 0


def _cmd_batch(args: argparse.Namespace) -> int:
    if args.preset:
        paths = preset_paths(args.preset)
    elif args.csv:
        paths = [Path(p) for p in args.csv]
    else:
        print("Provide CSV paths or --preset", file=sys.stderr)
        return 1

    config = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    if args.time_budget_ms is not None:
        config["timeBudgetMs"] = args.time_budget_ms

    out_dir = Path(args.out_dir) if args.out_dir else None
    results = run_batch(
        paths,
        workers=args.workers,
        config=config or None,
        timeout_s=args.timeout,
        out_dir=out_dir,
    )
    if not out_dir:
        print_batch_json(results)
    else:
        print(json.dumps({"outDir": str(out_dir.resolve()), "count": len(results)}, indent=2))
    return 0 if all(r.get("ok") for r in results) else 1


def _cmd_experiment_search(args: argparse.Namespace) -> int:
    config = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    result = experimental_search(
        args.csv,
        iterations=args.iterations,
        validate_top=args.validate_top,
        seed=args.seed,
        use_proxy=not args.no_proxy,
        search_config=config or None,
    )
    if args.out:
        write_json_report(Path(args.out), result)
    print(json.dumps(result, indent=2))
    return 0


def _cmd_experiment_compare(args: argparse.Namespace) -> int:
    config = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    result = compare_search(
        args.csv,
        iterations=args.iterations,
        validate_top=args.validate_top,
        seed=args.seed,
        search_config=config or None,
    )
    out_path = args.out
    if not out_path:
        golden_dir = repo_root() / "tools/sdc-sidecar/fixtures/golden"
        golden_dir.mkdir(parents=True, exist_ok=True)
        out_path = str(golden_dir / f"{Path(args.csv).stem}-compare.json")
    write_json_report(Path(out_path), result)
    print(json.dumps(result, indent=2))
    return 0


def _cmd_export_top(args: argparse.Namespace) -> int:
    payload = {**csv_path_payload(args.csv), "outDir": args.out_dir, "top": args.top}
    config: dict = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    if args.time_budget_ms is not None:
        config["timeBudgetMs"] = args.time_budget_ms
    if config:
        payload["config"] = config
    response = eval_command("export-top", payload, timeout_s=args.timeout)
    print(json.dumps(response, indent=2))
    return 0 if response.get("exports") else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sdc", description="SDC dev sidecar (local only)")
    parser.add_argument(
        "--timeout",
        type=float,
        default=None,
        help="Subprocess timeout seconds for TS eval calls",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_parse = sub.add_parser("parse", help="Parse CSV → summary")
    p_parse.add_argument("csv", help="Path to Bentley CSV")
    p_parse.add_argument("--include-graph", action="store_true")
    p_parse.set_defaults(func=_cmd_parse)

    p_search = sub.add_parser("search", help="Run layoutSearch headlessly")
    p_search.add_argument("csv")
    p_search.add_argument("--max-rounds", type=int)
    p_search.add_argument("--time-budget-ms", type=int)
    p_search.add_argument("--seed", type=int)
    p_search.add_argument("--out-dir", help="Write import-diagnostics-style reports")
    p_search.set_defaults(func=_cmd_search)

    p_batch = sub.add_parser("batch", help="Run search on multiple CSVs")
    p_batch.add_argument("csv", nargs="*", help="CSV paths")
    p_batch.add_argument("--preset", choices=["qa", "left", "contract"])
    p_batch.add_argument("--workers", type=int, default=1)
    p_batch.add_argument("--max-rounds", type=int)
    p_batch.add_argument("--time-budget-ms", type=int)
    p_batch.add_argument("--out-dir", help="Directory for HTML + JSON reports")
    p_batch.set_defaults(func=_cmd_batch)

    p_export = sub.add_parser("export-top", help="Search + write top N .sdc.json for web import")
    p_export.add_argument("csv")
    p_export.add_argument("--out-dir", required=True)
    p_export.add_argument("--top", type=int, default=5)
    p_export.add_argument("--max-rounds", type=int)
    p_export.add_argument("--time-budget-ms", type=int)
    p_export.set_defaults(func=_cmd_export_top)

    p_exp = sub.add_parser("experiment", help="Experimental Python search (TS validates)")
    exp_sub = p_exp.add_subparsers(dest="experiment_cmd", required=True)

    p_exp_search = exp_sub.add_parser("search", help="Random/mutate search + validate top-K")
    p_exp_search.add_argument("csv")
    p_exp_search.add_argument("--iterations", type=int, default=64)
    p_exp_search.add_argument("--validate-top", type=int, default=5)
    p_exp_search.add_argument("--seed", type=int, default=42)
    p_exp_search.add_argument("--max-rounds", type=int, help="Incumbent TS search rounds")
    p_exp_search.add_argument("--no-proxy", action="store_true")
    p_exp_search.add_argument("--out")
    p_exp_search.set_defaults(func=_cmd_experiment_search)

    p_exp_cmp = exp_sub.add_parser("compare", help="Experimental vs incumbent layoutSearch")
    p_exp_cmp.add_argument("csv")
    p_exp_cmp.add_argument("--iterations", type=int, default=64)
    p_exp_cmp.add_argument("--validate-top", type=int, default=5)
    p_exp_cmp.add_argument("--seed", type=int, default=42)
    p_exp_cmp.add_argument("--max-rounds", type=int)
    p_exp_cmp.add_argument("--out", help="Golden JSON path (default: fixtures/golden/)")
    p_exp_cmp.set_defaults(func=_cmd_experiment_compare)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

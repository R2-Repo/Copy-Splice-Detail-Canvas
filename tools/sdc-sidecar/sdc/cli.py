"""SDC dev sidecar CLI — orchestrates headless TypeScript eval."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sdc.batch import print_batch_json, run_batch
from sdc.cache.score_cache import ScoreCache
from sdc.daemon.pool import get_pool, shutdown_pool
from sdc.deep_search import calibrate_t0_mirror, deep_search
from sdc.fixtures import preset_paths
from sdc.node_bridge import csv_path_payload, eval_command, repo_root
from sdc.report import run_summary_from_search, write_json_report
from sdc.server.http_api import serve
from sdc.sweep import run_sweep


def _cmd_parse(args: argparse.Namespace) -> int:
    payload = csv_path_payload(args.csv)
    if args.include_graph:
        payload["includeGraph"] = True
    out = eval_command("parse", payload, timeout_s=args.timeout)
    print(json.dumps(out, indent=2))
    return 0


def _cmd_import_rules(args: argparse.Namespace) -> int:
    out = eval_command("import-rules", csv_path_payload(args.csv), timeout_s=args.timeout)
    print(json.dumps(out, indent=2))
    return 0


def _cmd_topology(args: argparse.Namespace) -> int:
    out = eval_command("analyze-topology", csv_path_payload(args.csv), timeout_s=args.timeout)
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


def _cmd_export_top(args: argparse.Namespace) -> int:
    payload = {**csv_path_payload(args.csv), "outDir": args.out_dir, "top": args.top}
    config: dict = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    if args.time_budget_ms is not None:
        config["timeBudgetMs"] = args.time_budget_ms
    if config:
        payload["config"] = config
    response = eval_command("export-top", payload, timeout_s=args.timeout, use_daemon=False)
    print(json.dumps(response, indent=2))
    return 0 if response.get("exports") else 1


def _cmd_evaluate_batch(args: argparse.Namespace) -> int:
    candidates = json.loads(Path(args.candidates_file).read_text(encoding="utf-8"))
    payload = {
        **csv_path_payload(args.csv),
        "candidates": candidates,
        "maxTier": args.max_tier,
    }
    response = eval_command("evaluate-batch", payload, timeout_s=args.timeout)
    print(json.dumps(response, indent=2))
    return 0


def _search_config(args: argparse.Namespace) -> dict:
    config: dict = {}
    if args.max_rounds is not None:
        config["maxRounds"] = args.max_rounds
    return config


def _deep_kwargs(args: argparse.Namespace) -> dict:
    return {
        "strategy": args.strategy,
        "search_config": _search_config(args),
        "t0_max": args.t0_max,
        "t1_max": args.t1_max,
        "t2_max": args.t2_max,
        "population_size": args.population_size,
        "max_generations": args.max_generations,
        "time_budget_ms": args.time_budget_ms,
        "seed": args.seed,
        "use_cache": not args.no_cache,
        "use_ray": not args.no_ray,
        "checkpoint_dir": args.checkpoint_dir,
        "resume": args.resume,
    }


def _cmd_deep_search(args: argparse.Namespace) -> int:
    result = deep_search(args.csv, **_deep_kwargs(args))
    if args.out:
        write_json_report(Path(args.out), result)
    print(json.dumps(result, indent=2))
    return 0


def _cmd_compare(args: argparse.Namespace) -> int:
    result = deep_search(args.csv, **_deep_kwargs(args))
    out_path = args.out
    if not out_path:
        golden_dir = repo_root() / "tools/sdc-sidecar/fixtures/golden"
        golden_dir.mkdir(parents=True, exist_ok=True)
        out_path = str(golden_dir / f"{Path(args.csv).stem}-compare.json")
    write_json_report(Path(out_path), result)
    print(json.dumps(result, indent=2))
    return 0


def _cmd_experiment_search(args: argparse.Namespace) -> int:
    import warnings

    warnings.warn(
        "experiment search is deprecated — use: sdc deep-search",
        DeprecationWarning,
        stacklevel=1,
    )
    return _cmd_deep_search(args)


def _cmd_experiment_compare(args: argparse.Namespace) -> int:
    import warnings

    warnings.warn(
        "experiment compare is deprecated — use: sdc compare",
        DeprecationWarning,
        stacklevel=1,
    )
    return _cmd_compare(args)


def _cmd_daemon(args: argparse.Namespace) -> int:
    if args.daemon_cmd == "start":
        pool = get_pool(workers=args.workers, auto_start=True)
        print(json.dumps({"ok": True, **pool.status()}, indent=2))
        return 0
    if args.daemon_cmd == "status":
        pool = get_pool(auto_start=False)
        if pool is None:
            print(json.dumps({"ok": True, "workers": 0, "alive": 0}, indent=2))
            return 0
        print(json.dumps({"ok": True, **pool.status()}, indent=2))
        return 0
    if args.daemon_cmd == "stop":
        shutdown_pool()
        print(json.dumps({"ok": True, "stopped": True}, indent=2))
        return 0
    return 1


def _cmd_cache(args: argparse.Namespace) -> int:
    cache = ScoreCache()
    if args.cache_cmd == "stats":
        print(json.dumps(cache.stats(), indent=2))
        return 0
    if args.cache_cmd == "clear":
        import hashlib

        csv_hash = None
        if args.csv:
            csv_hash = hashlib.sha256(str(args.csv).encode()).hexdigest()[:16]
        removed = cache.clear(csv_hash)
        print(json.dumps({"ok": True, "removed": removed}, indent=2))
        return 0
    return 1


def _cmd_sweep(args: argparse.Namespace) -> int:
    if args.preset:
        paths = preset_paths(args.preset)
    else:
        paths = [Path(p) for p in args.csv]
    out_dir = Path(args.out_dir) if args.out_dir else Path(".sdc-cache/sweep")
    run_sweep(
        paths,
        out_dir=out_dir,
        time_budget_ms=args.time_budget_ms,
        seed=args.seed,
        max_configs=args.max_configs,
        use_ray=not args.no_ray,
    )
    print(json.dumps({"ok": True, "outDir": str(out_dir.resolve())}, indent=2))
    return 0


def _cmd_serve(args: argparse.Namespace) -> int:
    serve(port=args.port)
    return 0


def _cmd_calibrate(args: argparse.Namespace) -> int:
    result = calibrate_t0_mirror(args.csv, sample_size=args.sample_size, seed=args.seed)
    if args.out:
        write_json_report(Path(args.out), result)
    print(json.dumps(result, indent=2))
    return 0 if result.get("ok") else 1


def _add_deep_flags(p: argparse.ArgumentParser) -> None:
    p.add_argument("--strategy", default="evolutionary", choices=["evolutionary", "python_beam", "hybrid", "incumbent"])
    p.add_argument("--t0-max", type=int, default=300)
    p.add_argument("--t1-max", type=int, default=40)
    p.add_argument("--t2-max", type=int, default=8)
    p.add_argument("--population-size", type=int, default=128)
    p.add_argument("--max-generations", type=int, default=20)
    p.add_argument("--time-budget-ms", type=int)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--max-rounds", type=int, help="Incumbent TS search rounds")
    p.add_argument("--checkpoint-dir")
    p.add_argument("--resume", action="store_true")
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--no-ray", action="store_true")
    p.add_argument("--out")


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
    p_parse.add_argument("csv")
    p_parse.add_argument("--include-graph", action="store_true")
    p_parse.set_defaults(func=_cmd_parse)

    p_import_rules = sub.add_parser(
        "import-rules",
        help="Run DATA/ORDER import rules (same pre-check as PWA CSV import)",
    )
    p_import_rules.add_argument("csv")
    p_import_rules.set_defaults(func=_cmd_import_rules)

    p_topo = sub.add_parser("topology", help="Analyze topology constraints")
    p_topo.add_argument("csv")
    p_topo.set_defaults(func=_cmd_topology)

    p_search = sub.add_parser("search", help="Run layoutSearch headlessly")
    p_search.add_argument("csv")
    p_search.add_argument("--max-rounds", type=int)
    p_search.add_argument("--time-budget-ms", type=int)
    p_search.add_argument("--seed", type=int)
    p_search.add_argument("--out-dir")
    p_search.set_defaults(func=_cmd_search)

    p_batch = sub.add_parser("batch", help="Run search on multiple CSVs")
    p_batch.add_argument("csv", nargs="*")
    p_batch.add_argument("--preset", choices=["qa", "left", "contract"])
    p_batch.add_argument("--workers", type=int, default=1)
    p_batch.add_argument("--max-rounds", type=int)
    p_batch.add_argument("--time-budget-ms", type=int)
    p_batch.add_argument("--out-dir")
    p_batch.set_defaults(func=_cmd_batch)

    p_export = sub.add_parser("export-top", help="Search + write top N .sdc.json")
    p_export.add_argument("csv")
    p_export.add_argument("--out-dir", required=True)
    p_export.add_argument("--top", type=int, default=5)
    p_export.add_argument("--max-rounds", type=int)
    p_export.add_argument("--time-budget-ms", type=int)
    p_export.set_defaults(func=_cmd_export_top)

    p_ebatch = sub.add_parser("evaluate-batch", help="TS evaluate-batch on candidate file")
    p_ebatch.add_argument("csv")
    p_ebatch.add_argument("candidates_file")
    p_ebatch.add_argument("--max-tier", default="T0", choices=["T0", "T1", "T2"])
    p_ebatch.set_defaults(func=_cmd_evaluate_batch)

    p_deep = sub.add_parser("deep-search", help="Python-orchestrated tiered search")
    p_deep.add_argument("csv")
    _add_deep_flags(p_deep)
    p_deep.set_defaults(func=_cmd_deep_search)

    p_cmp = sub.add_parser("compare", help="Deep search vs TS incumbent (golden JSON)")
    p_cmp.add_argument("csv")
    _add_deep_flags(p_cmp)
    p_cmp.set_defaults(func=_cmd_compare)

    p_cal = sub.add_parser("calibrate-t0", help="T0 mirror calibration vs TS")
    p_cal.add_argument("csv")
    p_cal.add_argument("--sample-size", type=int, default=64)
    p_cal.add_argument("--seed", type=int, default=42)
    p_cal.add_argument("--out")
    p_cal.set_defaults(func=_cmd_calibrate)

    p_daemon = sub.add_parser("daemon", help="TS eval daemon pool")
    p_daemon.add_argument("daemon_cmd", choices=["start", "stop", "status"])
    p_daemon.add_argument("--workers", type=int)
    p_daemon.set_defaults(func=_cmd_daemon)

    p_cache = sub.add_parser("cache", help="Score cache")
    p_cache.add_argument("cache_cmd", choices=["stats", "clear"])
    p_cache.add_argument("--csv")
    p_cache.set_defaults(func=_cmd_cache)

    p_sweep = sub.add_parser("sweep", help="Hyperparam sweep")
    p_sweep.add_argument("csv", nargs="*")
    p_sweep.add_argument("--preset", choices=["qa", "left", "contract"])
    p_sweep.add_argument("--out-dir")
    p_sweep.add_argument("--time-budget-ms", type=int, default=30_000)
    p_sweep.add_argument("--seed", type=int, default=42)
    p_sweep.add_argument("--max-configs", type=int, default=4)
    p_sweep.add_argument("--no-ray", action="store_true")
    p_sweep.set_defaults(func=_cmd_sweep)

    p_serve = sub.add_parser("serve", help="HTTP API for PWA deep-search stub")
    p_serve.add_argument("--port", type=int, default=18780)
    p_serve.set_defaults(func=_cmd_serve)

    p_exp = sub.add_parser("experiment", help="Deprecated — use deep-search / compare")
    exp_sub = p_exp.add_subparsers(dest="experiment_cmd", required=True)
    p_exp_search = exp_sub.add_parser("search")
    p_exp_search.add_argument("csv")
    _add_deep_flags(p_exp_search)
    p_exp_search.add_argument("--iterations", type=int, default=64)
    p_exp_search.add_argument("--validate-top", type=int, default=5)
    p_exp_search.add_argument("--no-proxy", action="store_true")
    p_exp_search.set_defaults(func=_cmd_experiment_search)
    p_exp_cmp = exp_sub.add_parser("compare")
    p_exp_cmp.add_argument("csv")
    _add_deep_flags(p_exp_cmp)
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
    finally:
        if args.command not in ("serve", "daemon"):
            pass


if __name__ == "__main__":
    raise SystemExit(main())

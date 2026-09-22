#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""워라벨 케이스셋을 solar-mini4-jev System One API로 돌리고 gold와 채점한다.

  # 호스팅 엔드포인트(BYOK)
  UPSTAGE_API_KEY=... python3 run_worklife.py

  # 로컬 engine.py 직접 호출
  UPSTAGE_API_KEY=... python3 run_worklife.py --engine /path/to/solar-mini4-jev

  # 이미 받아둔 결과만 채점
  python3 run_worklife.py --score-only results_worklife.jsonl

채점 기준은 repo 벤치와 동일: noul 절대오차 ≤0.25, sign@0.5, choice 완전일치, score ≤1.0.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = "https://solar-mini4-jev.vercel.app/v1/systemone"
NOUL_TOL, SCORE_TOL, SIGN_AT = 0.25, 1.0, 0.5


def load() -> tuple[list[dict], dict[str, dict]]:
    cases = json.loads((HERE / "cases_worklife.json").read_text(encoding="utf-8"))
    gold = json.loads((HERE / "gold_worklife.json").read_text(encoding="utf-8"))
    return cases, gold


def call_http(case: dict, key: str) -> dict:
    import urllib.request

    body = json.dumps(
        {"model": "solar-mini4-jev", "state": case["state"], "questions": case["questions"]}
    ).encode("utf-8")
    req = urllib.request.Request(
        API, data=body, headers={"Content-Type": "application/json", "X-Upstage-Api-Key": key}
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def call_local(case: dict, key: str, engine_dir: str) -> dict:
    sys.path.insert(0, engine_dir)
    from engine import system_one  # noqa: E402

    return system_one(state=case["state"], questions=case["questions"], api_key=key)


def val(ans: dict) -> object:
    if not isinstance(ans, dict):
        return None
    for k in ("noul", "choice", "score"):
        if k in ans:
            return ans[k]
    return None


def judge(g: object, p: object) -> tuple[bool, bool | None]:
    """(맞았는가, sign 일치 여부 or None)"""
    if g is None or p is None:
        return False, None
    if isinstance(g, str):
        return g == p, None
    if not isinstance(p, (int, float)):
        return False, None
    if 0.0 <= g <= 1.0 and 0.0 <= p <= 1.0:
        return abs(g - p) <= NOUL_TOL, (g >= SIGN_AT) == (p >= SIGN_AT)
    return abs(g - p) <= SCORE_TOL, None


def score(cases: list[dict], gold: dict[str, dict], results: dict[str, dict]) -> dict:
    hit = tot = sign_hit = sign_tot = 0
    by_kind: dict[str, list[int]] = {}
    by_lang: dict[str, list[int]] = {}
    misses: list[dict] = []
    for c in cases:
        ga = gold[str(c["idx"])]["answers"]
        pa = (results.get(c["id"]) or {}).get("answers") or {}
        for qname, gans in ga.items():
            ok, sgn = judge(val(gans), val(pa.get(qname, {})))
            tot += 1
            hit += ok
            by_kind.setdefault(c["kind"], [0, 0])
            by_kind[c["kind"]][0] += ok
            by_kind[c["kind"]][1] += 1
            by_lang.setdefault(c["lang"], [0, 0])
            by_lang[c["lang"]][0] += ok
            by_lang[c["lang"]][1] += 1
            if sgn is not None:
                sign_tot += 1
                sign_hit += sgn
            if not ok:
                misses.append(
                    {
                        "id": c["id"],
                        "state": c["state"],
                        "gold": val(gans),
                        "pred": val(pa.get(qname, {})),
                    }
                )
    return {
        "field_acc": hit / tot if tot else 0.0,
        "hit": hit,
        "total": tot,
        "sign_acc": sign_hit / sign_tot if sign_tot else None,
        "by_kind": {k: v[0] / v[1] for k, v in by_kind.items()},
        "by_lang": {k: v[0] / v[1] for k, v in by_lang.items()},
        "misses": misses,
    }


def report(s: dict) -> None:
    print(f"field_acc : {s['hit']}/{s['total']} = {s['field_acc'] * 100:.1f}%")
    if s["sign_acc"] is not None:
        print(f"sign@0.5  : {s['sign_acc'] * 100:.1f}%")
    print("by kind   : " + "  ".join(f"{k}={v * 100:.1f}%" for k, v in sorted(s["by_kind"].items())))
    print("by lang   : " + "  ".join(f"{k}={v * 100:.1f}%" for k, v in sorted(s["by_lang"].items())))
    if s["misses"]:
        print(f"\nmisses ({len(s['misses'])}):")
        for m in s["misses"]:
            print(f"  {m['id']:22} gold={m['gold']!s:>8}  pred={m['pred']!s:>8}  {m['state'][:58]}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", help="solar-mini4-jev 체크아웃 경로 (지정 시 로컬 engine.py 호출)")
    ap.add_argument("--score-only", metavar="JSONL", help="이미 받아둔 결과 파일만 채점")
    ap.add_argument("--out", default=str(HERE / "results_worklife.jsonl"))
    args = ap.parse_args()

    cases, gold = load()

    if args.score_only:
        results = {}
        for line in Path(args.score_only).read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                results[r["id"]] = r
        report(score(cases, gold, results))
        return 0

    key = (os.environ.get("UPSTAGE_API_KEY") or "").strip()
    if not key:
        print(
            "UPSTAGE_API_KEY 가 없습니다. 키를 받아 설정하거나 --score-only 로 채점만 하세요.\n"
            "  https://console.upstage.ai/api-keys",
            file=sys.stderr,
        )
        return 2

    results: dict[str, dict] = {}
    with open(args.out, "w", encoding="utf-8") as fh:
        for i, c in enumerate(cases, 1):
            t0 = time.time()
            try:
                out = (
                    call_local(c, key, args.engine)
                    if args.engine
                    else call_http(c, key)
                )
                rec = {"id": c["id"], "kind": c["kind"], "lang": c["lang"],
                       "answers": out.get("answers", {}), "latency_s": round(time.time() - t0, 3)}
            except Exception as exc:  # 한 건 실패로 전체를 버리지 않는다
                rec = {"id": c["id"], "kind": c["kind"], "lang": c["lang"],
                       "answers": {}, "error": str(exc)}
            results[c["id"]] = rec
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
            print(f"[{i}/{len(cases)}] {c['id']}", file=sys.stderr)

    print(f"\n결과: {args.out}\n")
    report(score(cases, gold, results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""engine.py 의 결정론적 보정 계층이 워라벨 상황에 개입하는지 측정한다 (API 키 불필요).

  python3 probe_heuristics.py --engine /path/to/solar-mini4-jev

중립값(noul 0.50 / score 2.0)을 넣고 _heuristic_overrides 를 통과시킨 뒤
값이 바뀌었는지 본다. 바뀌지 않으면 그 상황은 보정 없이 LLM 출력에 그대로 의존한다는 뜻이다.
대조군(주방 식자재·식품안전)은 바뀌어야 정상이다 — 안 바뀌면 engine 쪽이 달라진 것이다.
"""
from __future__ import annotations

import argparse
import copy
import json
import sys

NOUL = {"type": "noul", "noul": 0.50}
SCORE = {"type": "score", "score": 2.0, "probabilities": {}, "confidence": 0.5}
ROUTING = {
    "hr": "statutory limits, leave entitlement, contracts, labor complaints",
    "scheduling": "rosters, shift swaps, coverage gaps",
    "payroll": "overtime pay, night allowance, wage errors",
    "safety": "fatigue-related hazards, injuries, food safety risk",
}
FOOD = {"qa_hold": "holds", "sanitation": "cleaning", "labeling": "labels", "shipping": "cold chain"}

# (분류, state, questions, 시작값)
PROBES = [
    ("워라벨: 장시간 근로(KO)", "주방 마감조가 3주 연속 주 62시간 근무 중이다.",
     {"q": {"type": "noul", "instructions": "즉시 보호 조치가 필요한가?"}}, NOUL),
    ("워라벨: 장시간 근로(EN)", "Closing kitchen crew has worked 62h/week for three weeks straight.",
     {"q": {"type": "noul", "instructions": "Is immediate protective action required?"}}, NOUL),
    ("워라벨: 번아웃 결근", "Line cook called out sick for the third Saturday in a row; burnout suspected.",
     {"q": {"type": "noul", "instructions": "Must we escalate to HR immediately?"}}, NOUL),
    ("워라벨: 휴게시간 미준수", "Kitchen staff skipped the 30-minute break during the dinner rush.",
     {"q": {"type": "noul", "instructions": "Is urgent escalation or immediate protective action required?"}}, NOUL),
    ("워라벨: 근무표 요청", "Kitchen asks if the closing shift can start an hour later on weekends.",
     {"q": {"type": "noul", "instructions": "Is urgent escalation or immediate protective action required?"}}, NOUL),
    ("워라벨: 긴급도 점수", "주방 직원 2명이 연속 야근으로 번아웃을 호소한다.",
     {"q": {"type": "score", "instructions": "긴급도 0~4", "criteria": ["none", "low", "med", "high", "critical"]}}, SCORE),
    ("워라벨: 담당팀 라우팅", "Closing crew logged 62h this week and wants relief staffing.",
     {"q": {"type": "choice", "instructions": "Which team should own this?", "criteria": ROUTING}}, None),
    ("대조군: 고수 대체 문의", "Kitchen staff asks if cilantro can be substituted in staff meals.",
     {"q": {"type": "noul", "instructions": "Is urgent escalation or immediate protective action required?"}}, NOUL),
    ("대조군: 고수 빼달라(KO)", "식당 메뉴에 고수를 빼 달란다.",
     {"q": {"type": "noul", "instructions": "즉시 보호 조치가 필요한가?"}}, NOUL),
    ("대조군: 냉장실 알람", "Cold room freezer alarm silenced overnight; poultry inside.",
     {"q": {"type": "noul", "instructions": "Is immediate protective action required?"}}, NOUL),
    ("대조군: 라벨 라우팅", "Peanut allergen label missing on the lot code for today's run.",
     {"q": {"type": "choice", "instructions": "Which team owns this?", "criteria": FOOD}}, None),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True, help="solar-mini4-jev 체크아웃 경로")
    args = ap.parse_args()

    sys.path.insert(0, args.engine)
    try:
        from engine import _heuristic_overrides
    except ImportError as exc:
        print(f"engine.py 를 불러오지 못했습니다: {exc}", file=sys.stderr)
        return 2

    width = max(len(p[0]) for p in PROBES)
    touched = 0
    for label, state, questions, base in PROBES:
        answers = {} if base is None else {"q": copy.deepcopy(base)}
        before = json.dumps(answers, ensure_ascii=False)
        _heuristic_overrides(state, questions, answers)
        after = json.dumps(answers, ensure_ascii=False)
        if before == after:
            print(f"{label:<{width}}  개입 없음 (LLM 출력 그대로)")
        else:
            touched += 1
            print(f"{label:<{width}}  보정 개입")
            print(f"{'':<{width}}    {before}  ->  {after}")
    print(f"\n{touched}/{len(PROBES)} 건에 보정이 걸렸습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

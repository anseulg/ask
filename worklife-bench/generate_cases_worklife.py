#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""주방 워라벨(work-life balance) 판단 케이스셋 + gold 생성기.

solar-mini4-jev (https://github.com/hunkim/solar-mini4-jev) 의 System One API가
주방 워라벨 영역에서 어디까지 쓸 수 있는지 실측하기 위한 케이스셋이다.
기존 test400에는 워라벨 케이스가 0건이라 비교 기준이 없어서 새로 만든다.

gold 기준(rubric): README.md 의 "채점 기준" 절 참고. 근로기준법 임계값을 앵커로 쓴다.
  - 주 52시간(40+12), 4시간당 30분 휴게, 주휴일, 연속휴식,
    18세 미만 야간근로 금지, 임신 중 연장근로 금지
출력:
  cases_worklife.json  — solar-mini4-jev bench 케이스 포맷 (id/kind/state/questions/idx)
  gold_worklife.json   — idx(str) -> {"answers": {...}} (repo의 gold_*.json 과 동일 포맷)
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

NOUL_Q_EN = "Is immediate management action required to protect the staff?"
NOUL_Q_KO = "직원 보호를 위해 즉시 조치가 필요한가?"

ROUTING_CRITERIA = {
    "hr": "statutory limits, leave entitlement, contracts, labor complaints",
    "scheduling": "rosters, shift swaps, coverage gaps",
    "payroll": "overtime pay, night allowance, wage errors",
    "safety": "fatigue-related hazards, injuries, food safety risk",
}
SCORE_LEVELS = ["none", "low", "medium", "high", "critical"]

# (suffix, lang, state, gold)  — noul: 즉시 조치 필요성 [0,1]
NOUL: list[tuple[str, str, str, float]] = [
    # --- band A: 선호/편의 요청 (조치 불필요) ---
    ("pref_1", "en", "Kitchen asks whether the staff-meal break can move from 15:00 to 15:30.", 0.08),
    ("pref_2", "ko", "주방 직원이 휴게실에 커피머신을 놓아달라고 한다.", 0.08),
    ("pref_3", "en", "Line cook asks to swap next month's Tuesday off with a colleague.", 0.10),
    ("pref_4", "ko", "마감조가 조리복 세탁 주기를 주 2회로 늘려달라고 한다.", 0.08),
    ("pref_5", "en", "Kitchen wants the shift roster posted as a PDF instead of a printout.", 0.06),
    # --- band A': 워라벨 어휘가 있으나 긴급하지 않은 distractor ---
    ("lex_1", "en", "HR asks the kitchen to re-run the annual work-life-balance survey.", 0.08),
    ("lex_2", "ko", "워라벨 캠페인 포스터를 주방 게시판에 붙여도 되냐고 묻는다.", 0.05),
    ("lex_3", "en", "Kitchen asks if next week's work-life balance workshop can be recorded.", 0.06),
    # --- band B: 관찰 필요, 즉시 조치는 아님 ---
    ("watch_1", "en", "Prep cook worked 46 hours this week; last week was 41.", 0.30),
    ("watch_2", "ko", "주방 직원 1명이 이번 주 연장근로 6시간을 기록했다.", 0.28),
    ("watch_3", "en", "Two kitchen staff swapped into a back-to-back close/open once this month.", 0.35),
    ("watch_4", "ko", "조리팀 연차 소진율이 분기 기준 38%에 머물러 있다.", 0.30),
    # --- band C: 법정 임계 접근/초과 → 조치 필요 ---
    ("limit_1", "en", "Prep team averaged 54 hours a week for two consecutive weeks.", 0.72),
    ("limit_2", "ko", "디너 러시 6시간 동안 주방 인력이 휴게시간을 한 번도 쓰지 못했다.", 0.70),
    ("limit_3", "en", "Closing crew finished at 01:40 and is rostered to open at 09:00 the same morning.", 0.74),
    ("limit_4", "ko", "조리장이 주휴일 없이 12일 연속 근무 중이다.", 0.78),
    ("limit_5", "en", "Kitchen has run three people short for five weeks; nightly overtime is now mandatory.", 0.70),
    # --- band D: 명백한 위반/건강 위험 → 즉시 조치 ---
    ("viol_1", "ko", "주방 마감조가 3주 연속 주 62시간 근무 중이다. 내일 예약은 만석이다.", 0.88),
    ("viol_2", "en", "Line cook fell asleep at the pass after six straight 16-hour days.", 0.93),
    ("viol_3", "ko", "18세 미만 실습생이 오후 10시 이후 조리 라인에 투입되고 있다.", 0.92),
    ("viol_4", "en", "Sous chef reported chest pain after a fourth consecutive double shift.", 0.95),
    ("viol_5", "ko", "임신 중인 조리사가 주 12시간 연장근로에 배정됐다.", 0.90),
    # --- band D': 피로가 식품안전 사고로 번진 교차 상황 ---
    ("cross_1", "en", "Cold room #3 sat at 12C for 70 minutes; the cook due to check it is on his 13th straight day.", 0.85),
    ("cross_2", "ko", "냉장고 온도 점검이 3일 누락됐고 담당자는 연속 야근 중이다.", 0.80),
]

# (suffix, lang, state, gold_key)  — choice: 담당 라우팅
CHOICE: list[tuple[str, str, str, str]] = [
    ("route_1", "en", "Closing crew logged 62h this week; the statutory weekly cap is exceeded.", "hr"),
    ("route_2", "en", "Two cooks want to swap next Saturday's shift.", "scheduling"),
    ("route_3", "en", "Night allowance is missing from the March payslip for three kitchen staff.", "payroll"),
    ("route_4", "ko", "야간근로수당이 3월 급여에서 누락됐다.", "payroll"),
    ("route_5", "en", "A cook nodded off while operating the slicer after a double shift.", "safety"),
    ("route_6", "ko", "연차 사용 신청이 3개월째 반려되고 있다.", "hr"),
    ("route_7", "en", "The roster has no cover for Friday dinner service.", "scheduling"),
    ("route_8", "ko", "교대 근무표가 매주 목요일에야 나와 개인 일정을 잡기 어렵다.", "scheduling"),
    ("route_9", "en", "A kitchen porter's contract says 40h but he is rostered for 55h.", "hr"),
    ("route_10", "ko", "주방 보조가 연장근로수당 계산이 틀렸다고 문의했다.", "payroll"),
    ("route_11", "en", "Burn injury on the line during the 14th consecutive working hour.", "safety"),
    ("route_12", "ko", "휴게시간 미부여로 근로감독관 진정이 접수됐다.", "hr"),
]

# (suffix, lang, state, gold_score 0..4)  — score: 긴급도
SCORE: list[tuple[str, str, str, float]] = [
    ("sev_1", "ko", "주방 직원 2명이 연속 야근으로 번아웃을 호소한다.", 3.0),
    ("sev_2", "en", "One cook asks to finish an hour earlier next Friday.", 0.5),
    ("sev_3", "en", "Kitchen overtime is running 18% above plan this month.", 1.5),
    ("sev_4", "ko", "조리팀 3명이 이번 분기 연차를 전혀 쓰지 못했다.", 2.0),
    ("sev_5", "en", "Third sick call this month, all attributed to exhaustion.", 2.5),
    ("sev_6", "ko", "마감조 전원이 12일 연속 근무 중이다.", 3.5),
    ("sev_7", "en", "A cook collapsed during service at the end of a 16-hour shift.", 4.0),
    ("sev_8", "ko", "휴게실 의자가 낡아 교체 요청이 들어왔다.", 0.5),
    ("sev_9", "en", "Staff meal time was cut from 30 to 20 minutes to speed up prep.", 2.0),
    ("sev_10", "ko", "신규 채용 3명 중 2명이 근무시간을 이유로 2주 안에 퇴사했다.", 3.0),
    ("sev_11", "en", "Kitchen wants a wellness poster put up in the locker room.", 0.0),
    ("sev_12", "ko", "18세 미만 실습생이 야간 조리 라인에 배치됐다.", 4.0),
]


def build() -> tuple[list[dict], dict[str, dict]]:
    cases: list[dict] = []
    gold: dict[str, dict] = {}
    idx = 0

    def add(case: dict, answers: dict) -> None:
        nonlocal idx
        idx += 1
        case["idx"] = idx
        cases.append(case)
        gold[str(idx)] = {
            "model": "worklife-rubric-v1",
            "answers": answers,
            "rubric": "kitchen-worklife-v1",
        }

    for suffix, lang, state, g in NOUL:
        add(
            {
                "id": f"wl_noul_{suffix}",
                "kind": "noul",
                "lang": lang,
                "state": state,
                "questions": {
                    "yes": {
                        "type": "noul",
                        "instructions": NOUL_Q_KO if lang == "ko" else NOUL_Q_EN,
                    }
                },
            },
            {"yes": {"type": "noul", "noul": g}},
        )

    for suffix, lang, state, g in CHOICE:
        add(
            {
                "id": f"wl_choice_{suffix}",
                "kind": "choice",
                "lang": lang,
                "state": state,
                "questions": {
                    "team": {
                        "type": "choice",
                        "instructions": "어느 팀이 담당해야 하는가?" if lang == "ko" else "Which team should own this?",
                        "criteria": ROUTING_CRITERIA,
                    }
                },
            },
            {"team": {"type": "choice", "choice": g}},
        )

    for suffix, lang, state, g in SCORE:
        add(
            {
                "id": f"wl_score_{suffix}",
                "kind": "score",
                "lang": lang,
                "state": state,
                "questions": {
                    "urgency": {
                        "type": "score",
                        "instructions": "긴급도 0~4" if lang == "ko" else "Urgency from 0 to 4",
                        "criteria": SCORE_LEVELS,
                    }
                },
            },
            {"urgency": {"type": "score", "score": g}},
        )

    return cases, gold


def main() -> None:
    cases, gold = build()
    (HERE / "cases_worklife.json").write_text(
        json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (HERE / "gold_worklife.json").write_text(
        json.dumps(gold, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    ko = sum(1 for c in cases if c["lang"] == "ko")
    print(f"cases: {len(cases)} (ko={ko}, en={len(cases) - ko})")
    for kind in ("noul", "choice", "score"):
        print(f"  {kind}: {sum(1 for c in cases if c['kind'] == kind)}")


if __name__ == "__main__":
    main()

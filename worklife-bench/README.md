# worklife-bench — 주방 워라벨 판단 케이스셋

[solar-mini4-jev](https://github.com/hunkim/solar-mini4-jev) 의 System One API가
**주방 × 워라벨(work-life balance)** 영역에서 어디까지 신뢰할 수 있는지 재기 위한 케이스셋이다.

## 왜 만들었나

기존 `test400` 벤치를 뒤져보면:

- 주방/식품 계열 케이스는 **56/400건(14%)** 있고, Grok 4.6 Judge gold 기준 Solar·Jev 모두 이 부분집합에서 **59/59 = 100%** 다.
  다만 다루는 축은 **식품안전·콜드체인·표시(라벨)** 뿐이다 (리스테리아, 냉장 온도 이탈, 알레르겐 오표시, 금속검출).
- **워라벨 케이스는 0건**이다. `engine.py` 의 결정론적 보정 계층(`_heuristic_overrides`, 약 600줄)에도
  근로시간·휴게·연차·야간근로 관련 규칙이 하나도 없다.

즉 워라벨 질의는 보정 계층을 전혀 타지 않는 **순수 LLM 출력**이고, 검증된 gold가 없다.
README가 말하는 98.4%는 이 영역을 포함하지 않는다. 이 케이스셋은 그 빈칸을 메운다.

`probe_heuristics.py` 로 그 사실을 직접 확인할 수 있다 — 워라벨 상황은 보정이 걸리지 않고,
대조군(고수 대체 문의 → 0.15, 냉장실 알람 → 0.74)만 걸린다.

## 구성

| 파일 | 설명 |
|---|---|
| `generate_cases_worklife.py` | 케이스·gold 생성기 (케이스 표가 여기 있다. 수정은 여기서) |
| `cases_worklife.json` | 48건 — noul 24 · choice 12 · score 12, 한국어 22 / 영어 26 |
| `gold_worklife.json` | 루브릭 기반 gold (repo의 `gold_*.json` 과 동일 포맷, idx 키) |
| `run_worklife.py` | API 호출 + 채점 |
| `probe_heuristics.py` | 보정 계층이 워라벨 상황에 개입하는지 측정 (API 키 불필요) |

## 채점 기준

repo 벤치와 동일하게 맞췄다 — noul 절대오차 ≤0.25, sign@0.5, choice 완전일치, score ≤1.0.

## gold 루브릭 (kitchen-worklife-v1)

근로기준법 임계값을 앵커로 쓴다. 주관을 줄이려면 판단 기준이 법조문처럼 외부에 있어야 한다.

| 구간 | noul | 기준 |
|---|---:|---|
| 선호·편의 요청 | 0.05–0.10 | 조치 불필요. 워라벨 **어휘만** 있는 distractor(설문·포스터·워크숍)도 여기 둔다 |
| 관찰 | 0.28–0.35 | 법정 한도 안이지만 추세가 나쁨 (주 46시간, 연차 소진율 저조) |
| 임계 접근·초과 | 0.70–0.78 | 주 52시간 초과, 4시간당 30분 휴게 미부여, 연속휴식 11시간 미만, 주휴일 미부여 |
| 위반·건강 위험 | 0.85–0.95 | 주 62시간, 18세 미만 야간근로, 임신 중 연장근로, 실신·흉통 |

`score` 는 0~4 긴급도, `choice` 는 `hr / scheduling / payroll / safety` 라우팅이다.
distractor를 넣은 이유는 엔진이 "긴급/보호조치" 지시문에 과반응하는지 보기 위해서다 —
워라벨 어휘가 있다고 긴급으로 올리면 그 구간에서 틀린다.

## 실행

```bash
python3 generate_cases_worklife.py          # 케이스·gold 재생성

# 호스팅 엔드포인트 (BYOK — https://console.upstage.ai/api-keys)
UPSTAGE_API_KEY=... python3 run_worklife.py

# 로컬 engine.py 직접 호출
UPSTAGE_API_KEY=... python3 run_worklife.py --engine /path/to/solar-mini4-jev

# 받아둔 결과만 채점
python3 run_worklife.py --score-only results_worklife.jsonl

# 보정 계층 개입 여부만 (키 불필요)
python3 probe_heuristics.py --engine /path/to/solar-mini4-jev
```

## 결과를 어떻게 읽나

- **noul 상위 구간(0.70+)에서 틀리면** 실제 위반을 놓친다는 뜻이다 — 이 용도로 쓰면 안 된다.
- **distractor 구간(`lex_*`)에서 높게 나오면** 워라벨 얘기만 나와도 긴급으로 올린다는 뜻이다.
  알림 에이전트에 물리면 그대로 알림 피로가 된다.
- **choice 라우팅이 흔들리면** 담당 배정 자동화는 보류하고 초안 제시까지만 쓴다.

세 구간이 모두 통과해야 판단 계층으로 투입할 수 있다. 하나라도 깨지면
`engine.py` 의 protective-action 블록에 근로시간·휴게 키워드군을 추가하는 쪽이 먼저다.

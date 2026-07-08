# 스킬 테스트 가이드

## 1. 테스트 프레임워크 개요

스킬 테스트는 "스킬이 로드된 상태에서 모델이 올바르게 작업을 수행하는가"를 검증한다. 단위 테스트와 달리 모델의 자연어 출력을 평가해야 하므로 assertion 기반 채점과 전문 에이전트 활용을 조합한다.

### 테스트 흐름

```
[테스트 프롬프트] --> [스킬 로드] --> [모델 실행] --> [출력 수집] --> [채점] --> [결과 기록]
```

### 테스트 유형

| 유형 | 목적 | 방법 |
|------|------|------|
| 트리거 테스트 | description이 올바른 상황에서 스킬을 활성화하는가 | 트리거/비트리거 프롬프트 쌍 |
| 기능 테스트 | 스킬이 지시한 대로 작업을 수행하는가 | assertion 기반 채점 |
| 비교 테스트 | 스킬 유무에 따른 품질 차이 | with-skill vs baseline |
| 회귀 테스트 | 스킬 수정 후 기존 기능이 유지되는가 | 고정 테스트 세트 재실행 |

---

## 2. 테스트 프롬프트 작성법

### 2.1 프롬프트 구조

```
[상황 설정]
[구체적 요청]
[제약 조건 (선택)]
```

### 2.2 좋은 테스트 프롬프트의 조건

1. **명확한 기대 출력이 존재**: 채점할 수 있어야 한다
2. **스킬의 핵심 기능을 검증**: 부수적 기능이 아닌 핵심 로직을 대상으로
3. **재현 가능**: 동일 프롬프트로 반복 실행 시 일관된 결과
4. **독립적**: 다른 테스트의 결과에 의존하지 않음

### 2.3 예시

```markdown
# test_security_review_basic.txt

## 상황
다음은 사용자 인증을 처리하는 Express.js 라우터 코드이다:

```javascript
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;
  db.query(query, (err, result) => {
    if (result.length > 0) {
      req.session.user = result[0];
      res.json({ success: true });
    }
  });
});
```

## 요청
이 코드를 보안 관점에서 리뷰해줘.
```

### 2.4 테스트 프롬프트 분류

```
tests/
    trigger/              # 트리거 검증 테스트
        should_trigger/   # 스킬이 활성화되어야 하는 프롬프트
            t01.txt
            t02.txt
        should_not_trigger/ # 스킬이 활성화되면 안 되는 프롬프트
            t01.txt
            t02.txt
    functional/           # 기능 테스트
        basic/            # 기본 기능
            t01.txt
            t01_assertions.json
        advanced/         # 고급 기능
            t01.txt
            t01_assertions.json
    regression/           # 회귀 테스트
        fixed_bugs/
            bug_001.txt
            bug_001_assertions.json
```

---

## 3. With-skill vs Baseline 비교 실행

### 3.1 개념

동일한 프롬프트를 두 조건에서 실행하여 스킬의 효과를 측정한다.

- **With-skill**: 스킬이 로드된 상태에서 실행
- **Baseline**: 스킬 없이 모델 기본 능력으로 실행

### 3.2 비교 실행 절차

```
Step 1: 테스트 프롬프트 준비 (N개)

Step 2: Baseline 실행
  각 프롬프트를 스킬 없이 실행하여 결과 수집
  결과를 baseline_results/ 에 저장

Step 3: With-skill 실행
  동일 프롬프트를 스킬 로드 후 실행하여 결과 수집
  결과를 skill_results/ 에 저장

Step 4: 비교 채점
  각 결과 쌍을 Comparator 에이전트가 비교
  개선/동등/퇴보 판정

Step 5: 종합 보고
  - 개선율: (개선 수 / 총 수) * 100
  - 퇴보율: (퇴보 수 / 총 수) * 100
  - 스킬 효과 판정
```

### 3.3 비교 기준

| 기준 | 설명 | 가중치 |
|------|------|--------|
| 정확성 | 올바른 결과를 내는가 | 40% |
| 완전성 | 누락 없이 모든 항목을 다루는가 | 25% |
| 형식 준수 | 지정된 출력 형식을 따르는가 | 20% |
| 효율성 | 불필요한 내용 없이 간결한가 | 15% |

### 3.4 유의미한 차이 판정

```
개선율 > 70%  --> 스킬이 명확하게 유효
개선율 50-70% --> 유효하나 개선 여지 있음
개선율 30-50% --> 효과 미미, 스킬 재설계 고려
개선율 < 30%  --> 스킬 효과 없음, 원인 분석 필요
```

---

## 4. Assertion 기반 채점

### 4.1 Assertion 유형

```json
{
  "assertions": [
    {
      "type": "contains",
      "value": "SQL injection",
      "case_sensitive": false,
      "weight": 1.0,
      "description": "SQL injection 취약점을 언급해야 함"
    },
    {
      "type": "not_contains",
      "value": "코드가 안전합니다",
      "weight": 0.5,
      "description": "안전하다고 잘못 판단하면 안 됨"
    },
    {
      "type": "regex",
      "pattern": "parameterized|prepared statement|바인딩",
      "weight": 1.0,
      "description": "해결책으로 파라미터화된 쿼리를 제안해야 함"
    },
    {
      "type": "format",
      "check": "json_valid",
      "weight": 0.5,
      "description": "출력이 유효한 JSON이어야 함"
    },
    {
      "type": "count",
      "pattern": "severity.*high",
      "min": 1,
      "max": 5,
      "weight": 0.5,
      "description": "high severity 항목이 1-5개여야 함"
    },
    {
      "type": "length",
      "min_words": 50,
      "max_words": 500,
      "weight": 0.3,
      "description": "적절한 길이의 응답"
    }
  ]
}
```

### 4.2 Assertion 파일 구조

```json
{
  "test_id": "test_security_basic_001",
  "test_name": "SQL injection 탐지",
  "assertions": [...],
  "scoring": {
    "method": "weighted_sum",
    "pass_threshold": 0.7
  }
}
```

### 4.3 채점 로직

```
score = sum(assertion.weight * assertion.passed) / sum(assertion.weight)

결과:
  score >= pass_threshold --> PASS
  score < pass_threshold  --> FAIL
```

### 4.4 Assertion 작성 원칙

1. **필수 항목은 weight 1.0**: 핵심 기능 검증
2. **선택 항목은 weight 0.3-0.5**: 부가 기능/형식 검증
3. **부정 assertion 포함**: "이것이 없어야 한다" (잘못된 판단 방지)
4. **유연한 매칭**: 정확한 문자열보다 regex/키워드 조합 사용
5. **한 테스트당 3-8개**: 너무 적으면 검증 부족, 너무 많으면 유지보수 부담

---

## 5. 전문 에이전트 활용

### 5.1 Grader 에이전트

assertion만으로 판단하기 어려운 품질 요소를 평가한다.

```
Agent(
    description="스킬 출력 채점",
    prompt="""
    ## 역할
    스킬 테스트 결과를 채점하는 전문 채점관이다.

    ## 채점 대상
    테스트 프롬프트: {test_prompt}
    모델 출력: {model_output}

    ## 채점 기준
    1. 정확성 (0-10): 사실적으로 올바른 내용인가
    2. 완전성 (0-10): 누락된 중요 항목이 없는가
    3. 실행 가능성 (0-10): 제안이 실제로 적용 가능한가

    ## 출력 형식
    JSON으로 각 기준의 점수와 코멘트를 반환하라.
    """,
    run_in_background=False
)
```

### 5.2 Comparator 에이전트

With-skill과 Baseline 결과를 비교한다.

```
Agent(
    description="결과 비교 평가",
    prompt="""
    ## 역할
    두 결과를 비교하여 어느 쪽이 더 우수한지 판단한다.

    ## 비교 대상
    프롬프트: {test_prompt}
    결과 A (baseline): {baseline_output}
    결과 B (with-skill): {skill_output}

    ## 판정 기준
    - 정확성, 완전성, 형식, 실용성

    ## 출력
    {
      "winner": "A" | "B" | "tie",
      "margin": "significant" | "slight" | "none",
      "reasoning": "판단 근거"
    }
    """
)
```

### 5.3 Analyzer 에이전트

테스트 결과 전체를 분석하여 스킬 개선점을 도출한다.

```
Agent(
    description="테스트 결과 분석",
    prompt="""
    ## 역할
    스킬 테스트 결과를 종합 분석하여 개선점을 도출한다.

    ## 입력
    전체 테스트 결과: {all_results}
    스킬 정의: {skill_content}

    ## 분석 항목
    1. 반복 실패 패턴: 같은 유형의 실패가 반복되는가
    2. 취약 영역: 어떤 유형의 테스트에서 점수가 낮은가
    3. 강점 영역: 어떤 유형에서 일관되게 높은 점수인가
    4. 구체적 개선 제안: 스킬 본문의 어떤 부분을 수정하면 되는가

    ## 출력
    분석 보고서 + 우선순위별 개선 제안 목록
    """
)
```

---

## 6. 반복 개선 루프

스킬을 테스트하고 결과에 따라 수정하는 반복 과정이다.

### 6.1 루프 절차

```
반복 1:
  1. 스킬 초안 작성
  2. 테스트 프롬프트 5-10개 실행
  3. Grader로 채점
  4. Analyzer로 분석
  5. 분석 결과에 따라 스킬 수정

반복 2:
  1. 수정된 스킬로 동일 테스트 재실행
  2. 이전 결과와 비교 (개선/퇴보 확인)
  3. 회귀 발생 시 원인 분석
  4. 추가 수정

반복 3+:
  수렴할 때까지 반복.
  일반적으로 3-5회 반복이면 충분하다.
```

### 6.2 수렴 판정

```
수렴 조건:
- pass_rate >= 0.85 (85% 이상 통과)
- 이전 반복 대비 개선폭 < 5%
- 회귀 항목 0개

수렴하지 않는 경우:
- 테스트 프롬프트가 모호한지 확인
- assertion이 너무 엄격한지 확인
- 스킬의 범위가 너무 넓은지 확인 -> 분할 검토
```

### 6.3 개선 우선순위

```
1순위: 실패율이 높은 assertion 대응
2순위: Analyzer가 지적한 반복 패턴 해결
3순위: 형식/완전성 개선
4순위: 엣지 케이스 대응
```

---

## 7. Description 트리거 검증

### 7.1 트리거 테스트 설계

스킬의 description이 올바른 상황에서만 활성화되는지 검증한다.

### 7.2 양성 테스트 (should trigger)

스킬이 활성화되어야 하는 프롬프트 목록을 작성한다.

```
# should_trigger/

t01.txt: "이 코드의 보안을 검토해줘"
t02.txt: "security review for this PR"
t03.txt: "보안 취약점이 있는지 확인해줘"
t04.txt: "인증 로직을 감사해줘"
t05.txt: "이 API에 보안 이슈가 있나?"
```

### 7.3 음성 테스트 (should not trigger)

스킬이 활성화되면 안 되는 프롬프트 목록을 작성한다.

```
# should_not_trigger/

t01.txt: "이 함수의 성능을 개선해줘"
t02.txt: "코드 스타일을 정리해줘"
t03.txt: "새로운 기능을 추가해줘"
t04.txt: "테스트를 작성해줘"
t05.txt: "이 에러를 디버깅해줘"
```

### 7.4 트리거 정확도 측정

```
True Positive:  should_trigger에서 활성화됨 (올바름)
False Negative: should_trigger에서 미활성화됨 (놓침)
True Negative:  should_not_trigger에서 미활성화됨 (올바름)
False Positive: should_not_trigger에서 활성화됨 (오발동)

Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * (Precision * Recall) / (Precision + Recall)

목표: F1 >= 0.9
```

### 7.5 트리거 개선 방법

- **Recall 낮음** (놓침이 많음): description에 키워드/트리거 조건 추가
- **Precision 낮음** (오발동이 많음): SKIP 조건 추가, 트리거 조건 구체화
- **둘 다 낮음**: description 전면 재작성

---

## 8. 워크스페이스 구조

### 8.1 테스트 워크스페이스 레이아웃

```
.claude/skills/[skill-name]/
    skill.md                    # 스킬 본문
    references/                 # 레퍼런스 파일
    tests/
        config.json             # 테스트 설정
        trigger/
            should_trigger/
                t01.txt
                t02.txt
            should_not_trigger/
                t01.txt
                t02.txt
        functional/
            basic/
                t01.txt
                t01_assertions.json
            advanced/
                t01.txt
                t01_assertions.json
        regression/
            bug_001.txt
            bug_001_assertions.json
        results/                # 실행 결과 (gitignore 대상)
            run_20240615/
                eval_metadata.json
                grading.json
                timing.json
                outputs/
                    t01_output.txt
                    t02_output.txt
```

### 8.2 config.json 구조

```json
{
  "skill_path": "skill.md",
  "model": "sonnet",
  "temperature": 0,
  "max_tokens": 4096,
  "pass_threshold": 0.7,
  "comparison": {
    "enabled": true,
    "baseline_model": "sonnet",
    "improvement_threshold": 0.5
  },
  "trigger_test": {
    "enabled": true,
    "f1_threshold": 0.9
  },
  "retry": {
    "max_attempts": 2,
    "on_failure_only": true
  }
}
```

### 8.3 결과 보존 정책

- 최근 5회 실행 결과를 보존한다
- 결과 디렉토리는 `.gitignore`에 추가한다
- 주요 마일스톤(스킬 버전 변경)의 결과는 별도 보관한다
- grading.json의 점수 추이를 추적하여 퇴보를 감지한다

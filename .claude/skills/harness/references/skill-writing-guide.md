# 스킬 작성 가이드

## 1. Description 작성 패턴

### 1.1 트리거 메커니즘

description은 모델이 스킬을 선택하는 유일한 진입점이다. 모델은 사용자 메시지와 description을 매칭하여 스킬 로드 여부를 결정한다.

**구조**:
```
1줄: 스킬이 하는 일 (10단어 이내)
2줄~: 트리거 조건 (When/키워드)
```

**예시**:
```yaml
description: |
  코드 변경사항의 보안 취약점을 검사한다.
  - When the user asks for security review or audit
  - When changes touch authentication, authorization, or crypto
  - "보안 리뷰", "security check", "취약점 검사"
  Use BEFORE committing security-sensitive changes.
```

### 1.2 pushy 작성법

모델이 스킬을 무시하지 않도록 강제성을 높이는 기법이다.

**레벨 1 (제안)**: "Can be used for..."
- 모델이 자주 무시함. 단독 사용을 권장하지 않음.

**레벨 2 (권장)**: "Use this skill when..."
- 적절한 트리거 강도. 대부분의 스킬에 적합.

**레벨 3 (필수)**: "MUST use this skill BEFORE..."
- 모델이 거의 항상 선택. 품질 게이트 스킬에 적합.

**레벨 4 (차단)**: "NEVER [action] without loading this skill first."
- 가장 강한 트리거. 스킬을 거치지 않으면 작업 자체가 잘못됨을 의미.

### 1.3 트리거 키워드 설계

다국어 환경에서는 한국어와 영어 키워드를 모두 포함한다.

```yaml
description: |
  데이터 시각화 차트를 생성한다.
  - "차트", "그래프", "chart", "graph", "plot", "시각화", "visualization"
  - When creating any visual representation of data
  - BEFORE writing chart code in any library
```

### 1.4 anti-trigger (비활성 조건)

특정 조건에서 스킬이 로드되지 않아야 하는 경우 SKIP 조건을 명시한다.

```yaml
description: |
  Claude API 사용법을 안내한다.
  TRIGGER when: Claude, Anthropic, claude-*, anthropic SDK
  SKIP when: OpenAI, GPT, Gemini가 명시적으로 언급된 경우
```

---

## 2. 본문 작성 스타일

### 2.1 Why-First

각 지시의 이유를 먼저 설명한다. 모델은 "왜"를 이해해야 상황에 맞게 적용한다.

```markdown
# 나쁜 예
테스트는 3개 이상 작성하라.

# 좋은 예
단일 테스트로는 엣지 케이스를 놓치기 쉽다.
최소 3개의 테스트를 작성한다: 정상 케이스, 경계 값, 에러 케이스.
```

### 2.2 일반화

특정 기술 스택에 종속되지 않는 표현을 사용한다. 범용 스킬은 프레임워크/언어에 무관하게 적용 가능해야 한다.

```markdown
# 나쁜 예
React의 useEffect에서 cleanup 함수를 반환하라.

# 좋은 예
리소스를 획득하는 코드에는 반드시 해제 로직을 포함한다.
(예: 이벤트 리스너 해제, 타이머 정리, 연결 종료)
```

기술 특정 스킬이라면 해당 기술을 description에서 명시하고 본문에서는 해당 기술에 집중한다.

### 2.3 명령형

모든 지시는 명령형으로 작성한다. "~할 수 있다", "~해도 된다"보다 "~한다", "~하라"를 사용한다.

```markdown
# 나쁜 예
에러 메시지를 사용자 친화적으로 작성할 수 있습니다.

# 좋은 예
에러 메시지를 사용자 친화적으로 작성한다.
내부 구현 세부사항을 노출하지 않는다.
```

### 2.4 컨텍스트 절약

스킬 본문은 모델의 컨텍스트 윈도우를 소비한다. 불필요한 반복, 장황한 설명, 자명한 내용을 제거한다.

**토큰 절약 기법**:
- 표로 정리할 수 있는 내용은 표로
- 코드 예시는 최소한의 핵심만
- 같은 패턴의 반복은 1개 예시 + "동일 패턴 적용" 표기
- 레퍼런스 파일 분리: 항상 필요하지 않은 상세 내용은 `references/`에

```markdown
# 나쁜 예 (장황)
## 에러 처리
에러 처리는 매우 중요합니다. 에러가 발생하면 사용자에게 적절한 피드백을
제공해야 합니다. 에러를 무시하면 디버깅이 어려워지고 사용자 경험이
나빠집니다. 따라서 모든 에러를 적절히 처리해야 합니다.

# 좋은 예 (간결)
## 에러 처리
모든 에러를 포착하고 사용자 친화적 메시지를 반환한다.
내부 에러는 로그에만 기록한다.
```

---

## 3. 출력 형식 정의 패턴

스킬이 특정 형식의 출력을 요구할 때 사용하는 패턴들이다.

### 3.1 JSON 스키마 정의

```markdown
## 출력 형식

다음 JSON 형식으로 결과를 반환한다:

```json
{
  "summary": "string - 1-2문장 요약",
  "items": [
    {
      "id": "string - 고유 식별자",
      "status": "pass | fail | skip",
      "detail": "string - 상세 설명 (status가 fail일 때만)"
    }
  ],
  "metadata": {
    "total": "number",
    "passed": "number",
    "failed": "number"
  }
}
```
```

### 3.2 마크다운 템플릿

```markdown
## 출력 형식

다음 마크다운 형식으로 결과를 작성한다:

```
## [제목]

### 요약
[1-2문장 요약]

### 발견 사항
| 항목 | 상태 | 설명 |
|------|------|------|
| ... | ... | ... |

### 권장 조치
1. [우선순위 순으로 나열]
```
```

### 3.3 자유 형식 + 제약

```markdown
## 출력 형식

형식은 자유이나 다음 조건을 충족한다:
- 200단어 이내
- 첫 줄은 한 문장 결론
- 코드 블록에는 언어 태그 포함
- 외부 링크 금지
```

---

## 4. Progressive Disclosure 패턴

스킬의 정보를 단계적으로 제공하여 컨텍스트를 절약하는 패턴이다.

### 4.1 구조

```
스킬 본문 (항상 로드)
    |
    +-- references/basic.md (자주 필요)
    +-- references/advanced.md (가끔 필요)
    +-- references/examples.md (요청 시)
```

### 4.2 스킬 본문에서의 참조 지시

```markdown
# 코드 리뷰 스킬

## 기본 절차
[여기에 항상 필요한 핵심 절차]

## 고급 패턴
보안 관련 코드를 리뷰할 때는 `references/security-checklist.md`를 읽어라.
성능 관련 코드를 리뷰할 때는 `references/performance-guide.md`를 읽어라.
```

### 4.3 레퍼런스 분리 기준

| 본문에 포함 | 레퍼런스로 분리 |
|------------|--------------|
| 모든 실행에서 필요 | 조건부로 필요 |
| 100줄 이하 | 100줄 이상 |
| 판단 기준/원칙 | 상세 절차/예시 |
| 변경 빈도 낮음 | 자주 업데이트 |

---

## 5. 스크립트 번들링 판단 기준

스킬이 외부 스크립트(셸, Python 등)를 실행해야 할 때, 인라인 vs 별도 파일 판단 기준이다.

### 5.1 인라인 (스킬 본문에 포함)

```markdown
다음 조건을 모두 충족하면 인라인:
- 10줄 이하
- 단일 명령어 또는 간단한 파이프라인
- 파라미터 변동이 적음
```

예시:
```markdown
다음 명령으로 테스트를 실행한다:
```bash
npm test -- --coverage --reporter=json
```
```

### 5.2 별도 스크립트 파일

```markdown
다음 조건 중 하나라도 해당하면 별도 파일:
- 10줄 초과
- 에러 처리 로직 포함
- 여러 스킬에서 재사용
- 실행 환경 설정이 필요
```

스크립트 위치: `.claude/skills/[skill-name]/scripts/`

```
.claude/skills/
    my-skill/
        skill.md
        references/
            guide.md
        scripts/
            run-analysis.sh
            process-results.py
```

### 5.3 스크립트 참조 방법

```markdown
다음 스크립트를 실행한다:
`bash .claude/skills/my-skill/scripts/run-analysis.sh {target_path}`

스크립트가 0이 아닌 종료 코드를 반환하면 에러 내용을 사용자에게 보고한다.
```

---

## 6. 데이터 스키마 표준

스킬이 생성하는 메타데이터 파일의 표준 스키마이다.

### 6.1 eval_metadata.json

스킬 평가 실행의 메타데이터를 기록한다.

```json
{
  "eval_id": "eval_20240615_143022",
  "skill_name": "code-review",
  "skill_version": "1.2.0",
  "timestamp": "2024-06-15T14:30:22Z",
  "config": {
    "model": "sonnet",
    "temperature": 0,
    "max_tokens": 4096
  },
  "test_cases": {
    "total": 10,
    "executed": 10,
    "skipped": 0
  },
  "environment": {
    "platform": "linux",
    "node_version": "20.x",
    "python_version": "3.11"
  }
}
```

### 6.2 grading.json

채점 결과를 기록한다.

```json
{
  "eval_id": "eval_20240615_143022",
  "overall_score": 0.85,
  "grade": "B+",
  "results": [
    {
      "test_id": "test_001",
      "test_name": "기본 리뷰 정확도",
      "score": 1.0,
      "max_score": 1.0,
      "assertions": [
        {
          "type": "contains",
          "expected": "null check",
          "actual": "null check가 필요합니다",
          "passed": true
        }
      ]
    },
    {
      "test_id": "test_002",
      "test_name": "보안 이슈 탐지",
      "score": 0.5,
      "max_score": 1.0,
      "assertions": [
        {
          "type": "contains",
          "expected": "SQL injection",
          "actual": "입력 검증이 필요합니다",
          "passed": false,
          "note": "SQL injection을 명시적으로 언급하지 않음"
        }
      ]
    }
  ],
  "summary": {
    "pass_rate": 0.85,
    "mean_score": 0.85,
    "by_category": {
      "accuracy": 0.9,
      "completeness": 0.8,
      "format": 1.0
    }
  }
}
```

### 6.3 timing.json

실행 시간을 기록한다.

```json
{
  "eval_id": "eval_20240615_143022",
  "total_duration_ms": 45230,
  "phases": [
    {
      "name": "skill_load",
      "duration_ms": 120
    },
    {
      "name": "context_build",
      "duration_ms": 3500
    },
    {
      "name": "agent_execution",
      "duration_ms": 38000,
      "details": {
        "agent_count": 3,
        "parallel": true,
        "per_agent": [
          { "agent": "reviewer_1", "duration_ms": 35000 },
          { "agent": "reviewer_2", "duration_ms": 38000 },
          { "agent": "reviewer_3", "duration_ms": 32000 }
        ]
      }
    },
    {
      "name": "aggregation",
      "duration_ms": 3610
    }
  ],
  "token_usage": {
    "input_tokens": 15000,
    "output_tokens": 3200,
    "total_tokens": 18200
  }
}
```

---

## 7. 스킬 재사용 설계

### 7.1 재사용 가능한 스킬의 조건

1. **입력이 파라미터화됨**: 하드코딩된 값이 아닌 사용자 입력에 의존
2. **도메인 독립적**: 특정 프로젝트에 종속되지 않음
3. **출력이 표준화됨**: 다른 스킬이 소비할 수 있는 형식
4. **부작용이 제한적**: 예측 가능한 범위의 파일 변경만 수행

### 7.2 스킬 합성 패턴

작은 스킬을 조합하여 큰 워크플로우를 구성한다.

```
workflow-skill.md:
  1. Skill("analyze") 로드 -> 분석 가이드 적용
  2. Skill("review") 로드 -> 리뷰 기준 적용
  3. Skill("report") 로드 -> 보고서 형식 적용
```

### 7.3 버전 관리 고려사항

- 스킬의 출력 형식을 변경하면 이를 소비하는 다른 스킬/에이전트도 업데이트해야 한다
- 레퍼런스 파일은 독립적으로 업데이트 가능하다
- description의 트리거 조건 변경은 기존 워크플로우에 영향을 줄 수 있다

### 7.4 스킬 디렉토리 구조 표준

```
.claude/skills/
    [skill-name]/
        skill.md                  # 스킬 본문 (필수)
        references/               # 레퍼런스 파일 (선택)
            guide.md
            examples.md
            checklist.md
        scripts/                  # 실행 스크립트 (선택)
            run.sh
            process.py
        tests/                    # 테스트 프롬프트 (선택)
            test_basic.txt
            test_edge.txt
```

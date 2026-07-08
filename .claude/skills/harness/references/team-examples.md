# 팀 구성 예제

## 예제 1: 리서치 팀 (팬아웃/팬인)

### 개요
다중 소스에서 병렬로 정보를 수집하고 종합하는 리서치 팀. 4명의 Researcher가 독립적으로 조사하고 Orchestrator가 결과를 종합한다.

### 아키텍처
```
[Orchestrator]
    |
    +-- Agent(Researcher 1: 학술 논문) ----+
    +-- Agent(Researcher 2: 기술 블로그) ---+-- [Orchestrator: 종합]
    +-- Agent(Researcher 3: 공식 문서) ----+
    +-- Agent(Researcher 4: 커뮤니티) -----+
```

**패턴**: 팬아웃/팬인
**모드**: 서브 에이전트 (에이전트 간 통신 불필요)

### 에이전트 구성

| 에이전트 | 타입 | 모델 | 역할 |
|---------|------|------|------|
| Orchestrator | 스킬 | - | 주제 분할, 결과 종합 |
| Researcher 1 | general-purpose | sonnet | 학술/연구 소스 조사 |
| Researcher 2 | general-purpose | sonnet | 기술 블로그/아티클 조사 |
| Researcher 3 | general-purpose | sonnet | 공식 문서/레퍼런스 조사 |
| Researcher 4 | general-purpose | sonnet | 커뮤니티 토론/사례 조사 |

### 데이터 흐름

```
입력: { topic: "WebAssembly 성능 최적화", depth: "detailed" }

Phase 0:
  - 주제 분석 -> 핵심 질문 4개 도출
  - 각 Researcher에게 1개 질문 + 소스 유형 할당

Phase 1 (팬아웃):
  Researcher 1 -> { findings: [...], sources: [...], confidence: 0.8 }
  Researcher 2 -> { findings: [...], sources: [...], confidence: 0.9 }
  Researcher 3 -> { findings: [...], sources: [...], confidence: 0.95 }
  Researcher 4 -> { findings: [...], sources: [...], confidence: 0.7 }

Phase 2 (팬인):
  Orchestrator -> {
    summary: "종합 요약",
    key_findings: [...],       // 교차 검증된 발견
    contradictions: [...],     // 소스 간 상충
    sources: [...],            // 전체 출처 목록
    confidence: 0.85           // 종합 신뢰도
  }
```

### Orchestrator 스킬 핵심 로직

```
## Phase 0: 주제 분석
1. 사용자 입력에서 핵심 주제와 세부 질문을 추출한다
2. 질문을 4개 소스 유형에 배분한다
3. 각 Researcher에게 전달할 프롬프트를 구성한다

## Phase 1: 병렬 리서치
4명의 Researcher를 run_in_background: true로 동시 실행한다.

각 Researcher 프롬프트:
- 담당 소스 유형 명시
- 핵심 질문 제공
- 출력 형식 (findings, sources, confidence) 지정
- 최대 5개 소스로 제한

## Phase 2: 결과 종합
1. 4개 결과에서 공통 발견을 추출한다 (교차 검증)
2. 상충하는 내용을 식별하고 더 신뢰할 수 있는 소스를 우선한다
3. 종합 보고서를 생성한다
```

### 에러 처리
- Researcher 1개 실패: 나머지 3개 결과로 종합 (실패 소스 유형 표기)
- Researcher 2개 이상 실패: 사용자에게 부분 결과임을 고지
- 전체 실패: Orchestrator가 단독 조사로 전환

---

## 예제 2: SF 소설 집필 팀 (파이프라인 + 팬아웃)

### 개요
SF 소설을 기획부터 집필까지 진행하는 팀. 세계관 설계 -> 캐릭터 설계 -> 챕터 병렬 집필 -> 편집 순서로 파이프라인을 구성하되, 챕터 집필 단계에서 팬아웃한다.

### 아키텍처
```
[World Builder] --> [Character Designer] --> 팬아웃 [Chapter Writers] --> [Editor]
     (순차)            (순차)               (병렬)                  (순차)
```

**패턴**: 파이프라인 + 팬아웃
**모드**: 서브 에이전트

### 에이전트 구성

| 에이전트 | 타입 | 모델 | 역할 |
|---------|------|------|------|
| Orchestrator | 스킬 | - | 파이프라인 관리 |
| World Builder | general-purpose | opus | 세계관/설정 설계 |
| Character Designer | general-purpose | opus | 캐릭터 설계 |
| Chapter Writer x N | general-purpose | sonnet | 각 챕터 집필 |
| Editor | general-purpose | opus | 통합 편집/교정 |

### 데이터 흐름

```
입력: { genre: "hard SF", theme: "AI 의식", chapters: 5 }

Stage 1 - World Builder:
  입력: 장르, 테마
  출력: {
    setting: { time: "2157", location: "..." },
    technology: [...],
    rules: [...],
    factions: [...]
  }

Stage 2 - Character Designer:
  입력: Stage 1 세계관
  출력: {
    characters: [
      { name: "...", role: "...", arc: "...", relationships: [...] }
    ],
    plot_outline: { chapters: [...] }
  }

Stage 3 - Chapter Writers (팬아웃):
  입력: 세계관 + 캐릭터 + 해당 챕터 아웃라인
  각 Writer 출력: { chapter_number: N, content: "...", word_count: N }

Stage 4 - Editor:
  입력: 전체 챕터 + 세계관 + 캐릭터 설정
  출력: {
    final_manuscript: "...",
    consistency_notes: [...],
    edits_made: [...]
  }
```

### 핵심 설계 포인트

1. **컨텍스트 전달**: 각 단계의 출력이 다음 단계의 필수 입력. 세계관/캐릭터 정보는 모든 Chapter Writer에게 전달.
2. **챕터 간 일관성**: 각 Writer에게 이전 챕터 요약 + 이후 챕터 아웃라인을 함께 제공.
3. **편집 단계**: Editor는 전체 원고를 받아 일관성 검증 + 문체 통일 수행.

---

## 예제 3: 웹툰 제작 팀 (서브 에이전트, 생성-검증)

### 개요
웹툰의 스토리 작성부터 이미지 프롬프트 생성, QA 검증까지 수행하는 팀. 생성-검증 패턴으로 품질을 관리한다.

### 아키텍처
```
[Story Writer] --> [Visual Designer] --> [QA Checker]
                        |                    |
                        +-- 수정 요청 <------+  (검증 루프)
```

**패턴**: 파이프라인 + 생성-검증
**모드**: 서브 에이전트

### 에이전트 구성

| 에이전트 | 타입 | 모델 | 역할 |
|---------|------|------|------|
| Orchestrator | 스킬 | - | 워크플로우 관리, 검증 루프 제어 |
| Story Writer | general-purpose | opus | 에피소드 스토리/대사 작성 |
| Visual Designer | general-purpose | sonnet | 컷별 이미지 프롬프트/레이아웃 생성 |
| QA Checker | general-purpose | sonnet | 스토리-비주얼 일관성 검증 |

### 생성-검증 루프

```
attempt = 0
max_attempts = 3

while attempt < max_attempts:
    # 생성
    visual_result = Agent(
        prompt=f"스토리를 기반으로 비주얼 설계:\n{story}\n이전 피드백: {feedback}",
        subagent_type="general-purpose"
    )

    # 검증
    qa_result = Agent(
        prompt=f"다음 비주얼이 스토리와 일관적인지 검증:\n스토리: {story}\n비주얼: {visual_result}",
        subagent_type="general-purpose"
    )

    if qa_result.pass:
        break
    else:
        feedback = qa_result.issues
        attempt += 1
```

### QA 체크리스트

QA Checker가 검증하는 항목:
- 캐릭터 외형 일관성 (헤어, 의상, 체형)
- 배경 설정 일관성 (시간대, 장소)
- 대사 ↔ 표정/포즈 일치
- 컷 간 시간/공간 연속성
- 연출 의도와 레이아웃 적합성

### 최종 출력

```json
{
  "episode": {
    "title": "...",
    "cuts": [
      {
        "cut_number": 1,
        "dialogue": "...",
        "image_prompt": "...",
        "layout": "...",
        "emotion": "..."
      }
    ]
  },
  "qa_report": {
    "passed": true,
    "attempts": 2,
    "resolved_issues": [...]
  }
}
```

---

## 예제 4: 코드 리뷰 팀 (팬아웃/팬인 + 토론)

### 개요
코드 변경사항을 다관점으로 리뷰한 뒤 리뷰어 간 토론을 통해 합의된 리뷰를 제출하는 팀.

### 아키텍처
```
Phase 1 (팬아웃):
    +-- [Security Reviewer] --+
    +-- [Perf Reviewer] ------+--> Phase 2 (토론)
    +-- [Style Reviewer] -----+        |
                                      v
                               [합의된 리뷰]
```

**패턴**: 팬아웃/팬인 + 토론
**모드**: 하이브리드 (Phase 1: 서브 에이전트, Phase 2: 에이전트 팀)

### 에이전트 구성

| 에이전트 | 타입 | 모델 | 역할 |
|---------|------|------|------|
| Orchestrator | 스킬 | - | 리뷰 조율, 토론 관리 |
| Security Reviewer | Explore | sonnet | 보안 취약점 검사 |
| Performance Reviewer | Explore | sonnet | 성능 이슈 검사 |
| Style Reviewer | Explore | sonnet | 코드 스타일/패턴 검사 |
| Moderator | general-purpose | opus | 토론 중재, 최종 리뷰 작성 |

### Phase 1: 독립 리뷰 (팬아웃)

3명의 Reviewer를 병렬 실행한다. 각 Reviewer는 자신의 전문 관점에서만 리뷰한다.

```
각 Reviewer 출력:
{
  "findings": [
    {
      "severity": "high|medium|low",
      "file": "path/to/file",
      "line": 42,
      "issue": "설명",
      "suggestion": "개선안"
    }
  ]
}
```

### Phase 2: 토론 (에이전트 팀)

팬인된 결과에서 상충하는 의견이 있으면 토론을 진행한다.

```
예시 상충:
- Security: "이 함수는 입력 검증이 필요하다" (성능 비용 증가)
- Performance: "입력 검증은 핫패스에서 불필요한 오버헤드다"

Moderator가 두 의견을 검토하고 최종 판단:
- 보안 리스크 수준 평가
- 성능 영향 범위 평가
- 합의점 도출 또는 다수결
```

### Phase 3: 최종 리뷰

Moderator가 합의된 리뷰를 구조화된 형식으로 작성한다.

```
최종 출력:
{
  "summary": "리뷰 요약 (1-2문장)",
  "verdict": "approve|request_changes|comment",
  "findings": [...],     // 우선순위 정렬
  "discussion_log": [...] // 토론 내역 (선택)
}
```

### 토론 규칙
- 최대 3라운드
- 각 라운드에서 각 리뷰어가 1회 발언
- Moderator가 합의 여부 판단
- 합의 실패 시 Moderator가 최종 결정

---

## 예제 5: 코드 마이그레이션 팀 (감독자)

### 개요
대규모 코드베이스의 프레임워크/라이브러리 마이그레이션을 관리하는 팀. Supervisor가 작업을 분배하고 진행 상태를 모니터링하며 실패 시 재배정한다.

### 아키텍처
```
[Supervisor]
    |
    +-- 작업 분석 --> 모듈별 작업 목록 생성
    |
    +-- [Worker 1: 모듈 A 마이그레이션]
    +-- [Worker 2: 모듈 B 마이그레이션]
    +-- [Worker 3: 모듈 C 마이그레이션]
    |
    +-- 상태 모니터링
    +-- 실패 작업 재배정
    +-- 의존성 충돌 해결
    |
    +-- [Validator: 전체 빌드/테스트 확인]
```

**패턴**: 감독자
**모드**: 에이전트 팀

### 에이전트 구성

| 에이전트 | 타입 | 모델 | 역할 |
|---------|------|------|------|
| Supervisor | 스킬 + general-purpose | opus | 작업 분배, 상태 관리, 충돌 해결 |
| Analyzer | Explore | sonnet | 코드베이스 분석, 의존성 매핑 |
| Worker x N | general-purpose | sonnet | 모듈별 마이그레이션 실행 |
| Validator | general-purpose | sonnet | 빌드/테스트 검증 |

### 워크플로우

```
Step 1: 분석
  Analyzer가 코드베이스를 스캔하여 마이그레이션 대상 목록 생성
  의존성 그래프를 파악하여 실행 순서 결정

Step 2: 계획
  Supervisor가 분석 결과를 기반으로 작업 계획 수립
  - 의존성이 없는 모듈: 병렬 실행
  - 의존성이 있는 모듈: 순서 보장

Step 3: 실행
  Worker들에게 작업 배분
  각 Worker는 isolation: "worktree"로 독립 환경에서 작업

Step 4: 모니터링
  Supervisor가 주기적으로 상태 확인
  - 완료된 Worker의 결과 수집
  - 실패한 Worker의 에러 분석 및 재배정
  - 의존성 충돌 발견 시 조정

Step 5: 통합
  모든 Worker 완료 후 변경사항 통합
  Validator가 전체 빌드 및 테스트 실행

Step 6: 보고
  마이그레이션 결과 보고서 생성
```

### 감독자 상태 관리

```json
{
  "tasks": {
    "module_a": { "status": "completed", "worker": "worker_1", "attempts": 1 },
    "module_b": { "status": "in_progress", "worker": "worker_2", "attempts": 1 },
    "module_c": { "status": "failed", "worker": "worker_3", "attempts": 2, "error": "..." },
    "module_d": { "status": "pending", "depends_on": ["module_a"] }
  },
  "progress": "2/4 completed",
  "blockers": ["module_c 반복 실패 - 수동 개입 필요"]
}
```

### 실패 복구 전략

| 실패 유형 | 대응 |
|----------|------|
| 컴파일 에러 | Worker에게 에러 메시지와 함께 재시도 지시 |
| 테스트 실패 | 실패 테스트 정보를 포함하여 재작업 지시 |
| 의존성 충돌 | Supervisor가 충돌 모듈을 분석하고 해결 방안 제시 |
| 3회 실패 | 해당 모듈을 "수동 개입 필요"로 표시하고 나머지 진행 |

### 최종 보고서

```json
{
  "migration_summary": {
    "total_modules": 10,
    "completed": 8,
    "failed": 1,
    "skipped": 1,
    "total_files_changed": 156,
    "total_lines_changed": 2340
  },
  "per_module": [...],
  "manual_intervention_needed": ["module_c: 순환 의존성 해결 필요"],
  "validation": {
    "build": "pass",
    "tests": { "total": 450, "passed": 448, "failed": 2 }
  }
}
```

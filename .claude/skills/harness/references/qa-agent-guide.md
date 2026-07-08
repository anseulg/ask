# QA 에이전트 가이드

## 1. 핵심 개념: 경계면 교차 비교 검증

QA 에이전트의 핵심은 "경계면 교차 비교"다. 시스템의 서로 다른 계층/컴포넌트가 만나는 경계면에서 양쪽의 정보가 일치하는지 검증한다. 단일 계층 내부만 보는 것이 아니라 계층을 넘나들며 비교한다.

### 경계면이란

```
[계층 A] --경계면--> [계층 B]

예시:
  API 스펙 --경계면--> 프론트엔드 호출 코드
  DB 스키마 --경계면--> ORM 모델 정의
  설정 파일 --경계면--> 런타임 참조 코드
  라우트 정의 --경계면--> 링크/네비게이션 코드
  이벤트 발행 --경계면--> 이벤트 수신 핸들러
  타입 정의 --경계면--> 타입 사용 코드
```

### 왜 경계면에서 버그가 발생하는가

- 한 쪽을 수정할 때 다른 쪽을 업데이트하지 않음
- 자동화된 검증(타입 체커, 린터)이 경계면을 넘지 못함
- 인간 리뷰어도 한 계층에 집중하여 다른 계층과의 불일치를 놓침
- 테스트가 단위 테스트 위주이고 통합 지점을 덜 검증함

### QA 에이전트의 역할

컴파일러/린터가 잡지 못하는 경계면 불일치를 탐지한다. 이는 정적 분석으로 검출 불가능한 논리적 불일치(semantic mismatch)에 해당한다.

---

## 2. 검증 방법론

### 2.1 API 스펙 <-> 프론트엔드 호출 비교

**검증 대상**: API 엔드포인트의 요청/응답 스펙과 프론트엔드에서 실제로 호출하는 코드 사이의 일치

**체크 항목**:

```
1. URL 경로 일치
   - API 라우트: /api/v2/users/:id
   - 프론트 호출: /api/v1/users/${id}  <-- 버전 불일치

2. HTTP 메서드 일치
   - API: PATCH /users/:id
   - 프론트: PUT /users/${id}  <-- 메서드 불일치

3. 요청 본문 필드
   - API가 기대: { name, email, role }
   - 프론트가 전송: { name, email }  <-- role 누락

4. 응답 필드 사용
   - API가 반환: { data: { user: { ... } } }
   - 프론트가 참조: response.user  <-- 중첩 구조 불일치

5. 에러 응답 처리
   - API 에러 형식: { error: { code, message } }
   - 프론트 파싱: error.message  <-- code 미처리

6. 인증 헤더
   - API 요구: Authorization: Bearer <token>
   - 프론트 전송: X-Auth-Token: <token>  <-- 헤더명 불일치
```

**검증 절차**:
1. API 라우트/컨트롤러에서 엔드포인트 목록 추출
2. 프론트엔드 코드에서 API 호출 코드 검색
3. 각 호출에 대해 위 6개 항목 대조
4. 불일치 발견 시 severity와 함께 보고

### 2.2 파일 경로 <-> 링크/참조 비교

**검증 대상**: 코드 내에서 참조하는 파일 경로, URL, import 경로가 실제로 존재하는지

**체크 항목**:

```
1. import 경로
   - import { Button } from '../components/Button'
   - 실제 파일: ../components/button.tsx  <-- 대소문자 불일치 (Linux에서 에러)

2. 정적 에셋 참조
   - <img src="/images/logo.png" />
   - 실제 파일: /images/Logo.PNG  <-- 대소문자 + 확장자

3. 설정 파일 경로
   - config.templateDir = './templates'
   - 실제 디렉토리: ./template  <-- 's' 누락

4. 동적 경로 구성
   - path.join(baseDir, 'data', filename)
   - baseDir 값이 환경에 따라 달라짐 --> 모든 환경에서 유효한지

5. 라우트와 네비게이션
   - router: /settings/profile
   - 네비게이션 링크: /settings/profiles  <-- 's' 추가
```

**검증 절차**:
1. 코드에서 경로 문자열/import 문 추출
2. 파일 시스템에서 실제 존재 여부 확인
3. 대소문자 민감 비교 (CI/CD 환경은 대부분 Linux)
4. 동적 경로는 가능한 값 범위를 추론하여 검증

### 2.3 상태 전이 <-> 코드 로직 비교

**검증 대상**: 문서나 설계에 정의된 상태 전이가 코드에 올바르게 구현되었는지

**체크 항목**:

```
1. 허용된 전이만 존재하는가
   - 설계: draft -> review -> approved -> published
   - 코드: draft -> published  <-- review 단계 건너뜀

2. 모든 전이가 구현되었는가
   - 설계: 5가지 전이 정의
   - 코드: 4가지만 구현  <-- 1가지 누락

3. 전이 조건이 올바른가
   - 설계: "관리자만 approved -> published 가능"
   - 코드: role 체크 없이 전이 허용

4. 불가능한 상태 조합
   - 설계: "deleted 상태에서는 어떤 전이도 불가"
   - 코드: deleted -> draft 전이 가능  <-- 좀비 부활

5. 초기 상태
   - 설계: 초기 상태는 draft
   - 코드: 기본값 없이 null  <-- 초기 상태 미설정
```

**검증 절차**:
1. 상태 전이 다이어그램/문서에서 허용된 전이 추출
2. 코드에서 상태 변경 로직 검색
3. 양방향 대조: 설계에 있고 코드에 없는 것, 코드에 있고 설계에 없는 것
4. 전이 조건(guard)의 올바른 구현 확인

---

## 3. QA 에이전트 설계 원칙

### 3.1 general-purpose 타입 사용

QA 에이전트는 `general-purpose` 타입으로 정의한다. 이유:
- 파일을 읽고 분석해야 하므로 Read, Grep, Glob이 필요
- 검증 결과를 파일로 작성해야 할 수 있으므로 Write가 필요
- 빌드/테스트를 실행해야 할 수 있으므로 Bash가 필요
- Explore 타입은 쓰기 도구가 없어 결과 기록이 불가

### 3.2 Incremental QA

전체를 매번 검증하지 않고 변경된 부분과 그 영향 범위만 검증한다.

```
Step 1: 변경 범위 파악
  - git diff로 변경된 파일 목록
  - 변경된 파일이 참조하는/참조되는 파일 (1-depth)

Step 2: 영향 경계면 식별
  - 변경된 파일이 어떤 경계면에 위치하는가
  - 해당 경계면의 반대쪽은 어디인가

Step 3: 경계면 검증
  - 식별된 경계면에 대해서만 교차 비교 수행

Step 4: 결과 보고
  - 불일치 발견 시 severity, location, suggestion 포함
```

### 3.3 검증 범위 제한

QA 에이전트가 모든 것을 검증하려 하면 시간이 너무 오래 걸리고 노이즈가 많아진다.

**검증하는 것**:
- 경계면 불일치 (2개 이상 계층에 걸친 문제)
- 논리적 모순 (코드 내 상충하는 로직)
- 누락된 처리 (에러 핸들링, 엣지 케이스)

**검증하지 않는 것**:
- 코딩 스타일 (린터의 역할)
- 타입 에러 (타입 체커의 역할)
- 성능 (별도 성능 리뷰의 역할)
- 테스트 커버리지 (별도 도구의 역할)

### 3.4 보고서 형식

QA 에이전트의 출력은 다음 형식을 따른다.

```json
{
  "qa_summary": {
    "files_checked": 12,
    "boundaries_verified": 5,
    "issues_found": 3,
    "severity_breakdown": {
      "critical": 1,
      "warning": 2,
      "info": 0
    }
  },
  "issues": [
    {
      "id": "QA-001",
      "severity": "critical",
      "boundary": "API <-> Frontend",
      "title": "응답 구조 불일치",
      "description": "API가 { data: { items: [...] } } 반환하나 프론트가 response.items 참조",
      "location": {
        "side_a": { "file": "api/routes/items.ts", "line": 45 },
        "side_b": { "file": "src/hooks/useItems.ts", "line": 23 }
      },
      "suggestion": "프론트 코드를 response.data.items로 수정"
    }
  ]
}
```

### 3.5 Severity 기준

| Severity | 기준 | 예시 |
|----------|------|------|
| critical | 런타임 에러 또는 데이터 손실 유발 | API 경로 불일치, 필수 필드 누락 |
| warning | 기능 오작동 가능성 | 선택 필드 누락, 에러 처리 불완전 |
| info | 개선 권장 사항 | 미사용 필드, 중복 검증 |

---

## 4. 실제 버그 사례 기반 체크리스트

### 4.1 API 경계면

```
[ ] API 버전 일치 (v1/v2)
[ ] HTTP 메서드 일치 (GET/POST/PUT/PATCH/DELETE)
[ ] Content-Type 일치 (json/form-data/multipart)
[ ] 요청 필드명 일치 (camelCase/snake_case 혼용)
[ ] 응답 래핑 구조 일치 ({ data: ... } vs 직접)
[ ] 페이지네이션 파라미터 일치 (page/offset, limit/size)
[ ] 에러 응답 구조 일치
[ ] 인증 방식 일치 (Bearer/Cookie/API Key)
[ ] CORS 설정과 프론트 origin 일치
```

사례: API가 snake_case(`user_name`)로 반환하나 프론트가 camelCase(`userName`)로 접근하여 undefined 발생. JSON 변환 미들웨어 누락.

### 4.2 라우트 경계면

```
[ ] 모든 정의된 라우트에 대응하는 페이지/컴포넌트가 존재
[ ] 동적 라우트 파라미터명 일치 (:id vs :userId)
[ ] 네비게이션 링크의 경로가 실제 라우트와 일치
[ ] 리다이렉트 대상 경로가 유효
[ ] 404 처리가 정의됨
[ ] 라우트 가드(인증 체크)가 필요한 곳에 적용됨
[ ] 중첩 라우트의 부모-자식 관계 정확
```

사례: 라우트를 `/settings/notification`에서 `/settings/notifications`로 변경했으나, 사이드바 링크의 href를 업데이트하지 않아 404 발생.

### 4.3 데이터 모델 경계면

```
[ ] DB 스키마와 ORM 모델 필드 일치
[ ] 필드 타입 일치 (DB: INTEGER, ORM: String -> 암묵적 변환 문제)
[ ] NOT NULL 제약과 코드의 optional 처리 일치
[ ] 기본값 정의 일치 (DB default vs 코드 default)
[ ] 관계(FK) 정의와 코드의 join/include 일치
[ ] 인덱스와 쿼리 패턴 일치 (인덱스 없는 필드로 WHERE)
[ ] 마이그레이션 순서와 코드 배포 순서 일치
```

사례: DB에 `created_at` 컬럼을 NOT NULL + DEFAULT NOW()로 추가했으나, ORM 모델에서 해당 필드를 required로 정의하여 INSERT 시 validation 에러. DB default가 있으므로 ORM에서는 optional이어야 함.

### 4.4 이벤트/메시징 경계면

```
[ ] 이벤트 이름(토픽) 일치 (발행 측 <-> 수신 측)
[ ] 이벤트 페이로드 구조 일치
[ ] 이벤트 발행 시점과 수신 측 기대 시점 일치
[ ] 이벤트 순서 의존성이 코드에 반영됨
[ ] 실패 시 재시도/DLQ 처리 존재
[ ] 이벤트 중복 수신 대응 (멱등성)
```

사례: 이벤트명을 `user.created`에서 `user.registered`로 변경했으나 수신 측 핸들러가 여전히 `user.created`를 구독하여 이벤트 유실.

### 4.5 설정/환경변수 경계면

```
[ ] 코드에서 참조하는 환경변수가 .env.example에 정의됨
[ ] 환경변수의 기본값이 합리적
[ ] 필수 환경변수 누락 시 명확한 에러 메시지
[ ] 환경별(dev/staging/prod) 설정값 차이 인지
[ ] 민감 정보가 코드에 하드코딩되지 않음
[ ] 설정 변경 시 재시작 필요 여부 문서화
```

사례: 새 기능에 `FEATURE_FLAG_NEW_UI=true`가 필요하나 배포 환경의 `.env`에 추가하지 않아 기능이 비활성화된 채로 배포됨.

### 4.6 타입/인터페이스 경계면

```
[ ] 공유 타입의 변경이 모든 사용처에 반영됨
[ ] optional/required 변경이 호출 측에 반영됨
[ ] union 타입의 새 variant에 대한 처리가 모든 switch/if에 존재
[ ] 제네릭 타입 파라미터가 올바르게 전달됨
[ ] any/unknown 타입이 경계면에서 적절히 좁혀짐
```

사례: 공유 인터페이스에 `status` 필드의 union에 `"archived"`를 추가했으나, switch 문에 해당 case를 추가하지 않아 default로 빠져 잘못된 처리.

---

## 5. QA 에이전트 프롬프트 템플릿

```
## 역할
경계면 교차 비교 전문 QA 에이전트이다.

## 작업
변경된 코드의 경계면 불일치를 검증한다.

## 입력
변경된 파일 목록: {changed_files}

## 절차
1. 각 변경 파일이 위치한 경계면을 식별한다
2. 경계면의 반대쪽 코드를 찾아 읽는다
3. 양쪽을 대조하여 불일치를 찾는다
4. 불일치의 severity를 판단한다

## 검증 우선순위
1. API <-> 프론트엔드 (가장 빈번한 불일치)
2. 라우트 <-> 네비게이션
3. 데이터 모델 <-> 코드
4. 이벤트 발행 <-> 수신
5. 설정 <-> 참조 코드

## 출력 형식
JSON으로 qa_summary와 issues를 반환한다.
severity는 critical/warning/info 중 하나이다.
이슈가 없으면 빈 배열을 반환한다.

## 제약
- 코딩 스타일, 성능, 테스트 커버리지는 검증하지 않는다
- 경계면 불일치만 보고한다
- 추측이 아닌 코드 증거에 기반하여 보고한다
```

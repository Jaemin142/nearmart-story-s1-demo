# NearMart Story v1 · Node 배포본

이 폴더는 기존 NearMart HTML·CSS·JavaScript, 로그인 화면과 dashboard/server.mjs를 포함합니다. C+와 C의 읽기 전용 스냅샷, S1 화면용 어댑터, 427동 지리 자료, BM·수요·시뮬레이션·What-if 화면용 저장 JSON을 포함합니다. 원본 계산 엔진과 ZIP은 포함하거나 실행하지 않습니다. S6 레거시는 이 휴대용 배포본에서 비활성화합니다.

## 로컬 검사

Node.js 24 이상을 설치하고 아래 환경 변수를 설정한 뒤, 이 폴더에서 node dashboard/server.mjs를 실행합니다.

- NEARMART_USERNAME=배포용_아이디
- NEARMART_PASSWORD=강한_배포용_비밀번호
- PORT=4173 (로컬) / 호스팅 플랫폼 제공 PORT
- HOST=127.0.0.1 (로컬) / 0.0.0.0 (호스팅)

배포 모드에서는 로그인 아이디·비밀번호가 없으면 서버가 시작하지 않습니다. HTTPS에서는 로그인 쿠키에 Secure가 적용됩니다. /healthz는 상태 확인용이고 화면·API는 로그인 후 접근할 수 있습니다.

## 웹 배포

이 폴더를 Git 저장소 루트로 올린 뒤 Render Web Service 같은 Node/Docker 호스팅에 연결합니다. Render Blueprint용 render.yaml과 Dockerfile을 포함했습니다. 배포 설정에서 NEARMART_USERNAME과 NEARMART_PASSWORD를 비밀 환경 변수로 넣습니다. 포트는 호스팅 플랫폼의 PORT를 사용하며 서버는 0.0.0.0에 바인딩합니다.

HTTPS 배포 후 /login에서 로그인하고 /, /investment, /decision을 확인합니다. 또한 /dispatch의 BM 조작과 /simulation의 조건 선택을 확인합니다. 현재 연결된 Node 호스팅 계정과 공개 URL은 없습니다. 실제 HTTPS 공개 URL에서 로그인과 화면 검수 전에는 배포 완료로 판단하지 않습니다.

현재 세이브본: NearMart-dashboard-S1-save-20261113.zip. 정적 HTML ZIP과 달리 이 묶음은 기존 로그인과 Node API를 사용합니다.

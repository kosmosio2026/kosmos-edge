Sensor System — README (Korean)
이 프로젝트는 두 개의 주요 구성 요소로 이루어져 있습니다.
1. 	sensor-daemon — MQTT 업링크 메시지를 수신하고 PostgreSQL에 센서 데이터를 저장하는 Rust 기반 데몬
2. 	web-dashboard — 저장된 센서 데이터를 시각화하는 Node.js 기반 웹 대시보드
두 구성 요소는 독립적으로 실행되지만 같은 PostgreSQL 데이터베이스를 사용합니다.

🏗️ 1. 요구 사항
시스템 의존성
• 	Rust (stable)
• 	Cargo
• 	Node.js (v16 이상 권장)
• 	npm
• 	PostgreSQL (이 설정에서는 포트 )
• 	MQTT 브로커 (예: Mosquitto)

🗄️ 2. 데이터베이스 설정
PostgreSQL 연결 문자열:

비밀번호에 가 포함되어 있으므로 항상 작은따옴표(') 로 감싸야 합니다.
예:


🔐 3. 환경 변수 설정 (.env 파일 사용)
프로젝트 루트에  파일을 생성합니다.
예시:

TLS를 사용하는 경우:

Rust 데몬과 웹 대시보드 모두  파일을 자동으로 읽도록 구성할 수 있습니다.

🧩 4. Rust sensor-daemon 실행 방법
1)  파일 로드
Rust에서는  또는  crate를 사용하여 를 자동 로드합니다.
(이미 프로젝트에 포함되어 있다면 별도 작업 필요 없음)
2) 데이터베이스 마이그레이션 실행

가 없다면:

3) 데몬 실행
개발 모드:

프로덕션 모드:

실행 시 다음과 같은 로그가 출력됩니다:


🌐 5. Web Dashboard 실행 방법
대시보드 디렉토리로 이동:

1) 의존성 설치

2) 서버 실행

또는

기본적으로 다음 주소에서 접속할 수 있습니다:


🛑 6. Web Dashboard 종료 방법
 또는 로 실행한 경우

백그라운드에서 실행 중인 경우

pm2로 실행한 경우


🔧 7. (선택) systemd 서비스로 실행하기
sensor-daemon systemd 서비스 예시


활성화:


📊 8. 데이터 확인 방법
PostgreSQL 접속:

예시 쿼리:


✔️ 요약
• 	Rust 데몬과 웹 대시보드는  파일로 환경 변수를 관리
• 	 또는 로 데몬 실행
• 	로 대시보드 실행
• 	PostgreSQL에서 데이터 확인 가능
• 	필요 시 systemd로 자동 실행 설정 가능

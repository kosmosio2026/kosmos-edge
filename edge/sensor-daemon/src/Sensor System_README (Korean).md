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
postgres://postgres:yk9141428!@localhost:5435/sensor_data

비밀번호에 가 포함되어 있으므로 항상 작은따옴표(') 로 감싸야 합니다.
예:
psql 'postgres://postgres:yk9141428!@localhost:5435/sensor_data'

🔐 3. 환경 변수 설정 (.env 파일 사용)
프로젝트 루트에  파일을 생성합니다.
예시:
DATABASE_URL=postgres://postgres:yk9141428!@localhost:5435/sensor_data
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TLS=false

TLS를 사용하는 경우:
MQTT_TLS=true
MQTT_CA=./certs/ca.pem
MQTT_CERT=./certs/client.crt
MQTT_KEY=./certs/client.key

Rust 데몬과 웹 대시보드 모두  파일을 자동으로 읽도록 구성할 수 있습니다.

🧩 4. Rust sensor-daemon 실행 방법
1)  파일 로드
Rust에서는  또는  crate를 사용하여 를 자동 로드합니다.
(이미 프로젝트에 포함되어 있다면 별도 작업 필요 없음)
2) 데이터베이스 마이그레이션 실행
sqlx migrate run

sqlx가 없다면:
cargo install sqlx-cli --no-default-features --features postgres

3) 데몬 실행
개발 모드:
cargo run
cargo build --release
./target/release/sensor-daemon

프로덕션 모드:

실행 시 다음과 같은 로그가 출력됩니다:
Connected to PostgreSQL
Connected to MQTT broker
Subscribed to application uplinks


🌐 5. Web Dashboard 실행 방법
대시보드 디렉토리로 이동:
cd web-dashboard

1) 의존성 설치
npm install

2) 서버 실행
npm start
또는
node server.js
기본적으로 다음 주소에서 접속할 수 있습니다:
http://localhost:3000

🛑 6. Web Dashboard 종료 방법
 npm start 또는 node server.js로 실행한 경우
Ctrl + C

백그라운드에서 실행 중인 경우
ps aux | grep node
kill <PID>

pm2로 실행한 경우
pm2 stop web-dashboard

🔧 7. (선택) systemd 서비스로 실행하기
sensor-daemon systemd 서비스 예시
/etc/systemd/system/sensor-daemon.service

[Unit]
Description=Sensor Daemon
After=network.target

[Service]
WorkingDirectory=/root/sensor-daemon
ExecStart=/root/sensor-daemon/target/release/sensor-daemon
EnvironmentFile=/root/sensor-daemon/.env
Restart=always
User=root

[Install]
WantedBy=multi-user.target


활성화:
systemctl daemon-reload
systemctl enable sensor-daemon
systemctl start sensor-daemon

📊 8. 데이터 확인 방법
PostgreSQL 접속:
psql 'postgres://postgres:yk9141428!@localhost:5435/sensor_data'

예시 쿼리:
SELECT * FROM parking_sensor_data ORDER BY id DESC LIMIT 20;
SELECT * FROM kosmos_tracker_data ORDER BY id DESC LIMIT 20;
SELECT * FROM sensio_env_data ORDER BY id DESC LIMIT 20;

9. PM2로 sensor-daemon 실행하기
PM2는 Node.js용 프로세스 매니저이지만, Rust로 빌드된 바이너리도 완벽하게 관리할 수 있습니다.
systemd를 사용하지 않고도 자동 재시작, 로그 관리, 백그라운드 실행이 가능합니다.
1) PM2 설치
npm install -g pm2


2) sensor-daemon 빌드
cd sensor-daemon
cargo build --release


빌드된 실행 파일:
target/release/sensor-daemon


3) .env 파일 준비
프로젝트 루트에 .env 파일이 있어야 합니다.
예:
DATABASE_URL=postgres://postgres:yk9141428!@localhost:5435/sensor_data
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_TLS=false


PM2는 .env 파일을 자동으로 읽지 않기 때문에, PM2 설정에서 직접 환경 변수를 지정해야 합니다.
4) PM2로 sensor-daemon 실행
pm2 start ./target/release/sensor-daemon --name sensor-daemon \
  --env production \
  --time


5) 환경 변수 적용 (선택)
PM2는 .env 파일을 자동으로 읽지 않으므로, 아래처럼 환경 변수를 직접 지정할 수 있습니다.
pm2 start ./target/release/sensor-daemon --name sensor-daemon --time --env production -- \
  DATABASE_URL='postgres://postgres:yk9141428!@localhost:5435/sensor_data' \
  MQTT_HOST=localhost \
  MQTT_PORT=1883 \
  MQTT_TLS=false


또는 ecosystem.config.js 파일을 만들어 관리할 수도 있습니다.
6) PM2 상태 확인
pm2 status


7) 로그 확인
pm2 logs sensor-daemon


8) 재시작
pm2 restart sensor-daemon


9) 서버 재부팅 시 자동 실행 설정
pm2 startup
pm2 save


이제 sensor-daemon은 서버가 재부팅되더라도 자동으로 실행됩니다.


✔️ 요약
• 	Rust 데몬과 웹 대시보드는  파일로 환경 변수를 관리
• 	 또는 로 데몬 실행
• 	로 대시보드 실행
• 	PostgreSQL에서 데이터 확인 가능
• 	필요 시 systemd로 자동 실행 설정 가능
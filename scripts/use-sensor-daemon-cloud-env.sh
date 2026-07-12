#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

cp edge/sensor-daemon/.env.cloud edge/sensor-daemon/.env
echo "sensor-daemon env -> cloud"
grep -E 'DATABASE_URL|MQTT_HOST|MQTT_PORT|PARKING_API_SENSOR_EVENT_URL' edge/sensor-daemon/.env

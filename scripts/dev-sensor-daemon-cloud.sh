#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/use-sensor-daemon-cloud-env.sh

cd edge/sensor-daemon
cargo run

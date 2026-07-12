import 'dotenv/config';
import { processOutbox, retryFailedOutbox } from './sync/sync.service';
import { processSensorStream } from './sync/sensor-stream.service';
import { sweepOfflineDevices } from './sync/device-health.service';
import { sweepUnregisteredViolations } from './sync/violation.service';

async function main() {
  console.log('Worker started');

  setInterval(async () => {
    try {
      await processOutbox();
    } catch (error) {
      console.error('processOutbox error', error);
    }
  }, 10000);

    setInterval(async () => {
    try {
      await sweepUnregisteredViolations();
    } catch (error) {
      console.error('sweepUnregisteredViolations error', error);
    }
  }, 60000);

  setInterval(async () => {
    try {
      await retryFailedOutbox();
    } catch (error) {
      console.error('retryFailedOutbox error', error);
    }
  }, 30000);

  setInterval(async () => {
    try {
      await sweepOfflineDevices();
    } catch (error) {
      console.error('sweepOfflineDevices error', error);
    }
  }, 60000);

  while (true) {
    try {
      await processSensorStream();
    } catch (error) {
      console.error('processSensorStream error', error);
    }
  }
}

main().catch((error) => {
  console.error('Worker failed', error);
  process.exit(1);
});
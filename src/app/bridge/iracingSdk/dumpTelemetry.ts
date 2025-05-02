import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { app } from 'electron';
import { IRacingSDK } from '../../irsdk';

export async function dumpCurrentTelemetry() {
  console.log('Starting...');
  const sdk = new IRacingSDK();
  const dataPath = app.getPath('userData');
  const dirPath = path.join(dataPath, Date.now().toString());

  await mkdir(dirPath, { recursive: true });

  if (await sdk.ready()) {
    sdk.enableLogging = true;
    sdk.enableTelemetry(true);
    sdk.startSDK();

    if (sdk.waitForData(1000)) {
      const telemetry = JSON.stringify(sdk.getTelemetry(), null, 2);
      const session = JSON.stringify(sdk.getSessionData(), null, 2);
      await Promise.all([
        await writeFile(`${dirPath}/telemetry.json`, telemetry, 'utf-8'),
        await writeFile(`${dirPath}/session.json`, session, 'utf-8'),
      ]);
      console.log(`Saved to: ${dirPath}`);
    } else {
      console.warn('No telemetry data received');
    }
  }
}

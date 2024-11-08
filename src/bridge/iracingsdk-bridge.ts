import { BrowserWindow } from 'electron';
import { IRacingSDK } from 'irsdk-node';

const TIMEOUT = 1000;

export async function publishIRacingSDKEvents() {
  console.log('Loading iRacing SDK bridge...');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await IRacingSDK.IsSimRunning()) {
      console.log('iRacing is running');
      const sdk = new IRacingSDK();
      sdk.autoEnableTelemetry = true;

      await sdk.ready();

      while (sdk.waitForData(TIMEOUT)) {
        const telemetry = sdk.getTelemetry();
        await new Promise((resolve) => setTimeout(resolve, 1000 / 60));

        BrowserWindow.getAllWindows().forEach((window) => {
          window.webContents.send('telemetry', telemetry);
        });
      }

      console.log('iRacing is no longer publishing telemetry');
    } else {
      console.log('iRacing is not running');
    }

    await new Promise((resolve) => setTimeout(resolve, TIMEOUT));
  }
}

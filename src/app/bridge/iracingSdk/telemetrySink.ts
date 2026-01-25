import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { app } from 'electron';
import type { Session, Telemetry } from '@irdashies/types';
import { createReadStream, createWriteStream } from 'node:fs';
import { createBrotliCompress, createBrotliDecompress } from 'zlib';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';

export class TelemetrySink {
  private isRecording = false;
  private currentPath = '';
  private telemetry: Telemetry[] = [];
  private session: Session[] = [];

  async startRecording(timeout = 5000) {
    if (this.isRecording) return;
    console.log('Recording started');

    const dataPath = app.getPath('userData');
    const dirPath = path.join(dataPath, Date.now().toString());

    this.currentPath = dirPath;

    await mkdir(dirPath);
    await writeFile(`${dirPath}/telemetry.json`, '', 'utf-8');
    await writeFile(`${dirPath}/session.json`, '', 'utf-8');

    this.isRecording = true;

    setTimeout(() => {
      this.isRecording = false;
      console.log('Recording stopped');
      console.log('Recording Path: ', dirPath);
      console.log('Telemetry Entries: ', this.telemetry.length);
      console.log('Session Entries: ', this.session.length);

      streamWriteLargeJSONArray(`${dirPath}/telemetry.json`, this.telemetry);
      streamWriteLargeJSONArray(`${dirPath}/session.json`, this.session);
    }, timeout);
  }

  addTelemetry(data: Telemetry) {
    if (this.isRecording) {
      this.telemetry.push(data);
    }
  }

  addSession(data: Session) {
    if (this.isRecording) {
      this.session.push(data);
    }
  }
}

const streamWriteLargeJSONArray = async (
  filePath: string,
  arrayItems: unknown[]
) => {
  // Create the write stream and Brotli compression stream
  const writeStream = createWriteStream(filePath);
  const compressStream = createBrotliCompress();

  // Pipe compression stream into write stream
  compressStream.pipe(writeStream);

  // Write the opening bracket of the array
  compressStream.write('[\n');

  for (let i = 0; i < arrayItems.length; i++) {
    const item = arrayItems[i];
    const jsonString = JSON.stringify(item, null, 2);

    // Write the item to the compression stream
    compressStream.write(jsonString);

    // Write a comma if it's not the last item
    if (i < arrayItems.length - 1) {
      compressStream.write(',\n');
    }
  }

  // Write the closing bracket of the array and close the stream
  compressStream.write('\n]');
  compressStream.end(); // Ends the compression and write streams
};

// unused right now, can be used to read compressed telemetry and session files
export const readBrotliStream = (filePath: string) => {
  const readStream = createReadStream(filePath);
  const decompressStream = createBrotliDecompress();

  return new Promise<(Telemetry | Session)[]>((resolve, reject) => {
    const items: (Telemetry | Session)[] = [];
    const pipeline = readStream
      .pipe(decompressStream)
      .pipe(parser())
      .pipe(streamArray());

    pipeline.on('data', (data) => {
      items.push(data.value); // `data.value` contains each parsed JSON object
    });

    pipeline.on('end', () => resolve(items));
    pipeline.on('error', (err: unknown) => reject(err));
  });
};

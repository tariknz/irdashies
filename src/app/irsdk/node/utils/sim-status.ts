import http from 'http';

import { SIM_STATUS_URI } from '../constants';

/**
 * Makes an http localhost request to check whether or not the iRacing sim is running.
 * If the iRacing service is not running, it will throw with `err.code === ECONNREFUSED`.
 *
 * @returns {Promise<boolean>} Whether the sim is running or not.
 * @throws {Error} A generic NodeJS.ErrnoException / Error if something goes wrong.
 */
export const getSimStatus = (): Promise<boolean> => new Promise((resolve, reject) => {
  http.get(SIM_STATUS_URI, (res) => {
    let data = '';

    res.on('data', (d) => {
      data += d;
    });

    res.on('end', () => {
      if (typeof data !== 'string') {
        reject(new Error('Invalid payload from sim received'));
      }
      // This could be done more elegantly, but there is no need really :D
      resolve(data.includes('running:1'));
    });
  }).on('error', (err: NodeJS.ErrnoException) => {
    reject(err);
  });
});

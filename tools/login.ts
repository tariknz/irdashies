import crypto from 'crypto';
import fs from 'fs';
import 'dotenv/config';

export const login = async () => {
  const username = process.env.IRACING_USERNAME;
  const password = process.env.IRACING_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'Please provide IRACING_USERNAME and IRACING_PASSWORD environment variables.'
    );
  }

  const hashPassword = crypto
    .createHash('sha256')
    .update(password + username.toLowerCase())
    .digest('base64');

  try {
    const response = await fetch('https://members-ng.iracing.com/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: username,
        password: hashPassword,
      }),
    });

    if (response.ok) {
      const setCookieHeader = response.headers.getSetCookie();
      if (setCookieHeader) {
        // concat multiple cookies
        const setCookie = setCookieHeader.join('; ');

        // Save the cookie to the cookie-jar.txt file
        fs.mkdirSync('./asset-data', { recursive: true });
        fs.writeFileSync('./asset-data/cookie-jar.txt', setCookie, 'utf8');
        console.log('Cookie saved to cookie-jar.txt');
      }

      const data = await response.text();
      console.log(data);
    } else {
      throw new Error('Failed to login');
    }
  } catch (error) {
    console.error(error);
  }
};

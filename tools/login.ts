import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { maskSecret, type TokenData } from './auth';

export const login = async () => {
  const username = process.env.IRACING_USERNAME;
  const password = process.env.IRACING_PASSWORD;
  const clientSecret = process.env.APP_SECRET;
  const clientId = 'irdashies';

  if (!username || !password) {
    throw new Error(
      'Please provide IRACING_USERNAME and IRACING_PASSWORD environment variables.'
    );
  }

  if (!clientSecret) {
    throw new Error('Please provide APP_SECRET environment variable.');
  }

  const maskedClientSecret = maskSecret(clientSecret, clientId);
  const maskedPassword = maskSecret(password, username);

  const params = new URLSearchParams({
    grant_type: 'password_limited',
    client_id: clientId,
    client_secret: maskedClientSecret,
    username: username,
    password: maskedPassword,
    scope: 'iracing.auth',
  });

  try {
    const response = await fetch('https://oauth.iracing.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Login failed:', response.status, errorText);
      
      if (response.status === 400) {
        const rateLimitRemaining = response.headers.get('RateLimit-Remaining');
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          throw new Error(
            `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again. ${rateLimitRemaining} remaining.`
          );
        }
      }
      
      throw new Error(`Failed to login: ${response.status} ${errorText}`);
    }

    const tokenData: TokenData = await response.json();
    
    const expiresAt = Date.now() + tokenData.expires_in * 1000;
    const tokenDataWithExpiry = {
      ...tokenData,
      expires_at: expiresAt,
    };

    const assetDataDir = path.join(process.cwd(), 'asset-data');
    fs.mkdirSync(assetDataDir, { recursive: true });
    
    const tokenPath = path.join(assetDataDir, 'tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokenDataWithExpiry, null, 2), 'utf8');
    
    console.log('Tokens saved to tokens.json');
    console.log(`Access token expires in ${tokenData.expires_in} seconds`);
    if (tokenData.refresh_token) {
      console.log(`Refresh token expires in ${tokenData.refresh_token_expires_in} seconds`);
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

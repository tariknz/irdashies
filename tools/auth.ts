import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export function maskSecret(secret: string, id: string): string {
  const hasher = crypto.createHash('sha256');
  const normalizedId = id.trim().toLowerCase();
  hasher.update(`${secret}${normalizedId}`);
  return hasher.digest('base64');
}

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  token_type: string;
  scope?: string;
  expires_at?: number;
}

export function getAccessToken(): string {
  const tokenPath = path.join(process.cwd(), 'asset-data', 'tokens.json');
  
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      'No tokens found. Please run login first to authenticate.'
    );
  }

  const tokenData: TokenData = JSON.parse(
    fs.readFileSync(tokenPath, 'utf8')
  );

  return tokenData.access_token;
}


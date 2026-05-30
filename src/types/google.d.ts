// Minimal type declarations for Google Identity Services (GIS) token client.
// Full typings: https://developers.google.com/identity/oauth2/web/reference/js-reference

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrideConfig?: { prompt?: string; hint?: string }): void;
  callback: (response: TokenResponse) => void;
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient(config: TokenClientConfig): TokenClient;
        revoke(token: string, done?: () => void): void;
      };
    };
  };
}

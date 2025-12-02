import { jest } from '@jest/globals';

// We'll set env before importing module to ensure module-scope constants initialize
beforeEach(() => {
  jest.resetModules();
  process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID = 'tenant';
  process.env.NEXT_PUBLIC_AZURE_AD_SERVER_APP_ID = 'serverAppId';
  process.env.AZURE_AD_SERVER_APP_SECRET = 'secret';
});

describe('getUsernameByToken and auth', () => {
  it('returns username from decoded token preferred_username', async () => {
    const authModule = require('../app/api/auth');

    // Mock validateAccessToken to return decoded
    jest.spyOn(authModule, 'validateAccessToken').mockResolvedValue({ preferred_username: 'jack@org.com' });

    const username = await authModule.getUsernameByToken('token');
    expect(username).toBe('jack@org.com');

    (authModule.validateAccessToken as jest.Mock).mockRestore();
  });

  it('falls back to idTokenClaims from getAuthClaims', async () => {
    const authModule = require('../app/api/auth');

    jest.spyOn(authModule, 'validateAccessToken').mockResolvedValue({});
    jest.spyOn(authModule, 'getAuthClaims').mockResolvedValue({ idTokenClaims: { email: 'test@org.com' } });

    const username = await authModule.getUsernameByToken('token');
    expect(username).toBe('test@org.com');

    (authModule.validateAccessToken as jest.Mock).mockRestore();
    (authModule.getAuthClaims as jest.Mock).mockRestore();
  });

  it('falls back to Graph /me using accessToken when no claims', async () => {
    const authModule = require('../app/api/auth');

    jest.spyOn(authModule, 'validateAccessToken').mockResolvedValue({});
    jest.spyOn(authModule, 'getAuthClaims').mockResolvedValue({ idTokenClaims: {}, accessToken: 'accesstoken' });

    // Mock fetch global
    const mockFetch = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({ mail: 'mail@org.com' }) } as any);

    const username = await authModule.getUsernameByToken('token');
    expect(username).toBe('mail@org.com');

    mockFetch.mockRestore();
    (authModule.validateAccessToken as jest.Mock).mockRestore();
    (authModule.getAuthClaims as jest.Mock).mockRestore();
  });

  it('auth returns token expired when validateAccessToken throws TokenExpiredError', async () => {
    const authModule = require('../app/api/auth');

    // Mock request object
    const req: any = { headers: { get: jest.fn(() => 'Bearer token'), set: jest.fn() }, ip: '127.0.0.1' };

    // Make validateAccessToken reject with TokenExpiredError
    const expErr: any = new Error('expired');
    expErr.name = 'TokenExpiredError';
    jest.spyOn(authModule, 'validateAccessToken').mockRejectedValue(expErr);

    const result = await authModule.auth(req, 'azure' as any);
    expect(result.error).toBe(true);
    expect(result.msg).toBe('Token expired');

    (authModule.validateAccessToken as jest.Mock).mockRestore();
  });
});

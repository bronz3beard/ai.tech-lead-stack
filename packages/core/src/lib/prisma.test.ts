import fc from 'fast-check';
import { shouldUseSsl } from './prisma';

describe('shouldUseSsl (property-based)', () => {
  const label = fc.stringMatching(/^[a-z0-9]{1,12}$/);
  const managed = fc.constantFrom(
    'rlwy.net',
    'neon.tech',
    'supabase.co',
    'supabase.com'
  );

  it('ignores managed domains that appear outside the hostname', () => {
    fc.assert(
      fc.property(label, managed, fc.webPath(), (host, domain, path) => {
        const url = `postgresql://u:p@${host}.example/${domain}${path}?q=${domain}`;
        expect(shouldUseSsl(url)).toBe(false);
      })
    );
  });

  it('accepts any subdomain of a managed host', () => {
    fc.assert(
      fc.property(label, managed, (sub, domain) => {
        expect(shouldUseSsl(`postgresql://u:p@${sub}.${domain}/db`)).toBe(true);
      })
    );
  });
});

describe('shouldUseSsl', () => {
  it.each([
    'postgresql://u:p@ep-x.us-east-2.aws.neon.tech/db',
    'postgresql://u:p@EP-X.AWS.NEON.TECH/db',
    'postgresql://u:p@shuttle.proxy.rlwy.net:5432/db',
    'postgresql://u:p@db.abc.supabase.co:5432/db',
    'postgresql://u:p@aws-0-eu.pooler.supabase.com:6543/db',
  ])('enables TLS for managed host %s', (url) => {
    expect(shouldUseSsl(url)).toBe(true);
  });

  it('enables TLS when sslmode=require is set', () => {
    expect(
      shouldUseSsl('postgresql://u:p@db.internal/db?sslmode=require')
    ).toBe(true);
  });

  it.each([
    'postgresql://u:p@evil.com/neon.tech',
    'postgresql://u:p@evil.com/db?host=rlwy.net',
    'postgresql://u:p@notneon.tech/db',
  ])('does not treat %s as a managed host', (url) => {
    expect(shouldUseSsl(url)).toBe(false);
  });

  it('enables TLS for remote hosts in production but not for localhost', () => {
    expect(shouldUseSsl('postgresql://u:p@db.internal/db', 'production')).toBe(
      true
    );
    expect(shouldUseSsl('postgresql://u:p@localhost/db', 'production')).toBe(
      false
    );
    expect(shouldUseSsl('postgresql://u:p@127.0.0.1/db', 'production')).toBe(
      false
    );
  });

  it.each(['', 'undefined'])('returns false for unusable url %p', (url) => {
    expect(shouldUseSsl(url, 'production')).toBe(false);
  });
});

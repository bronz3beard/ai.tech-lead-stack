/** @jest-environment node */
import { execFileSync } from 'child_process';
import fs from 'fs';
import type { AddressInfo } from 'net';
import os from 'os';
import path from 'path';
import tls from 'tls';
import { getSslOptions } from './prisma';

/**
 * Real TLS handshakes against a server shaped like Railway's Postgres: a
 * per-database `root-ca` issuing a `CN=localhost` certificate (SAN
 * DNS:localhost only), reached through a public proxy hostname.
 */
type Pki = { caCert: string; serverKey: string; serverCert: string };

const PROXY_HOST = 'ballast.proxy.rlwy.net';

function makePki(dir: string, name: string): Pki {
  // Plain file names inside `dir`, so each command can be split on spaces.
  const openssl = (command: string) =>
    execFileSync('openssl', command.split(' '), { cwd: dir, stdio: 'pipe' });

  // `-text` like Railway's init-ssl.sh: root.crt starts with a readable dump.
  openssl(
    `req -x509 -newkey rsa:2048 -nodes -days 1 -text -subj /CN=root-ca -keyout ${name}-ca.key -out ${name}-ca.crt`
  );
  openssl(
    `req -newkey rsa:2048 -nodes -subj /CN=localhost -keyout ${name}-server.key -out ${name}-server.csr`
  );
  fs.writeFileSync(
    path.join(dir, `${name}-san.ext`),
    'subjectAltName=DNS:localhost\n'
  );
  openssl(
    `x509 -req -in ${name}-server.csr -CA ${name}-ca.crt -CAkey ${name}-ca.key -CAcreateserial -days 1 -extfile ${name}-san.ext -out ${name}-server.crt`
  );

  const read = (file: string) =>
    fs.readFileSync(path.join(dir, `${name}-${file}`), 'utf8');
  return {
    caCert: read('ca.crt'),
    serverKey: read('server.key'),
    serverCert: read('server.crt'),
  };
}

function handshake(
  server: Pki,
  servername: string,
  options: tls.ConnectionOptions
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tlsServer = tls.createServer(
      { key: server.serverKey, cert: server.serverCert },
      (socket) => socket.end()
    );
    tlsServer.listen(0, '127.0.0.1', () => {
      const { port } = tlsServer.address() as AddressInfo;
      const socket = tls.connect({
        host: '127.0.0.1',
        port,
        servername,
        ...options,
      });
      socket.once('secureConnect', () => {
        socket.end();
        tlsServer.close();
        resolve();
      });
      socket.once('error', (error) => {
        tlsServer.close();
        reject(error);
      });
    });
  });
}

describe('getSslOptions against a Railway-shaped server', () => {
  let dir: string;
  let railway: Pki;
  let impostor: Pki;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-tls-'));
    railway = makePki(dir, 'railway');
    impostor = makePki(dir, 'impostor');
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('verify-full accepts the cert when the hostname matches it', async () => {
    const options = getSslOptions({ DATABASE_SSL_CA: railway.caCert });
    await expect(
      handshake(railway, 'localhost', options)
    ).resolves.toBeUndefined();
  });

  it('verify-full rejects the public proxy host, which the cert does not name', async () => {
    const options = getSslOptions({ DATABASE_SSL_CA: railway.caCert });
    await expect(handshake(railway, PROXY_HOST, options)).rejects.toMatchObject(
      { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }
    );
  });

  it('verify-ca accepts the public proxy host when the chain is trusted', async () => {
    const options = getSslOptions({
      DATABASE_SSL_MODE: 'verify-ca',
      DATABASE_SSL_CA: railway.caCert,
    });
    await expect(
      handshake(railway, PROXY_HOST, options)
    ).resolves.toBeUndefined();
  });

  it('verify-ca still rejects a server whose cert comes from another CA', async () => {
    const options = getSslOptions({
      DATABASE_SSL_MODE: 'verify-ca',
      DATABASE_SSL_CA: railway.caCert,
    });
    await expect(handshake(impostor, PROXY_HOST, options)).rejects.toThrow();
  });

  it('the default rejects a private-CA server when no CA is configured', async () => {
    await expect(
      handshake(railway, 'localhost', getSslOptions({}))
    ).rejects.toThrow();
  });
});

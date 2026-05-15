import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Copy, Terminal } from 'lucide-react';

export default function ConfigGuide() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const envVars = [
    {
      name: 'DATABASE_URL',
      desc: 'PostgreSQL connection string (Railway or Local).',
      required: true,
    },
    {
      name: 'AUTH_SECRET',
      desc: 'Run `openssl rand -base64 32` to generate.',
      required: true,
    },
    {
      name: 'GITHUB_ID',
      desc: 'OAuth Client ID from GitHub Developer Settings.',
      required: true,
    },
    {
      name: 'GITHUB_SECRET',
      desc: 'OAuth Client Secret from GitHub Developer Settings.',
      required: true,
    },
    {
      name: 'GEMINI_API_KEY',
      desc: 'Primary model for discovery and requirements.',
      required: true,
    },
    {
      name: 'JULES_API_KEY',
      desc: 'Agentic model for code audits.',
      required: true,
    },
    {
      name: 'ENCRYPTION_KEY',
      desc: '32-byte hex string for securing API keys in DB.',
      required: true,
    },
    {
      name: 'LANGFUSE_SECRET_KEY',
      desc: 'For AI observability and tracing.',
      required: false,
    },
    {
      name: 'FIRECRAWL_API_KEY',
      desc: 'For web discovery and mapping.',
      required: false,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center">
          <Terminal className="w-5 h-5 mr-2 text-blue-500" />
          Environment Setup Guide
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Follow these steps to configure your local or production environment.
          All values should be placed in a <code>.env.local</code> file.
        </p>
      </section>

      <div className="grid gap-6">
        {/* Step 1: Auth */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-sm flex items-center">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-3">
                1
              </span>
              GitHub OAuth Configuration (localhost only)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-sm space-y-4">
            <p>
              1. Go to{' '}
              <strong>Settings &gt; Developer Settings &gt; OAuth Apps</strong>{' '}
              on GitHub.
            </p>
            <p>2. Create a new App with these settings:</p>
            <div className="bg-slate-950 text-slate-300 p-4 rounded-lg font-mono text-[11px] space-y-2">
              <div className="flex justify-between items-center">
                <span>Homepage: http://localhost:3000</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard('http://localhost:3000')}
                  className="h-6 w-6"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex justify-between items-center">
                <span>
                  Callback: http://localhost:3000/api/auth/callback/github
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    copyToClipboard(
                      'http://localhost:3000/api/auth/callback/github'
                    )
                  }
                  className="h-6 w-6"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Encryption */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-sm flex items-center">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs mr-3">
                2
              </span>
              Generate Encryption Key
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 text-sm space-y-4">
            <p>
              Users can store their own API keys in the DB. To secure them, you
              MUST provide a 32-byte hex encryption key.
            </p>
            <div className="bg-slate-100 p-3 rounded-md flex justify-between items-center font-mono text-xs text-emerald-900">
              <code>
                node -e
                &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  copyToClipboard(
                    "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
                  )
                }
                className="h-7 text-sm text-white"
              >
                Copy Command
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Variables Table */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-900 text-white">
            <CardTitle className="text-sm">
              Mandatory Environment Variables
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-900 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-6 py-3">Variable</th>
                  <th className="px-6 py-3">Description</th>
                  <th className="px-6 py-3">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {envVars.map((v) => (
                  <tr key={v.name} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-mono text-[11px] font-bold text-slate-900">
                      {v.name}
                    </td>
                    <td className="px-6 py-4 text-slate-900">{v.desc}</td>
                    <td className="px-6 py-4">
                      {v.required ? (
                        <span className="text-red-500 text-[10px] font-bold border border-red-200 bg-red-50 px-2 py-1 rounded-md">
                          REQUIRED
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] font-bold border border-slate-200 bg-slate-50 px-2 py-1 rounded-md">
                          OPTIONAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Deployment Notice */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start space-x-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-emerald-900">
              Ready to Deploy?
            </p>
            <p className="text-xs text-emerald-700 leading-relaxed">
              Once these variables are set, your project is 100% wired for
              autonomous feature discovery. The <strong>Discovery Chat</strong>,{' '}
              <strong>Sandboxed Generation</strong>, and{' '}
              <strong>Automated PR Audits</strong> will use these keys to
              interact with GitHub and AI providers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

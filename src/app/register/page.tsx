"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2, UserPlus, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

const roles = ["PM", "DESIGNER", "QA"] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<typeof roles[number]>("PM");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("Account Conflict", {
            description: data.message,
          });
        } else if (res.status === 403) {
          toast.error("Restricted Domain", {
            description: data.message,
          });
        } else {
          toast.error("Registration Failed", {
            description: data.message || "An unexpected error occurred",
          });
        }
        setLoading(false);
        return;
      }

      toast.success("Account Created!", {
        description: "Welcome to the Tech-Lead Stack. Redirecting to sign in...",
      });
      
      setTimeout(() => {
        router.push("/signin");
      }, 1500);
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("System Error", {
        description: "Could not connect to the server. Please try again later.",
      });
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />

      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-500">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
            <UserPlus className="h-6 w-6" />
          </div>
          <CardTitle className="text-3xl font-bold text-zinc-100">Create an account</CardTitle>
          <CardDescription className="text-zinc-400">
            Join the Tech-Lead Stack elite workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  required
                  className="bg-zinc-950/50 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-600 focus:ring-indigo-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="bg-zinc-950/50 border-zinc-800 pl-10 text-zinc-100 placeholder:text-zinc-600 focus:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role" className="text-zinc-300">Select Role</Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-3 h-4 w-4 text-zinc-500 z-10" />
                <Select 
                  value={role} 
                  onChange={(v) => setRole(v as any)}
                  options={roles.map(r => ({ label: r, value: r }))}
                  placeholder="Select a role"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-indigo-600 py-6 text-base font-semibold text-white hover:bg-indigo-700 transition-all active:scale-[0.98]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Provisioning Account...
                </>
              ) : (
                <div className="flex items-center">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </div>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-zinc-400">Already have an account? </span>
            <Link 
              href="/signin" 
              className="font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
            >
              Sign in here
            </Link>
          </div>
        </CardContent>
      </Card>
      
      <div className="absolute bottom-4 text-xs text-zinc-600 select-none">
        Secure Enclave Access • Port 3000
      </div>
    </div>
  );
}

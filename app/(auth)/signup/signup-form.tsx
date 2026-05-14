"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignupFormProps {
  companyId: string;
  teamId?: string;
  role?: string;
}

export function SignupForm({ companyId, teamId, role = "READER" }: SignupFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();

    // Step 1: Sign up the user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("Failed to create account. Please try again.");
      setLoading(false);
      return;
    }

    // Step 2: Create user profile
    const { error: profileError } = await supabase.from("user_profiles").insert({
      id: authData.user.id,
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
    });

    if (profileError) {
      setError("Account created but profile setup failed. Please contact support.");
      setLoading(false);
      return;
    }

    // Step 3: Assign to company with the role from the token
    const { error: membershipError } = await supabase.from("company_memberships").insert({
      company_id: companyId,
      user_id: authData.user.id,
      role: role as "COMPANY_ADMIN" | "MANAGE_TEAM" | "TICKET_CREATOR" | "MEMBER" | "READER",
      is_active: true,
    });

    if (membershipError) {
      setError("Account created but company assignment failed. Please contact support.");
      setLoading(false);
      return;
    }

    // Step 4: Assign to team if provided
    if (teamId) {
      const { error: teamError } = await supabase.from("team_members").insert({
        team_id: teamId,
        company_id: companyId,
        user_id: authData.user.id,
        is_active: true,
      });

      if (teamError) {
        setError("Account created but team assignment failed. Please contact support.");
        setLoading(false);
        return;
      }
    }

    setSuccess(true);
    setLoading(false);

    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-800">Account created successfully!</p>
        <p className="mt-1 text-xs text-green-700">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
          Full Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="John Doe"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="john@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="••••••••"
        />
        <p className="mt-1 text-xs text-slate-500">Must be at least 8 characters</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Already have an account?{" "}
        <a href="/login" className="text-indigo-600 hover:text-indigo-700">
          Sign in
        </a>
      </p>
    </form>
  );
}

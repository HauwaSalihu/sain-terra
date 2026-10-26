"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";
import SAIN from "../../assets/sainlogo.png";
import { API_URL, TOKEN_KEY } from "../../lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await axios.post(
        `${API_URL}/auth/login`,
        { email, password },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const { accessToken } = response.data;

      if (!accessToken) {
        throw new Error("Login succeeded, but no access token was returned.");
      }

      // Save the JWT returned by the backend.
      localStorage.setItem(TOKEN_KEY, accessToken);

      // Refresh the authentication context.
      await refreshUser();

      // Return to the page that sent the user to login, if it is internal.
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message;

        setError(
          Array.isArray(message)
            ? message.join(", ")
            : typeof message === "string"
              ? message
              : err.response
                ? "Invalid email or password."
                : "Unable to connect to the server. Please try again.",
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to log in. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#f8f9f7] px-4 py-10">
      {/* Subtle background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-[#174b34]/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-[#b8954b]/10 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        {/* Logo and branding */}
        <div className="text-center">
          <div className="flex justify-center">
            <Image
              src={SAIN}
              alt="Sain Terra logo"
              width={190}
              height={70}
              priority
              className="mb-3 h-auto max-h-20 w-auto object-contain"
            />
          </div>

          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#286343]">
            Property Management Portal
          </p>
        </div>

        {/* Login card */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl border border-[#e7eae5] bg-white p-6 shadow-[0_20px_60px_rgba(23,63,45,0.06)] sm:p-9"
        >
          <div className="mb-7">
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Staff only. Sign in with the account an administrator
              created for you.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700"
          >
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#286343] focus:ring-4 focus:ring-[#286343]/10"
          />

          <label
            htmlFor="password"
            className="mt-5 block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#286343] focus:ring-4 focus:ring-[#286343]/10"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-[#174b34] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#286343] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {submitting ? "Signing in..." : "Sign in to Sain Terra"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Sain Terra. All rights reserved.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f8f9f7]">
          <p className="text-sm text-slate-500">Loading sign-in page...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

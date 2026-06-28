"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function LoginForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get("redirect") || "/review";

	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/verify-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password }),
			});

			if (!res.ok) {
				const data = await res.json();
				setError(data.error || "Incorrect password.");
				setLoading(false);
				return;
			}

			router.push(redirectTo);
		} catch {
			setError("An unexpected error occurred. Please try again.");
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-dvh items-center justify-center px-4">
			<div className="w-full max-w-sm">
				<div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
					<h1 className="mb-1 text-xl font-semibold tracking-tight text-slate-900">
						Site Access
					</h1>
					<p className="mb-6 text-sm text-slate-500">
						Enter the password to continue.
					</p>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="password"
								className="mb-1.5 block text-sm font-medium text-slate-700"
							>
								Password
							</label>
							<input
								id="password"
								type="password"
								required
								autoFocus
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="Enter site password"
								className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
							/>
						</div>

						{error && (
							<p className="text-sm font-medium text-red-600">
								{error}
							</p>
						)}

						<button
							type="submit"
							disabled={loading}
							className="flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{loading ? "Verifying…" : "Enter"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense fallback={null}>
			<LoginForm />
		</Suspense>
	);
}

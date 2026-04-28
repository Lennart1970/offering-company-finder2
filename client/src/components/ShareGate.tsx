import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface ShareGateProps {
  tokenType: "company" | "list" | "brain";
  tokenValue: string;
  children: React.ReactNode;
}

const STORAGE_KEY = "share_gate_email";

/**
 * Wraps public share pages with an email-based access gate.
 * The visitor must enter their email address; if the domain is on the
 * allowlist, they are granted access for the current session.
 */
export function ShareGate({ tokenType, tokenValue, children }: ShareGateProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if already verified in this session
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) setGranted(true);
  }, []);

  const verify = trpc.shareExt.verifyShareAccess.useMutation({
    onSuccess: (data) => {
      setLoading(false);
      if (data.accessGranted) {
        sessionStorage.setItem(STORAGE_KEY, email);
        setGranted(true);
      } else {
        setError(
          `Access is restricted. Your email domain (@${data.domain}) is not on the approved list. Please contact the sender to request access.`
        );
      }
    },
    onError: () => {
      setLoading(false);
      setError("Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    verify.mutate({ email, tokenType, tokenValue });
  };

  if (granted) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-sm">
            LT
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">LeadTrigger</p>
            <p className="text-sm font-semibold text-gray-800">Connect Group</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">Verify your identity</h1>
        <p className="text-sm text-gray-500 mb-6">
          This page is shared confidentially. Enter your work email to confirm access.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Work email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="you@yourcompany.com"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying…" : "Continue →"}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Your email is only used to verify access. It will not be stored beyond this session.
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

interface ShareGateProps {
  tokenType: "company" | "list" | "brain";
  tokenValue: string;
  children: React.ReactNode;
}

const LS_KEY = "lt_share_visitor_email";

/**
 * Wraps public share pages with an email-based access gate.
 * The visitor must enter their email address; if the domain is on the
 * allowlist, they are granted access.
 *
 * Persistence:
 * - Email is stored in localStorage so returning visitors skip the gate
 *   automatically without re-entering their email.
 * - On first visit, the email is verified against the server allowlist and
 *   a visitor record is upserted in the DB.
 * - On subsequent visits, the stored email is silently re-verified so the
 *   server access log stays accurate.
 */
export function ShareGate({ tokenType, tokenValue, children }: ShareGateProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [granted, setGranted] = useState(false);
  const [loading, setLoading] = useState(true); // start true while we check localStorage

  const verify = trpc.shareExt.verifyShareAccess.useMutation({
    onSuccess: (data) => {
      setLoading(false);
      if (data.accessGranted) {
        // Persist in localStorage so returning visitors skip the gate
        const normalizedEmail = email || localStorage.getItem(LS_KEY) || "";
        if (normalizedEmail) localStorage.setItem(LS_KEY, normalizedEmail.toLowerCase());
        setGranted(true);
      } else {
        // Clear any stale stored email if it's no longer valid
        localStorage.removeItem(LS_KEY);
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

  // On mount: check localStorage for a previously verified email
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      // Silently re-verify to log the access and keep visitor record fresh
      setEmail(stored);
      verify.mutate({ email: stored, tokenType, tokenValue });
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Show nothing while silently re-verifying a stored email
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

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
              placeholder="you@connectgroup.com"
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
          Your email is used to verify access. Returning visitors are recognised automatically.
        </p>
      </div>
    </div>
  );
}

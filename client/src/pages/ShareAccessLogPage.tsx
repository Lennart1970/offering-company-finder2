import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Activity, Users, Eye, Clock, Mail, Globe, ChevronDown, ChevronUp } from "lucide-react";

type Tab = "visitors" | "log";

function formatDate(d: Date | string) {
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tokenTypeBadge(type: string) {
  const map: Record<string, string> = {
    company: "bg-blue-100 text-blue-700",
    list: "bg-purple-100 text-purple-700",
    brain: "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[type] ?? "bg-gray-100 text-gray-600"}`}>
      {type}
    </span>
  );
}

export default function ShareAccessLogPage() {
  const [tab, setTab] = useState<Tab>("visitors");
  const [sortField, setSortField] = useState<"lastSeen" | "accessCount">("lastSeen");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  const visitorsQuery = trpc.shareExt.getShareVisitors.useQuery();
  const logQuery = trpc.shareExt.getShareAccessLog.useQuery({ limit: 200 });

  const visitors = visitorsQuery.data ?? [];
  const log = logQuery.data ?? [];

  const sortedVisitors = [...visitors].sort((a, b) => {
    const av = sortField === "accessCount" ? a.accessCount : new Date(a.lastSeen).getTime();
    const bv = sortField === "accessCount" ? b.accessCount : new Date(b.lastSeen).getTime();
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const grantedCount = log.filter((l) => l.accessGranted).length;
  const uniqueEmails = new Set(log.map((l) => l.email)).size;

  function toggleSort(field: "lastSeen" | "accessCount") {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const SortIcon = ({ field }: { field: "lastSeen" | "accessCount" }) => {
    if (sortField !== field) return null;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline ml-1" /> : <ChevronUp className="w-3 h-3 inline ml-1" />;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Activity className="w-6 h-6 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Share Access Log</h1>
          <p className="text-sm text-gray-500">Track who accessed public share pages</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Unique Visitors</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{visitors.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Page Views</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{grantedCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Log Entries</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{log.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("visitors")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "visitors" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Visitors ({visitors.length})
        </button>
        <button
          onClick={() => setTab("log")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "log" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock className="w-3.5 h-3.5 inline mr-1.5" />
          Access Log ({log.length})
        </button>
      </div>

      {/* Visitors tab */}
      {tab === "visitors" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {visitorsQuery.isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading visitors…</div>
          ) : sortedVisitors.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No visitors yet. Share links will appear here once accessed.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                  <th
                    className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                    onClick={() => toggleSort("lastSeen")}
                  >
                    First Seen <SortIcon field="lastSeen" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Seen</th>
                  <th
                    className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700"
                    onClick={() => toggleSort("accessCount")}
                  >
                    Views <SortIcon field="accessCount" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedVisitors.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {v.email[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{v.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(v.firstSeen)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(v.lastSeen)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                        {v.accessCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Access Log tab */}
      {tab === "log" && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {logQuery.isLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading log…</div>
          ) : log.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No access log entries yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Page Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Token</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {log.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-900">{entry.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{tokenTypeBadge(entry.tokenType)}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">
                        {entry.tokenValue.slice(0, 12)}…
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.accessGranted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                          ✓ Granted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
                          ✗ Denied
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(entry.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

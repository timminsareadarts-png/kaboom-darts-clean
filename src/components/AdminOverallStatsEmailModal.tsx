import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  Copy,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  Send,
  Sparkles,
  RotateCw,
  Eye,
  FileText,
  Clock,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';
import {
  OFFICIAL_LEAGUE_EMAIL,
  generateDetailedOverallStatsReport,
  dispatchOverallPlayerStatsEmail,
  getAutoEmailOverallStatsEnabled,
  setAutoEmailOverallStatsEnabled,
  getLastOverallStatsDispatch,
  OverallStatsReportResult,
  StatsDispatchRecord,
} from '../utils/overallStatsEmailHelper';
import { useAuth } from '../context/AuthContext';

interface AdminOverallStatsEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminOverallStatsEmailModal: React.FC<AdminOverallStatsEmailModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isAdmin } = useAuth();
  const [report, setReport] = useState<OverallStatsReportResult | null>(null);
  const [autoEmailEnabled, setAutoEmailEnabled] = useState<boolean>(() =>
    getAutoEmailOverallStatsEnabled()
  );
  const [lastDispatch, setLastDispatch] = useState<StatsDispatchRecord | null>(() =>
    getLastOverallStatsDispatch()
  );
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'preview' | 'html' | 'settings'>('preview');

  // Load report and settings whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    try {
      const generated = generateDetailedOverallStatsReport();
      setReport(generated);
      setAutoEmailEnabled(getAutoEmailOverallStatsEnabled());
      setLastDispatch(getLastOverallStatsDispatch());
      setStatusMessage(null);
    } catch (e) {
      console.error('Failed to generate stats report:', e);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Security check: Only administrators can access this view
  if (!isAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
        <div className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white">Admin Access Required</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Only designated administrators can email or configure overall player statistics reports.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleToggleAutoEmail = () => {
    const nextVal = !autoEmailEnabled;
    setAutoEmailEnabled(nextVal);
    setAutoEmailOverallStatsEnabled(nextVal);
    setStatusMessage({
      type: 'success',
      text: nextVal
        ? `Automatic overall stats email enabled. Reports will be sent to ${OFFICIAL_LEAGUE_EMAIL}.`
        : `Automatic email dispatch disabled. You can still email stats manually anytime.`,
    });
  };

  const handleSendNow = async () => {
    setIsSending(true);
    setStatusMessage(null);
    try {
      const result = await dispatchOverallPlayerStatsEmail({
        triggerType: 'manual',
      });
      setLastDispatch(getLastOverallStatsDispatch());
      setStatusMessage({
        type: 'success',
        text: `Fully detailed overall stats for ${report?.totalPlayers || 0} players successfully recorded and dispatched to ${OFFICIAL_LEAGUE_EMAIL}!`,
      });
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to dispatch email.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenMailto = async () => {
    try {
      await dispatchOverallPlayerStatsEmail({
        triggerType: 'manual',
        openClient: true,
      });
      setLastDispatch(getLastOverallStatsDispatch());
      setStatusMessage({
        type: 'success',
        text: `Native mail client opened with prefilled overall stats addressed to ${OFFICIAL_LEAGUE_EMAIL}.`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenGmail = async () => {
    try {
      await dispatchOverallPlayerStatsEmail({
        triggerType: 'manual',
        openGmail: true,
      });
      setLastDispatch(getLastOverallStatsDispatch());
      setStatusMessage({
        type: 'success',
        text: `Gmail compose opened with prefilled overall stats addressed to ${OFFICIAL_LEAGUE_EMAIL}.`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = () => {
    if (!report?.textReport) return;
    navigator.clipboard.writeText(report.textReport);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRefresh = () => {
    const generated = generateDetailedOverallStatsReport();
    setReport(generated);
    setStatusMessage({
      type: 'success',
      text: `Overall stats refreshed with the latest leaderboard figures (${generated.totalPlayers} players).`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg border border-emerald-400/40 shrink-0">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-md tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Admin Only
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black uppercase rounded-md tracking-wider">
                    Official League Email
                  </span>
                  {autoEmailEnabled && (
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold rounded-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-indigo-400" /> Auto-Email Active
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                  Email Overall Player Statistics
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sends fully detailed career & season statistics for all individual players directly to{' '}
                  <strong className="text-emerald-400 font-mono">{OFFICIAL_LEAGUE_EMAIL}</strong>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* QUICK TARGET BANNER */}
          <div className="mt-4 p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-slate-400 font-medium">Designated Delivery Recipient:</span>
              <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-800/50">
                {OFFICIAL_LEAGUE_EMAIL}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleAutoEmail}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                {autoEmailEnabled ? (
                  <>
                    <ToggleRight className="w-4 h-4 text-emerald-400" />
                    <span>Auto-Email: <strong className="text-emerald-300">ON</strong></span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 text-slate-400" />
                    <span>Auto-Email: <strong className="text-slate-300">OFF</strong></span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Recalculate & refresh stats from latest leaderboard"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* FEEDBACK STATUS BANNER */}
        {statusMessage && (
          <div
            className={`px-5 py-3 text-xs font-bold flex items-center justify-between border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB CONTROLS */}
        <div className="px-6 pt-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Plain Text Report ({report?.totalPlayers || 0} Players)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('html')}
              className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'html'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Rich HTML Preview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Automation Rules
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Generated: {report?.generatedAt || 'Just now'}</span>
          </div>
        </div>

        {/* TAB CONTENTS (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-950/40">
          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Complete report includes championship standings table + full per-player profiles (Tuesday, Wednesday & Thursday).
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Text'}</span>
                </button>
              </div>

              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] sm:text-xs leading-relaxed overflow-x-auto shadow-inner border border-slate-800 whitespace-pre">
                {report?.textReport || 'Generating statistics report...'}
              </div>
            </div>
          )}

          {activeTab === 'html' && (
            <div className="space-y-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-semibold">
                This rich HTML email format provides clean card tables and metrics badges when viewed in HTML-compatible mail readers.
              </div>
              <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: report?.htmlReport || '' }}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4 max-w-2xl">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                      Automated Overall Stats Dispatch
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Automatically email fully detailed overall individual statistics to{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">{OFFICIAL_LEAGUE_EMAIL}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleAutoEmail}
                    className="p-1 rounded-full transition-colors cursor-pointer"
                  >
                    {autoEmailEnabled ? (
                      <ToggleRight className="w-9 h-9 text-emerald-500" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-400" />
                    )}
                  </button>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 text-xs space-y-2 text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Triggers automatically upon completion of league match nights and reset sequences.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Includes all registered active players across Tuesday Singles, Wednesday Teams & Thursday Doubles.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Logs full dispatch records to server persistent venue store.</span>
                  </div>
                </div>
              </div>

              {lastDispatch && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-xs space-y-1">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                    Last Dispatch Record
                  </span>
                  <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                    <span>Dispatched To: {lastDispatch.recipient}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Successful</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Timestamp: {lastDispatch.formattedDate} • {lastDispatch.playerCount} Players Included ({lastDispatch.triggerType.toUpperCase()} trigger)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER - ACTION BUTTONS */}
        <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            <span>
              Target: <strong className="text-slate-800 dark:text-slate-200">{OFFICIAL_LEAGUE_EMAIL}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy Report'}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenGmail}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Open prefilled email in Gmail Webmail"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Gmail Webmail</span>
            </button>

            <button
              type="button"
              onClick={handleOpenMailto}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Open prefilled in native mail client"
            >
              <Mail className="w-4 h-4" />
              <span>Native Mail Client</span>
            </button>

            <button
              type="button"
              onClick={handleSendNow}
              disabled={isSending}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSending ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send to surgedarts@gmail.com</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

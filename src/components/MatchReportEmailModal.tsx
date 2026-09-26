import React, { useState, useEffect } from 'react';
import { MatchState } from '../types';
import {
  generateMatchEmailReport,
  getRecipientEmail,
  saveRecipientEmail,
  savePlayerReportEmail,
  getSavedPlayerReportEmail,
  getGmailComposeUrl,
  getNativeMailtoUrl,
  openMailtoLink,
  recordMatchEmailDispatched,
  OFFICIAL_LEAGUE_EMAIL,
} from '../utils/emailReportHelper';
import {
  Mail,
  Copy,
  Check,
  X,
  FileText,
  CheckCircle2,
  UserCheck,
  AtSign,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Edit2,
  Send,
} from 'lucide-react';

export { generateMatchEmailReport };

interface MatchReportEmailModalProps {
  matchState: MatchState;
  isOpen: boolean;
  onClose: () => void;
  onDispatched?: () => void;
}

export const MatchReportEmailModal: React.FC<MatchReportEmailModalProps> = ({
  matchState,
  isOpen,
  onClose,
  onDispatched,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(() => getRecipientEmail());
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playerEmailInput, setPlayerEmailInput] = useState<string>('');
  const [rememberPreference, setRememberPreference] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load saved recipient and player email preferences
    setRecipientEmail(getRecipientEmail());
    const { email: savedEmail, autoSendEnabled } = getSavedPlayerReportEmail();
    if (savedEmail) {
      setPlayerEmailInput(savedEmail);
      setRememberPreference(autoSendEnabled);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Parse entered player CC emails
  const parsedPlayerEmails = playerEmailInput
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.toLowerCase() !== recipientEmail.toLowerCase());

  const activeRecipient = recipientEmail.trim() || OFFICIAL_LEAGUE_EMAIL;
  const { subject, body } = generateMatchEmailReport(
    matchState,
    parsedPlayerEmails
  );

  const mailtoUrl = getNativeMailtoUrl(activeRecipient, parsedPlayerEmails, subject, body);

  const logDispatch = () => {
    const extraKeys = [
      matchState.id,
      matchState.settings?.bracketMatchId,
      matchState.matchCode,
    ].filter(Boolean) as string[];

    recordMatchEmailDispatched(
      {
        matchCode: matchState.matchCode || matchState.id,
        sentAt: Date.now(),
        recipientEmail: activeRecipient,
        playerEmails: parsedPlayerEmails,
        subject,
      },
      extraKeys
    );
    if (onDispatched) onDispatched();
  };

  const handleSaveRecipient = () => {
    if (recipientEmail.trim()) {
      saveRecipientEmail(recipientEmail.trim());
    }
    setIsEditingRecipient(false);
  };

  const handleShareViaEmail = () => {
    if (rememberPreference && playerEmailInput.trim()) {
      savePlayerReportEmail(playerEmailInput.trim(), true);
    }
    if (recipientEmail.trim()) {
      saveRecipientEmail(recipientEmail.trim());
    }
    logDispatch();
    openMailtoLink(activeRecipient, parsedPlayerEmails, subject, body);
    setActionNotice('Opening your default email app with the pre-filled match report...');
  };

  const handleOpenGmailWeb = () => {
    if (rememberPreference && playerEmailInput.trim()) {
      savePlayerReportEmail(playerEmailInput.trim(), true);
    }
    if (recipientEmail.trim()) {
      saveRecipientEmail(recipientEmail.trim());
    }
    logDispatch();
    const url = getGmailComposeUrl(activeRecipient, parsedPlayerEmails, subject, body);
    window.open(url, '_blank');
    setActionNotice('Opened Gmail compose window in a new tab.');
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    logDispatch();
    setTimeout(() => setCopied(false), 2500);
    setActionNotice('Copied complete official match report to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full p-5 sm:p-8 shadow-2xl relative space-y-6 my-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 border-b border-slate-100 pb-5">
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 shrink-0">
            <Mail className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Share Match Results via Email</h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                Official Report
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Opens a standard email with the complete match summary, statistics, and game breakdown pre-filled.
            </p>
          </div>
        </div>

        {/* Recipient Address Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-xs sm:text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Recipient Address:</span>
              {isEditingRecipient ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="bg-white text-emerald-700 font-mono text-xs px-2.5 py-1 rounded border border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRecipient();
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveRecipient}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <strong className="font-mono text-emerald-700 text-sm">{activeRecipient}</strong>
                  <button
                    type="button"
                    onClick={() => setIsEditingRecipient(true)}
                    className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Edit recipient address"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto">
              Ready
            </span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed pl-7">
            Match <strong className="font-mono text-slate-800">{matchState.matchCode}</strong> score details will be sent directly to this address.
          </p>
        </div>

        {/* Player Self-Send Option Card */}
        <div className="bg-slate-50 border-2 border-indigo-200/80 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Send a Copy to Yourself / Your Team (Optional CC)</span>
            </div>
            <span className="text-[11px] text-indigo-600 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Player Option
            </span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 block">
                Enter your email address to receive your own copy:
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <AtSign className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={playerEmailInput}
                  onChange={(e) => {
                    setPlayerEmailInput(e.target.value);
                    setActionNotice(null);
                  }}
                  placeholder="e.g. you@gmail.com, teammate@darts.com"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Remember Email Checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="remember_email_checkbox"
                type="checkbox"
                checked={rememberPreference}
                onChange={(e) => {
                  setRememberPreference(e.target.checked);
                  if (playerEmailInput.trim()) {
                    savePlayerReportEmail(playerEmailInput.trim(), e.target.checked);
                  }
                }}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label
                htmlFor="remember_email_checkbox"
                className="text-[11px] text-slate-600 cursor-pointer select-none font-medium"
              >
                Remember my email for future match reports
              </label>
            </div>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Primary Action Button Header */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Email Delivery Options
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Share Results via Email (Standard Mailto) */}
            <a
              href={mailtoUrl}
              onClick={handleShareViaEmail}
              id="modal-share-results-email-btn"
              className="py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer no-underline text-center"
              title="Open default email application pre-filled with match summary"
            >
              <Mail className="w-4 h-4 stroke-[2.5]" />
              <span>Share Results via Email</span>
            </a>

            {/* 2. Open in Gmail (Web) */}
            <button
              type="button"
              onClick={handleOpenGmailWeb}
              className="py-3.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Open Google Mail in web browser"
            >
              <ExternalLink className="w-4 h-4 text-red-600" />
              <span>Open in Gmail</span>
            </button>

            {/* 3. Copy Text */}
            <button
              type="button"
              onClick={handleCopyReport}
              className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 border border-slate-200 transition-all active:scale-95 cursor-pointer"
              title="Copy match report to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Report Copied!' : 'Copy Summary'}</span>
            </button>
          </div>
        </div>

        {/* Email Content Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-indigo-500" /> Pre-Filled Match Report Preview
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {matchState.completedLegs?.length || 0} Games Logged
            </span>
          </div>
          <div className="text-[11px] text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
            <strong>Subject:</strong> {subject}
          </div>
          <pre className="p-4 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto max-h-64 border border-slate-800 leading-relaxed select-all">
            {body}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            Official recipient:{' '}
            <strong className="text-slate-700">{activeRecipient}</strong>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

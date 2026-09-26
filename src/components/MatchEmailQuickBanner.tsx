import React, { useState, useEffect } from 'react';
import { MatchState } from '../types';
import {
  generateMatchEmailReport,
  getRecipientEmail,
  saveRecipientEmail,
  getSavedPlayerReportEmail,
  savePlayerReportEmail,
  getNativeMailtoUrl,
  getGmailComposeUrl,
  openMailtoLink,
  OFFICIAL_LEAGUE_EMAIL,
} from '../utils/emailReportHelper';
import {
  Mail,
  CheckCircle2,
  Copy,
  Check,
  AtSign,
  ExternalLink,
  Edit2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface MatchEmailQuickBannerProps {
  matchState: MatchState;
  onOpenFullModal?: () => void;
}

export const MatchEmailQuickBanner: React.FC<MatchEmailQuickBannerProps> = ({
  matchState,
  onOpenFullModal,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(() => getRecipientEmail());
  const [isEditingRecipient, setIsEditingRecipient] = useState(false);
  const [playerEmail, setPlayerEmail] = useState('');
  const [rememberEmail, setRememberEmail] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSummaryPreview, setShowSummaryPreview] = useState(false);

  useEffect(() => {
    // Load player email preference if saved
    const { email: saved, autoSendEnabled } = getSavedPlayerReportEmail();
    if (saved) {
      setPlayerEmail(saved);
      setRememberEmail(autoSendEnabled);
    }
  }, []);

  const parsedCcEmails = playerEmail
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.toLowerCase() !== recipientEmail.toLowerCase());

  const activeRecipient = recipientEmail.trim() || OFFICIAL_LEAGUE_EMAIL;
  const { subject, body } = generateMatchEmailReport(matchState, parsedCcEmails);
  const mailtoUrl = getNativeMailtoUrl(activeRecipient, parsedCcEmails, subject, body);

  const handleSaveRecipient = () => {
    if (recipientEmail.trim()) {
      saveRecipientEmail(recipientEmail.trim());
    }
    setIsEditingRecipient(false);
  };

  const handleShareViaEmail = (e?: React.MouseEvent) => {
    if (rememberEmail && playerEmail.trim()) {
      savePlayerReportEmail(playerEmail.trim(), true);
    }
    if (recipientEmail.trim()) {
      saveRecipientEmail(recipientEmail.trim());
    }
    openMailtoLink(activeRecipient, parsedCcEmails, subject, body);
  };

  const handleOpenGmail = () => {
    if (rememberEmail && playerEmail.trim()) {
      savePlayerReportEmail(playerEmail.trim(), true);
    }
    if (recipientEmail.trim()) {
      saveRecipientEmail(recipientEmail.trim());
    }
    const url = getGmailComposeUrl(activeRecipient, parsedCcEmails, subject, body);
    window.open(url, '_blank');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 sm:p-6 shadow-xl text-white space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-300">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                Share Match Results
              </h3>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold uppercase tracking-wider">
                Ready to Send
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Pre-filled with detailed match scores, game breakdown, and averages
            </p>
          </div>
        </div>

        {/* Recipient Address Display & Inline Editor */}
        <div className="flex items-center gap-2 text-xs bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-1.5 self-start sm:self-auto">
          <span className="text-slate-400 text-[11px]">To:</span>
          {isEditingRecipient ? (
            <div className="flex items-center gap-1.5">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com"
                className="bg-slate-900 text-emerald-300 px-2 py-0.5 rounded border border-slate-700 text-xs font-mono focus:outline-none focus:border-indigo-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRecipient();
                }}
              />
              <button
                type="button"
                onClick={handleSaveRecipient}
                className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold cursor-pointer"
              >
                Save
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <strong className="text-emerald-300 font-mono text-xs">{activeRecipient}</strong>
              <button
                type="button"
                onClick={() => setIsEditingRecipient(true)}
                className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Change recipient address"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Button Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Main 'Share Results via Email' Button */}
        <a
          href={mailtoUrl}
          onClick={handleShareViaEmail}
          id="share-results-email-quick-btn"
          className="flex-1 px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-95 cursor-pointer no-underline text-center"
          title="Opens default email client with match report pre-filled"
        >
          <Mail className="w-5 h-5 stroke-[2.5]" />
          <span>Share Results via Email</span>
        </a>

        {/* 1-Click Alternate: Gmail Web */}
        <button
          type="button"
          onClick={handleOpenGmail}
          className="px-4 py-3.5 bg-red-950/40 hover:bg-red-900/50 text-red-200 border border-red-800/50 text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Open compose window in Google Mail web browser"
        >
          <ExternalLink className="w-4 h-4 text-red-400" />
          <span>Open in Gmail</span>
        </button>

        {/* Copy Text */}
        <button
          type="button"
          onClick={handleCopy}
          className="px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95"
          title="Copy full scorecard text to clipboard"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
          <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
        </button>
      </div>

      {/* Player Self-Copy Option (CC) */}
      <div className="pt-2 border-t border-indigo-800/30 space-y-2">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <AtSign className="w-3.5 h-3.5" />
            </div>
            <input
              type="email"
              value={playerEmail}
              onChange={(e) => setPlayerEmail(e.target.value)}
              placeholder="Send a copy to yourself / team (optional CC, e.g. you@gmail.com)"
              className="w-full pl-9 pr-3 py-2 bg-slate-950/70 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-300 pl-1 shrink-0">
            <input
              id="remember_email_banner"
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => {
                setRememberEmail(e.target.checked);
                if (playerEmail.trim()) {
                  savePlayerReportEmail(playerEmail.trim(), e.target.checked);
                }
              }}
              className="w-3.5 h-3.5 rounded text-emerald-500 border-slate-700 bg-slate-950 cursor-pointer"
            />
            <label htmlFor="remember_email_banner" className="cursor-pointer select-none">
              Remember my email
            </label>
          </div>
        </div>

        {/* Expandable Preview Toggle */}
        <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
          <button
            type="button"
            onClick={() => setShowSummaryPreview(!showSummaryPreview)}
            className="text-[11px] text-indigo-300 hover:text-indigo-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            <span>{showSummaryPreview ? 'Hide Match Summary' : 'Preview Match Summary'}</span>
            {showSummaryPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {onOpenFullModal && (
            <button
              type="button"
              onClick={onOpenFullModal}
              className="text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer underline"
            >
              Advanced Options
            </button>
          )}
        </div>

        {/* Collapsible Match Summary Pre */}
        {showSummaryPreview && (
          <div className="animate-fadeIn mt-2">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
              Subject: <span className="text-white font-mono">{subject}</span>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-56 border border-slate-800 leading-relaxed select-all">
              {body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

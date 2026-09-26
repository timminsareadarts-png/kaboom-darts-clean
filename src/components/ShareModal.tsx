import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Copy,
  Check,
  Share2,
  Smartphone,
  Globe,
  QrCode,
  Download,
  Printer,
  Code,
  Trophy,
  Target,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchCode?: string;
  activeTab?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  matchCode,
  activeTab,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [showEmbedCode, setShowEmbedCode] = useState(false);

  const [qrUniversalUrl, setQrUniversalUrl] = useState<string>('');

  // Compute live browser origin URL (unified pass for everything)
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const universalUrl = currentOrigin;

  // Standard responsive embed code
  const embedCodeSnippet = `<!-- Kaboom Dart Center Live Embed (Scorer, Board Assignments & Standings) -->
<div style="position: relative; width: 100%; height: 850px; max-width: 1400px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15);">
  <iframe
    src="${currentOrigin}"
    style="width: 100%; height: 100%; border: none;"
    allow="clipboard-write; fullscreen"
    loading="lazy"
    title="Kaboom Darts Match Center, Live Scoring & Standings"
  ></iframe>
</div>`;

  useEffect(() => {
    if (!isOpen || !universalUrl) return;

    const qrOptions: QRCode.QRCodeToDataURLOptions = {
      width: 450,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    };

    QRCode.toDataURL(universalUrl, qrOptions)
      .then(url => setQrUniversalUrl(url))
      .catch(err => console.error('QR code generation error:', err));
  }, [isOpen, universalUrl]);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, type: 'url' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2500);
      }
    } catch (err) {
      console.error('Clipboard copy error:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Kaboom Darts Match Center',
          text: 'Open Kaboom Darts for Live Match Scoring, Board Assignments & League Standings!',
          url: universalUrl,
        });
      } catch (e) {
        console.log('Share canceled or not supported', e);
      }
    } else {
      copyToClipboard(universalUrl, 'url');
    }
  };

  const downloadQrImage = () => {
    if (!qrUniversalUrl) return;
    const link = document.createElement('a');
    link.href = qrUniversalUrl;
    link.download = 'kaboom-darts-all-in-one-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPlacard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kaboom Darts Match Center - All-in-One QR Pass</title>
          <style>
            @page { size: auto; margin: 15mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 90vh;
              text-align: center;
              color: #0f172a;
              background-color: #ffffff;
              padding: 20px;
            }
            .card {
              border: 4px solid #0f172a;
              border-radius: 28px;
              padding: 40px 32px;
              max-width: 520px;
              width: 100%;
              box-sizing: border-box;
            }
            .badge {
              display: inline-block;
              background: #4f46e5;
              color: #ffffff;
              font-size: 13px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 2px;
              padding: 6px 16px;
              border-radius: 20px;
              margin-bottom: 16px;
            }
            h1 {
              font-size: 32px;
              font-weight: 900;
              margin: 0 0 8px 0;
              letter-spacing: -0.5px;
            }
            p.subtitle {
              font-size: 15px;
              color: #64748b;
              margin: 0 0 20px 0;
              line-height: 1.4;
            }
            .qr-wrapper {
              background: #ffffff;
              padding: 16px;
              display: inline-block;
              border-radius: 24px;
              box-shadow: 0 4px 24px rgba(0,0,0,0.09);
              border: 2px solid #e2e8f0;
              margin-bottom: 24px;
            }
            img.qr {
              width: 270px;
              height: 270px;
              display: block;
            }
            .features-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-bottom: 20px;
              text-align: center;
            }
            .feature-pill {
              background: #f1f5f9;
              border-radius: 12px;
              padding: 10px 8px;
              font-size: 12px;
              font-weight: 800;
              color: #1e293b;
            }
            .feature-pill span {
              display: block;
              font-size: 10px;
              color: #64748b;
              font-weight: 500;
              margin-top: 2px;
            }
            .instructions {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 12px 18px;
              font-size: 13px;
              font-weight: 600;
              color: #334155;
            }
            .url {
              font-family: monospace;
              font-size: 12px;
              color: #64748b;
              margin-top: 14px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">🎯 KABOOM DARTS MATCH CENTER</div>
            <h1>Scan to Join</h1>
            <p class="subtitle">Open on any smartphone camera — no download or account needed!</p>
            
            <div class="qr-wrapper">
              <img class="qr" src="${qrUniversalUrl}" alt="Kaboom Darts QR Code" />
            </div>

            <div class="features-grid">
              <div class="feature-pill">
                🎯 Scorer
                <span>Interactive Board</span>
              </div>
              <div class="feature-pill">
                📋 Board Assignments
                <span>Find Your Board</span>
              </div>
              <div class="feature-pill">
                🏆 Standings
                <span>League Tables</span>
              </div>
            </div>

            <div class="instructions">
              📷 Open your camera app & point at the QR code to connect instantly.
            </div>
            <div class="url">${universalUrl}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div 
      id="share-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="share-modal-container"
        onClick={e => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/90 text-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[94vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-inner">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white tracking-tight leading-tight">
                All-in-One QR Pass
              </h3>
              <p className="text-[11px] text-slate-400">Match Scorer, Board Assignments & League Standings</p>
            </div>
          </div>
          <button
            id="btn-close-share-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Main QR Card */}
          <div className="flex flex-col items-center justify-center p-5 bg-slate-950/70 rounded-2xl border border-slate-800/90 text-center shadow-inner">
            <div className="bg-white p-3.5 rounded-2xl shadow-2xl mb-3 border-2 border-slate-100">
              {qrUniversalUrl ? (
                <img
                  id="img-universal-qr-code"
                  src={qrUniversalUrl}
                  alt="Kaboom Darts QR Code"
                  className="w-52 h-52 rounded-xl"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                  Generating QR code...
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-100 font-bold mb-1">
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>Point any phone camera to scan & join</span>
            </div>
            
            {/* 3-in-1 Feature Badges */}
            <div className="grid grid-cols-3 gap-1.5 w-full mt-3 pt-3 border-t border-slate-800/80">
              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center">
                <Target className="w-4 h-4 text-rose-400 mb-1" />
                <span className="text-[11px] font-black text-white">Scorer</span>
                <span className="text-[9px] text-slate-400">Interactive Board</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center">
                <Smartphone className="w-4 h-4 text-cyan-400 mb-1" />
                <span className="text-[11px] font-black text-white">Boards</span>
                <span className="text-[9px] text-slate-400">Board Assignments</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col items-center text-center">
                <Trophy className="w-4 h-4 text-amber-400 mb-1" />
                <span className="text-[11px] font-black text-white">Standings</span>
                <span className="text-[9px] text-slate-400">League Tables</span>
              </div>
            </div>

            {/* Quick Venue Actions: Download & Print Flyer */}
            <div className="flex items-center gap-2 mt-4 w-full">
              <button
                id="btn-download-qr-png"
                onClick={downloadQrImage}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>Save PNG</span>
              </button>

              <button
                id="btn-print-qr-placard"
                onClick={printPlacard}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-slate-700 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Table Flyer</span>
              </button>
            </div>
          </div>

          {/* Web URL & Copy */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Live Web Link
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-universal-web-link"
                type="text"
                readOnly
                value={universalUrl}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-mono focus:outline-none select-all"
              />
              <button
                id="btn-copy-universal-url"
                onClick={() => copyToClipboard(universalUrl, 'url')}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0 shadow-md"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Native Mobile Share Sheet */}
          <button
            id="btn-native-share-sheet"
            onClick={handleNativeShare}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl text-xs font-extrabold text-white flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer shadow-md hover:border-indigo-500/40"
          >
            <Share2 className="w-4 h-4 text-indigo-400" />
            <span>Send via Messages, WhatsApp, or AirDrop</span>
          </button>

          {/* Toggle Website Embed Code */}
          <div className="pt-1">
            <button
              id="btn-toggle-embed-snippet"
              onClick={() => setShowEmbedCode(prev => !prev)}
              className="w-full py-1.5 text-[11px] text-slate-400 hover:text-indigo-300 flex items-center justify-center gap-1 font-semibold cursor-pointer transition-colors"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showEmbedCode ? 'Hide Website HTML Embed Code' : 'Need to embed on your website? Click here'}</span>
            </button>

            {showEmbedCode && (
              <div className="mt-2 p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Website HTML Snippet
                  </span>
                  <button
                    id="btn-copy-embed-snippet"
                    onClick={() => copyToClipboard(embedCodeSnippet, 'embed')}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    {copiedEmbed ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  readOnly
                  rows={4}
                  value={embedCodeSnippet}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-[10px] font-mono text-slate-300 focus:outline-none select-all resize-none leading-relaxed"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            Cloud Synced Pass
          </span>
          <span className="text-indigo-400 font-bold">iOS & Android Ready</span>
        </div>
      </div>
    </div>
  );
};

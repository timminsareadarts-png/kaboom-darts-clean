import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Smartphone,
  Copy,
  Check,
  Download,
  Printer,
  Maximize2,
  Minimize2,
  X,
  ExternalLink,
  Sparkles,
  Radio,
  Tv,
} from 'lucide-react';
import { MatchState } from '../types';

interface MatchQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchCode?: string;
  spectatorMatch?: MatchState | null;
  onSelectMatch?: (code: string) => void;
}

export const MatchQRCodeModal: React.FC<MatchQRCodeModalProps> = ({
  isOpen,
  onClose,
  matchCode = 'Kaboom',
  spectatorMatch,
  onSelectMatch,
}) => {
  const [selectedCode, setSelectedCode] = useState<string>(matchCode || 'Kaboom');
  const [customCodeInput, setCustomCodeInput] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Sync selected code when matchCode prop changes
  useEffect(() => {
    if (matchCode) {
      setSelectedCode(matchCode);
    }
  }, [matchCode]);

  // Construct target match URL
  const matchUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?match=${encodeURIComponent(selectedCode.trim() || 'Kaboom')}`
    : `https://kaboom-darts.app?match=${encodeURIComponent(selectedCode.trim() || 'Kaboom')}`;

  // Generate QR Code image data URL whenever URL or code changes
  useEffect(() => {
    if (!isOpen && !isFullscreen) return;

    let isMounted = true;
    setIsGenerating(true);

    QRCode.toDataURL(matchUrl, {
      width: isFullscreen ? 500 : 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate QR code', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [matchUrl, isOpen, isFullscreen]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(matchUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `kaboom-match-${selectedCode.toLowerCase()}-qr.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintPlacard = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kaboom Darts - Spectator QR Code (${selectedCode})</title>
          <style>
            @page { size: auto; margin: 20mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              text-align: center;
              padding: 40px;
              color: #0f172a;
            }
            .card {
              border: 4px solid #4f46e5;
              border-radius: 24px;
              padding: 40px 30px;
              max-width: 500px;
              margin: 0 auto;
              background: #ffffff;
            }
            .logo {
              font-size: 32px;
              font-weight: 900;
              letter-spacing: -1px;
              color: #4f46e5;
              margin-bottom: 4px;
            }
            .badge {
              display: inline-block;
              background: #fef3c7;
              color: #92400e;
              font-weight: 800;
              font-size: 14px;
              padding: 6px 16px;
              border-radius: 9999px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 20px;
            }
            .qr-image {
              width: 260px;
              height: 260px;
              margin: 10px auto;
              display: block;
              border-radius: 12px;
            }
            .code-box {
              background: #f8fafc;
              border: 2px dashed #cbd5e1;
              border-radius: 12px;
              padding: 12px;
              margin: 20px auto;
              font-family: monospace;
              font-size: 20px;
              font-weight: bold;
              color: #0f172a;
            }
            .instruction {
              font-size: 16px;
              font-weight: 600;
              color: #334155;
              margin-top: 10px;
            }
            .subtext {
              font-size: 13px;
              color: #64748b;
              margin-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">🎯 KABOOM DARTS</div>
            <div class="badge">Live Spectator Match</div>
            <div class="instruction">Scan with any smartphone camera to follow live scores!</div>
            <img class="qr-image" src="${qrDataUrl}" alt="Match QR Code" />
            <div class="code-box">MATCH CODE: ${selectedCode}</div>
            <div class="subtext">Direct Link: ${matchUrl}</div>
          </div>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleApplyCustomCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCodeInput.trim()) return;
    const formatted = customCodeInput.trim().toUpperCase();
    setSelectedCode(formatted);
    if (onSelectMatch) onSelectMatch(formatted);
    setCustomCodeInput('');
  };

  return (
    <div
      id="match-qr-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
    >
      <div
        id="match-qr-modal-container"
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden w-full transition-all ${
          isFullscreen ? 'max-w-4xl p-8' : 'max-w-lg'
        }`}
      >
        {/* Modal Top Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-base text-white tracking-tight flex items-center gap-2">
                Spectator Match QR Code
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase rounded border border-emerald-500/30">
                  Live Feed
                </span>
              </h3>
              <p className="text-xs text-slate-400">Scan to join scoreboard feed instantly</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Display Mode'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Quick Match Code Presets */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">
              Select Match or Board
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCode(matchCode || 'Kaboom');
                  if (onSelectMatch) onSelectMatch(matchCode || 'Kaboom');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  selectedCode.toUpperCase() === (matchCode || 'Kaboom').toUpperCase()
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Current Match ({matchCode || 'Kaboom'})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCode('Kaboom');
                  if (onSelectMatch) onSelectMatch('Kaboom');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCode.toUpperCase() === 'KABOOM'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Board 1 (Kaboom)
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCode('TUESDAY');
                  if (onSelectMatch) onSelectMatch('TUESDAY');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCode.toUpperCase() === 'TUESDAY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Tuesday Singles
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCode('WEDNESDAY');
                  if (onSelectMatch) onSelectMatch('WEDNESDAY');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCode.toUpperCase() === 'WEDNESDAY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Wednesday Teams
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedCode('THURSDAY');
                  if (onSelectMatch) onSelectMatch('THURSDAY');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedCode.toUpperCase() === 'THURSDAY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Thursday Doubles
              </button>
            </div>
          </div>

          {/* Custom Match Code Input Form */}
          <form onSubmit={handleApplyCustomCode} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Or enter custom match code..."
              value={customCodeInput}
              onChange={(e) => setCustomCodeInput(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!customCodeInput.trim()}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                customCodeInput.trim()
                  ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              Generate
            </button>
          </form>

          {/* QR Code Graphic Box */}
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative">
            <div className="bg-white p-3.5 rounded-2xl shadow-md border border-slate-200/80 mb-3">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for Match ${selectedCode}`}
                  className={`${isFullscreen ? 'w-80 h-80' : 'w-56 h-56'} object-contain rounded-lg`}
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                  Generating QR Code...
                </div>
              )}
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-900 text-xs font-black uppercase tracking-wider mb-2">
              <Smartphone className="w-3.5 h-3.5 text-amber-600" />
              Scan with Smartphone Camera
            </div>

            <p className="text-xs text-slate-600 max-w-sm font-medium">
              Spectators point their mobile camera at this QR code to load the live scoreboard and real-time throw log directly in their browser.
            </p>

            {/* Active Match Info Chip if available */}
            {spectatorMatch && spectatorMatch.players.length >= 2 && (
              <div className="mt-3 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-900 flex items-center gap-2">
                <span>{spectatorMatch.players[0].name} ({spectatorMatch.players[0].legsWon})</span>
                <span className="text-indigo-400 font-extrabold">VS</span>
                <span>{spectatorMatch.players[1].name} ({spectatorMatch.players[1].legsWon})</span>
              </div>
            )}
          </div>

          {/* Scannable Match URL Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Match URL Link
              </span>
              <p className="text-xs font-mono text-slate-800 truncate select-all">{matchUrl}</p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDownloadQR}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download QR Code (PNG)
            </button>

            <button
              type="button"
              onClick={handlePrintPlacard}
              className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print Board Placard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

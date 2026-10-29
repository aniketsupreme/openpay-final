import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Lock,
  QrCode,
  Copy,
  Check,
  Smartphone,
  Download,
  RefreshCw,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import QRCode from 'qrcode';
import { PaymentLink } from '../lib/types';
import { formatPaiseToInr } from '../lib/bank-parser';
import { CustomerCheckoutModal } from './CustomerCheckoutModal';

interface PaymentLinkViewProps {
  shortCode: string;
}

export const PaymentLinkView: React.FC<PaymentLinkViewProps> = ({ shortCode }) => {
  const [linkData, setLinkData] = useState<{
    paymentLink: PaymentLink;
    transaction_id?: string;
    qr_svg?: string;
    upi_intents?: {
      generic: string;
      gpay: string;
      phonepe: string;
      paytm: string;
      bhim: string;
      cred: string;
    };
    merchant: {
      name: string;
      vpa: string;
      PayeeName: string;
      theme_color: string;
      logo_url?: string;
      gstin: string;
      support_email: string;
    };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [directUtr, setDirectUtr] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [dynamicQrSvg, setDynamicQrSvg] = useState<string>('');
  const [txIdSuffix, setTxIdSuffix] = useState<string>('');
  const [viewMode, setViewMode] = useState<'live' | 'qr'>('live');

  useEffect(() => {
    fetch(`/api/payment-links/${encodeURIComponent(shortCode)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Payment link not found or expired');
        return res.json();
      })
      .then((data) => {
        setLinkData(data);
        setCustomerName(data.paymentLink.customer_name || '');
        setCustomerPhone(data.paymentLink.customer_phone || '');
        setCustomerEmail(data.paymentLink.customer_email || '');
        if (data.qr_svg) {
          setDynamicQrSvg(data.qr_svg);
        }
        if (data.paymentLink.status === 'PAID' && data.paymentLink.paid_session_id) {
          setActiveSessionId(data.paymentLink.paid_session_id);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load payment link');
        setLoading(false);
      });
  }, [shortCode]);

  // Dynamic UPI Payload encoding VPA (pa), Amount (am), and Transaction ID (tr)
  const encodedParams = useMemo(() => {
    if (!linkData) return null;
    const { paymentLink, merchant } = linkData;
    const baseTxId = linkData.transaction_id || `PL-${paymentLink.short_code.toUpperCase()}`;
    const transactionId = txIdSuffix ? `${baseTxId}-${txIdSuffix}` : baseTxId;
    const amountRupeesFixed = (paymentLink.amount_paise / 100).toFixed(2);
    const payeeName = merchant.PayeeName || merchant.name;
    const note = `${paymentLink.title || transactionId}`;

    const pa = encodeURIComponent(merchant.vpa);
    const pn = encodeURIComponent(payeeName);
    const am = amountRupeesFixed;
    const tr = encodeURIComponent(transactionId);
    const tn = encodeURIComponent(note);
    const query = `pa=${pa}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}`;

    return {
      vpa: merchant.vpa,
      payeeName,
      amountRupeesFixed,
      transactionId,
      note,
      genericUri: `upi://pay?${query}`,
      gpayUri: `tez://upi/pay?${query}`,
      phonepeUri: `phonepe://pay?${query}`,
      paytmUri: `paytmmp://pay?${query}`,
      bhimUri: `bhim://upi/pay?${query}`,
    };
  }, [linkData, txIdSuffix]);

  // Dynamically generate vector SVG QR whenever encoded UPI URI changes
  useEffect(() => {
    if (!encodedParams?.genericUri) return;
    let active = true;
    QRCode.toString(encodedParams.genericUri, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (active) setDynamicQrSvg(svg);
      })
      .catch(() => {
        // Fallback to server qr_svg if already set
      });
    return () => {
      active = false;
    };
  }, [encodedParams?.genericUri]);

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleRegenerateTxId = () => {
    const randomTag = Math.floor(1000 + Math.random() * 9000).toString();
    setTxIdSuffix(randomTag);
  };

  const handleDownloadQrSvg = () => {
    if (!dynamicQrSvg || !encodedParams) return;
    const blob = new Blob([dynamicQrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OpenPay-QR-${encodedParams.transactionId}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProceedToPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setUtrError(null);
    const cleanedUtr = directUtr.replace(/\D/g, '').trim();
    if (cleanedUtr.length > 0 && cleanedUtr.length !== 12) {
      setUtrError('UTR / UPI Reference number must be exactly 12 digits.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/payment-links/${encodeURIComponent(shortCode)}/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim() || 'UPI Customer',
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        if (cleanedUtr.length === 12) {
          await fetch(`/api/checkout/sessions/${encodeURIComponent(data.session.id)}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manualUtr: cleanedUtr }),
          });
        }
        setActiveSessionId(data.session.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="h-96 rounded-2xl bg-white border border-slate-200 animate-pulse shadow-sm" />
      </div>
    );
  }

  if (error || !linkData || !encodedParams) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="p-6 rounded-2xl bg-white border border-rose-200 text-center space-y-3 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-base font-display font-semibold text-slate-900">
            Payment Link Unavailable
          </h2>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const { paymentLink, merchant } = linkData;
  const brandColor =
    merchant.theme_color && merchant.theme_color !== '#10B981'
      ? merchant.theme_color
      : '#2563EB';

  if (activeSessionId) {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <CustomerCheckoutModal
          sessionId={activeSessionId}
          isStandalonePage
          merchantLogoUrl={merchant.logo_url}
          primaryAccentColor={brandColor}
        />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        {/* Merchant Header */}
        <div
          className="p-6 text-white flex items-center justify-between"
          style={{ backgroundColor: brandColor }}
        >
          <div className="flex items-center gap-3">
            {merchant.logo_url ? (
              <img
                src={merchant.logo_url}
                alt={merchant.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-display font-bold text-xs text-white">
                {merchant.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-sm font-display font-bold text-white flex items-center gap-1.5">
                <span>{merchant.name}</span>
                <ShieldCheck className="w-4 h-4 text-white/90" />
              </div>
              <div className="text-xs font-mono text-white/80">{merchant.vpa}</div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-white/80">Amount Due</div>
            <div className="text-xl font-mono font-bold text-white tabular-nums">
              {formatPaiseToInr(paymentLink.amount_paise)}
            </div>
          </div>
        </div>

        {/* Invoice Title & Description */}
        <div className="px-6 pt-4 pb-4 border-b border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono text-slate-500">
              PAYMENT LINK · {encodedParams.transactionId}
            </div>
            <h1 className="text-base font-display font-bold text-slate-900">
              {paymentLink.title}
            </h1>
            {paymentLink.description && (
              <p className="text-xs text-slate-600 leading-relaxed">
                {paymentLink.description}
              </p>
            )}
          </div>
          <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-mono font-semibold text-blue-700 shrink-0">
            LIVE PAYMENT FIRST
          </span>
        </div>

        {/* Priority Switcher: 1. Live Payment (Default First) vs 2. Dynamic QR */}
        <div className="px-6 pt-4 pb-2 bg-white border-b border-slate-100">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('live')}
              className={`py-2 px-3 rounded-lg font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'live'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>1. Live Payment (Priority)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('qr')}
              className={`py-2 px-3 rounded-lg font-display font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'qr'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>2. Dynamic QR Code</span>
            </button>
          </div>
        </div>

        {/* PRIORITY #1 (FIRST TO COME): Live Payment Checkout & Instant Verification */}
        {viewMode === 'live' && (
          <form onSubmit={handleProceedToPay} className="p-6 border-b border-slate-200 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-slate-900 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-blue-600" />
                <span>Live Payment Checkout &amp; Real-Time Auto-Verification</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-semibold text-emerald-700">
                PRIORITY #1
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-medium">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium">Email Address (Optional)</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-700 font-medium">
                  12-Digit UPI UTR (If Already Paid)
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={directUtr}
                  onChange={(e) => setDirectUtr(e.target.value.replace(/\D/g, ''))}
                  placeholder="Optional 12-digit UTR"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {utrError && <p className="text-xs text-rose-600 font-medium">{utrError}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl font-display font-semibold text-sm text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-95 cursor-pointer shadow-md"
              style={{ backgroundColor: brandColor }}
            >
              {directUtr.length === 12 ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Verifying Payment...'
                      : `Submit UTR & Verify ${formatPaiseToInr(paymentLink.amount_paise)}`}
                  </span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Opening Live Checkout...'
                      : `Proceed to Live Payment (${formatPaiseToInr(paymentLink.amount_paise)})`}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* 1-Click Mobile UPI App Launchers */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    Or tap any UPI app to pay {formatPaiseToInr(paymentLink.amount_paise)} directly:
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <a
                  href={encodedParams.gpayUri}
                  className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 font-display font-semibold text-slate-800 text-center transition-colors"
                >
                  Google Pay
                </a>
                <a
                  href={encodedParams.phonepeUri}
                  className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 font-display font-semibold text-slate-800 text-center transition-colors"
                >
                  PhonePe
                </a>
                <a
                  href={encodedParams.paytmUri}
                  className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 font-display font-semibold text-slate-800 text-center transition-colors"
                >
                  Paytm
                </a>
                <a
                  href={encodedParams.genericUri}
                  className="py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 font-display font-semibold text-blue-700 text-center transition-colors"
                >
                  Any UPI App
                </a>
              </div>
            </div>
          </form>
        )}

        {/* SECONDARY OPTION #2: Dynamic UPI QR Code Generator Section */}
        {viewMode === 'qr' && (
          <div className="p-6 border-b border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-display font-bold text-slate-900 uppercase tracking-wider">
                  Dynamic UPI QR Code (Scan with Any App)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleRegenerateTxId}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Generate a fresh unique Transaction Reference ID in the QR payload"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>New Tx ID</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQrSvg}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Download Dynamic QR SVG"
                >
                  <Download className="w-3 h-3" />
                  <span>SVG</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              {/* Crisp Vector QR Display */}
              <div className="sm:col-span-5 flex flex-col items-center">
                <div className="p-3.5 rounded-2xl bg-white border-2 border-blue-600/20 shadow-sm relative">
                  {dynamicQrSvg ? (
                    <div
                      className="w-44 h-44 [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: dynamicQrSvg }}
                    />
                  ) : (
                    <div className="w-44 h-44 rounded-xl bg-slate-100 animate-pulse" />
                  )}
                </div>
                <span className="mt-2 text-[11px] text-slate-500 font-medium text-center">
                  GPay · PhonePe · Paytm · BHIM
                </span>
              </div>

              {/* Encoded Parameters Breakdown (VPA, Amount, Transaction ID) */}
              <div className="sm:col-span-7 space-y-2.5 text-xs">
                <div className="text-[11px] font-medium text-slate-500">
                  Encoded Dynamic QR Parameters:
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Merchant VPA (pa)
                    </div>
                    <div className="font-mono font-semibold text-slate-900 truncate">
                      {encodedParams.vpa}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(encodedParams.vpa, 'vpa')}
                    className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-blue-400 text-[11px] font-medium text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedField === 'vpa' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Locked Amount (am)
                    </div>
                    <div className="font-mono font-bold text-blue-600 tabular-nums">
                      ₹{encodedParams.amountRupeesFixed} INR
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-[10px] font-mono font-semibold text-blue-700">
                    PRE-FILLED
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      Transaction ID (tr)
                    </div>
                    <div className="font-mono font-semibold text-slate-900 truncate">
                      {encodedParams.transactionId}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(encodedParams.transactionId, 'tr')}
                    className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-blue-400 text-[11px] font-medium text-slate-700 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedField === 'tr' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(encodedParams.genericUri, 'uri')}
                  className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-mono text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedField === 'uri' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-sans font-semibold">
                        Copied Full UPI Intent URI
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Encoded UPI URI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('live')}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Switch Back to Live Payment Checkout →</span>
            </button>
          </div>
        )}

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-medium">
            <Lock className="w-3 h-3 text-blue-600" />
            <span>OpenPay — By Aniket · Direct-to-Bank UPI</span>
          </span>
          <span className="font-mono">{encodedParams.transactionId}</span>
        </div>
      </div>
    </div>
  );
};

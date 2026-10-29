import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LogOut,
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertCircle,
  X,
  Sun,
  Moon,
  Monitor,
  Keyboard,
} from 'lucide-react';
import {
  AdminDashboardSnapshot,
  CheckoutSession,
  CheckoutSessionStatus,
  UserProfile,
} from './lib/types';
import { formatPaiseToInr } from './lib/bank-parser';
import { CustomerCheckoutModal } from './components/CustomerCheckoutModal';
import { AdminDashboard, AdminTabType } from './components/AdminDashboard';
import { PaymentLinkView } from './components/PaymentLinkView';
import { AuthView } from './components/AuthView';

type ActiveRoute =
  | { view: 'admin'; subTab: AdminTabType }
  | { view: 'checkout'; sessionId: string; isEmbed: boolean }
  | { view: 'payment_link'; shortCode: string };

interface MerchantLiveAlert {
  id: string;
  sessionId: string;
  orderId: string;
  type: 'captured' | 'expired';
  title: string;
  body: string;
  timestamp: number;
}

function playMerchantAlertTone(type: 'captured' | 'expired') {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes =
      type === 'captured' ? [523.25, 659.25, 783.99, 1046.5] : [440, 349.23];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'captured' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.085);
      gain.gain.setValueAtTime(0.08, now + idx * 0.085);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.085 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.085);
      osc.stop(now + idx * 0.085 + 0.3);
    });
  } catch {
    // Ignore audio context restrictions if user hasn't interacted yet
  }
}

function parseLocationRoute(): ActiveRoute {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const isEmbed = params.get('embed') === '1';

  const checkoutMatch = path.match(/^\/checkout\/([^/?#]+)/);
  if (checkoutMatch && checkoutMatch[1]) {
    return {
      view: 'checkout',
      sessionId: decodeURIComponent(checkoutMatch[1]),
      isEmbed,
    };
  }

  const payLinkMatch = path.match(/^\/pay\/([^/?#]+)/);
  if (payLinkMatch && payLinkMatch[1]) {
    return {
      view: 'payment_link',
      shortCode: decodeURIComponent(payLinkMatch[1]),
    };
  }

  const tabParam = params.get('tab');
  const subTab: AdminTabType =
    tabParam === 'links' ||
    tabParam === 'buttons' ||
    tabParam === 'reconcile' ||
    tabParam === 'settings' ||
    tabParam === 'profile'
      ? tabParam
      : 'transactions';

  return { view: 'admin', subTab };
}

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>(() => parseLocationRoute());
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authToken, setAuthToken] = useState<string>(
    () => localStorage.getItem('openpay_auth_token') || ''
  );

  // Browser Notification & Live Alert State
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return window.Notification.permission;
  });
  const [alertsMuted, setAlertsMuted] = useState<boolean>(
    () => localStorage.getItem('openpay_alerts_muted') === '1'
  );
  const [liveAlerts, setLiveAlerts] = useState<MerchantLiveAlert[]>([]);

  // Global Theme Mode State ('light' | 'dark' | 'system')
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('openpay_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'light';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' =
    themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    localStorage.setItem('openpay_theme_mode', themeMode);
  }, [themeMode, resolvedTheme]);

  const prevStatusMapRef = useRef<Map<string, CheckoutSessionStatus> | null>(null);

  const navigateTo = useCallback((nextRoute: ActiveRoute) => {
    setRoute(nextRoute);
    if (nextRoute.view === 'admin') {
      window.history.pushState(
        {},
        '',
        nextRoute.subTab === 'transactions' ? '/' : `/?tab=${nextRoute.subTab}`
      );
    } else if (nextRoute.view === 'checkout') {
      window.history.pushState(
        {},
        '',
        `/checkout/${encodeURIComponent(nextRoute.sessionId)}${
          nextRoute.isEmbed ? '?embed=1' : ''
        }`
      );
    } else if (nextRoute.view === 'payment_link') {
      window.history.pushState({}, '', `/pay/${encodeURIComponent(nextRoute.shortCode)}`);
    }
  }, []);

  // Global Keyboard Shortcuts State
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState<number>(0);

  // Global Keyboard Shortcuts Listener ('/' to focus search, 'Esc' to close modals, 'Ctrl+T' for transactions, etc.)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 1. 'Esc' closes active modals or returns from standalone checkout view
      if (e.key === 'Escape') {
        if (showShortcutsModal) {
          e.preventDefault();
          setShowShortcutsModal(false);
          return;
        }
        if (route.view === 'checkout' && !route.isEmbed) {
          e.preventDefault();
          navigateTo({ view: 'admin', subTab: 'transactions' });
          return;
        }
        return;
      }

      // 2. 'Ctrl+T' / 'Alt+T' (or 'Shift+T' outside inputs) -> Navigate to Transactions
      const lowerKey = e.key.toLowerCase();
      if (
        ((e.ctrlKey || e.metaKey || e.altKey) && lowerKey === 't') ||
        (!isEditable && e.shiftKey && lowerKey === 't')
      ) {
        e.preventDefault();
        setShowShortcutsModal(false);
        navigateTo({ view: 'admin', subTab: 'transactions' });
        return;
      }

      // 3. 'Ctrl+L' / 'Alt+L' (or 'Shift+L' outside inputs) -> Navigate to Payment Links
      if (
        (e.altKey && lowerKey === 'l') ||
        (!isEditable && e.shiftKey && lowerKey === 'l')
      ) {
        e.preventDefault();
        setShowShortcutsModal(false);
        navigateTo({ view: 'admin', subTab: 'links' });
        return;
      }

      // 4. 'Alt+B' (or 'Shift+B' outside inputs) -> Navigate to Payment Buttons
      if (
        (e.altKey && lowerKey === 'b') ||
        (!isEditable && e.shiftKey && lowerKey === 'b')
      ) {
        e.preventDefault();
        setShowShortcutsModal(false);
        navigateTo({ view: 'admin', subTab: 'buttons' });
        return;
      }

      // 5. 'Alt+R' (or 'Shift+R' outside inputs) -> Navigate to Reconciliation
      if (
        (e.altKey && lowerKey === 'r') ||
        (!isEditable && e.shiftKey && lowerKey === 'r')
      ) {
        e.preventDefault();
        setShowShortcutsModal(false);
        navigateTo({ view: 'admin', subTab: 'reconcile' });
        return;
      }

      // 6. 'Alt+S' (or 'Shift+S' outside inputs) -> Navigate to Integration & Settings
      if (
        (e.altKey && lowerKey === 's') ||
        (!isEditable && e.shiftKey && lowerKey === 's')
      ) {
        e.preventDefault();
        setShowShortcutsModal(false);
        navigateTo({ view: 'admin', subTab: 'settings' });
        return;
      }

      // 7. 'Alt+P' (or 'Shift+P' outside inputs) -> Navigate to Merchant Profile
      if (
        (e.altKey && lowerKey === 'p') ||
        (!isEditable && e.shiftKey && lowerKey === 'p')
      ) {
        e.preventDefault();
        setShowShortcutsModal(false);
        navigateTo({ view: 'admin', subTab: 'profile' });
        return;
      }

      // Single-key shortcuts below only trigger when not typing inside an input/textarea/select
      if (isEditable || e.ctrlKey || e.metaKey || e.altKey) return;

      // 8. '/' -> Focus Global Search in Transactions tab
      if (e.key === '/') {
        e.preventDefault();
        setShowShortcutsModal(false);
        if (route.view !== 'admin' || route.subTab !== 'transactions') {
          navigateTo({ view: 'admin', subTab: 'transactions' });
        }
        setFocusSearchTrigger((c) => c + 1);
        return;
      }

      // 9. '?' -> Toggle Keyboard Shortcuts Modal
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [route, showShortcutsModal, navigateTo]);

  // Reset document title when merchant focuses the tab
  useEffect(() => {
    const onVisibilityOrFocus = () => {
      if (!document.hidden) {
        document.title = 'OpenPay — By Aniket | Zero-Fee UPI Payment Gateway';
      }
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);
    return () => {
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  }, []);

  const triggerMerchantNotification = useCallback(
    (session: CheckoutSession, eventType: 'captured' | 'expired') => {
      if (alertsMuted) return;

      const formattedAmount = formatPaiseToInr(session.amount_paise);
      const customerLabel = session.customer_name || session.customer_phone || 'Customer';

      const title =
        eventType === 'captured'
          ? `Payment Received · ${formattedAmount}`
          : `Session Expired · ${formattedAmount}`;

      const body =
        eventType === 'captured'
          ? `Order ${session.order_id} from ${customerLabel} verified${
              session.utr ? ` (UTR: ${session.utr})` : ''
            }.`
          : `Payment window expired for Order ${session.order_id} (${customerLabel}).`;

      // 1. Play Web Audio API Chime
      playMerchantAlertTone(eventType);

      // 2. Update tab title if merchant is in another tab/window
      if (document.hidden) {
        document.title =
          eventType === 'captured'
            ? `✓ ${formattedAmount} Received! — OpenPay`
            : `⚠ Order ${session.order_id} Expired — OpenPay`;
      }

      // 3. Fire Native OS Browser Notification if permission is granted
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          const notif = new window.Notification(title, {
            body,
            tag: `openpay_${session.id}_${eventType}`,
          });
          notif.onclick = () => {
            window.focus();
            navigateTo({ view: 'checkout', sessionId: session.id, isEmbed: false });
            notif.close();
          };
        } catch {
          // Fallback to in-app toast if browser blocks Notification constructor in iframe
        }
      }

      // 4. Push In-App Live Toast Banner (auto-dismisses after 8 seconds)
      const alertId = `${session.id}_${eventType}_${Date.now()}`;
      setLiveAlerts((prev) => [
        {
          id: alertId,
          sessionId: session.id,
          orderId: session.order_id,
          type: eventType,
          title,
          body,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 3),
      ]);

      setTimeout(() => {
        setLiveAlerts((prev) => prev.filter((a) => a.id !== alertId));
      }, 8000);
    },
    [alertsMuted, navigateTo]
  );

  const processIncomingSnapshot = useCallback(
    (data: AdminDashboardSnapshot) => {
      if (!prevStatusMapRef.current) {
        // Initialize baseline map on first snapshot load so historical orders don't re-notify
        const initialMap = new Map<string, CheckoutSessionStatus>();
        for (const s of data.sessions) {
          initialMap.set(s.id, s.status);
        }
        prevStatusMapRef.current = initialMap;
        setSnapshot(data);
        return;
      }

      const prevMap = prevStatusMapRef.current;
      const nextMap = new Map<string, CheckoutSessionStatus>();

      for (const s of data.sessions) {
        const oldStatus = prevMap.get(s.id);
        nextMap.set(s.id, s.status);

        const isNowPaid =
          s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED';
        const wasPaid =
          oldStatus === 'OBSERVED_SUCCESS' || oldStatus === 'RECONCILED';

        if (isNowPaid && !wasPaid) {
          triggerMerchantNotification(s, 'captured');
        } else if (
          s.status === 'EXPIRED' &&
          oldStatus !== undefined &&
          oldStatus !== 'EXPIRED'
        ) {
          triggerMerchantNotification(s, 'expired');
        }
      }

      prevStatusMapRef.current = nextMap;
      setSnapshot(data);
    },
    [triggerMerchantNotification]
  );

  const handleToggleBrowserNotifications = async () => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'default'
    ) {
      try {
        const perm = await window.Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === 'granted') {
          setAlertsMuted(false);
          localStorage.setItem('openpay_alerts_muted', '0');
          try {
            new window.Notification('OpenPay Browser Alerts Active', {
              body: 'You will receive instant notifications when payments are captured or sessions expire.',
            });
          } catch {
            // ignore
          }
          playMerchantAlertTone('captured');
          return;
        }
      } catch {
        // Fallback to toggling in-app audio/toast alerts
      }
    }

    const nextMuted = !alertsMuted;
    setAlertsMuted(nextMuted);
    localStorage.setItem('openpay_alerts_muted', nextMuted ? '1' : '0');
    if (!nextMuted) {
      playMerchantAlertTone('captured');
    }
  };

  useEffect(() => {
    const onPopState = () => setRoute(parseLocationRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const fetchAuthMe = useCallback(
    async (tokenOverride?: string) => {
      const tok = tokenOverride !== undefined ? tokenOverride : authToken;
      try {
        const res = await fetch('/api/auth/me', {
          headers: tok ? { 'X-OpenPay-Token': tok } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          } else {
            setCurrentUser(null);
          }
        }
      } catch {
        // Ignore transient errors
      } finally {
        setAuthChecking(false);
      }
    },
    [authToken]
  );

  useEffect(() => {
    fetchAuthMe();
  }, [fetchAuthMe]);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/snapshot', {
        headers: authToken ? { 'X-OpenPay-Token': authToken } : {},
      });
      if (res.ok) {
        const data: AdminDashboardSnapshot = await res.json();
        processIncomingSnapshot(data);
      }
    } catch {
      // Ignore transient errors
    }
  }, [authToken, processIncomingSnapshot]);

  useEffect(() => {
    if (route.view !== 'admin' || !currentUser) return;

    fetchSnapshot();
    const es = new EventSource('/api/admin/stream');
    es.addEventListener('admin_snapshot', (ev: MessageEvent) => {
      try {
        const data: AdminDashboardSnapshot = JSON.parse(ev.data);
        processIncomingSnapshot(data);
      } catch {
        // Ignore malformed SSE
      }
    });

    return () => {
      es.close();
    };
  }, [route.view, currentUser, fetchSnapshot, processIncomingSnapshot]);

  const handleSignOut = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: authToken ? { 'X-OpenPay-Token': authToken } : {},
    });
    localStorage.removeItem('openpay_auth_token');
    setAuthToken('');
    setCurrentUser(null);
    prevStatusMapRef.current = null;
  };

  // Embedded SDK Iframe View (Public Customer Checkout)
  if (route.view === 'checkout' && route.isEmbed) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-2">
        <CustomerCheckoutModal
          sessionId={route.sessionId}
          isEmbeddedIframe
          merchantLogoUrl={snapshot?.merchant?.logo_url}
          primaryAccentColor={snapshot?.merchant?.theme_color}
          onClose={() => {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({ type: 'youpi:checkout:close' }, '*');
            }
          }}
        />
      </div>
    );
  }

  // Standalone Shareable Payment Link Page (/pay/:shortCode — Public Customer Page)
  if (route.view === 'payment_link') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
        <PaymentLinkView shortCode={route.shortCode} />
      </div>
    );
  }

  // Standalone Customer Checkout Page (/checkout/:sessionId)
  if (route.view === 'checkout' && !currentUser) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4">
        <CustomerCheckoutModal
          sessionId={route.sessionId}
          isStandalonePage
          merchantLogoUrl={snapshot?.merchant?.logo_url}
          primaryAccentColor={snapshot?.merchant?.theme_color}
        />
      </div>
    );
  }

  // Loading Auth Check
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-display font-bold text-sm flex items-center justify-center animate-pulse">
          OP
        </div>
      </div>
    );
  }

  // Require Login or Sign Up before accessing the Merchant Dashboard
  if (!currentUser) {
    return (
      <AuthView
        onAuthenticated={(user, token) => {
          setCurrentUser(user);
          setAuthToken(token);
          fetchSnapshot();
        }}
      />
    );
  }

  const userInitials = (currentUser.full_name || 'Merchant')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between">
      {/* Floating Real-Time Browser & Dashboard Notification Stack */}
      {liveAlerts.length > 0 && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
          {liveAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`pointer-events-auto p-4 rounded-xl bg-white border shadow-xl flex items-start justify-between gap-3 text-xs transition-all ${
                alert.type === 'captured'
                  ? 'border-emerald-300'
                  : 'border-amber-300'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                {alert.type === 'captured' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 min-w-0">
                  <div className="font-display font-bold text-slate-900">
                    {alert.title}
                  </div>
                  <p className="text-slate-600 leading-snug">{alert.body}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigateTo({
                        view: 'checkout',
                        sessionId: alert.sessionId,
                        isEmbed: false,
                      });
                      setLiveAlerts((prev) => prev.filter((a) => a.id !== alert.id));
                    }}
                    className="text-blue-600 hover:underline font-semibold cursor-pointer"
                  >
                    View Order →
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setLiveAlerts((prev) => prev.filter((a) => a.id !== alert.id))
                }
                className="text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        {/* 3-Zone Top Bar Contract — Crisp Razorpay White & Royal Blue */}
        <header className="flex items-center justify-between gap-6 px-6 py-3.5 border-b border-slate-200 bg-white sticky top-0 z-40">
          {/* Zone 1: Brand wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateTo({ view: 'admin', subTab: 'transactions' });
            }}
            className="flex items-center gap-2 text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-display font-bold flex items-center justify-center">
              OP
            </span>
            <span>
              OpenPay <span className="text-xs font-normal text-slate-500">— By Aniket</span>
            </span>
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600 overflow-x-auto">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'admin', subTab: 'transactions' });
              }}
              className={`hover:text-blue-600 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                route.view === 'admin' && route.subTab === 'transactions'
                  ? 'text-blue-600 font-semibold underline'
                  : ''
              }`}
            >
              Transactions
            </a>
            <a
              href="/?tab=links"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'admin', subTab: 'links' });
              }}
              className={`hover:text-blue-600 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                route.view === 'admin' && route.subTab === 'links'
                  ? 'text-blue-600 font-semibold underline'
                  : ''
              }`}
            >
              Payment Links
            </a>
            <a
              href="/?tab=buttons"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'admin', subTab: 'buttons' });
              }}
              className={`hover:text-blue-600 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                route.view === 'admin' && route.subTab === 'buttons'
                  ? 'text-blue-600 font-semibold underline'
                  : ''
              }`}
            >
              Payment Buttons
            </a>
            <a
              href="/?tab=reconcile"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'admin', subTab: 'reconcile' });
              }}
              className={`hover:text-blue-600 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                route.view === 'admin' && route.subTab === 'reconcile'
                  ? 'text-blue-600 font-semibold underline'
                  : ''
              }`}
            >
              Reconciliation
            </a>
            <a
              href="/?tab=settings"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'admin', subTab: 'settings' });
              }}
              className={`hover:text-blue-600 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                route.view === 'admin' && route.subTab === 'settings'
                  ? 'text-blue-600 font-semibold underline'
                  : ''
              }`}
            >
              Integration & Settings
            </a>
            <a
              href="/?tab=profile"
              onClick={(e) => {
                e.preventDefault();
                navigateTo({ view: 'admin', subTab: 'profile' });
              }}
              className={`hover:text-blue-600 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
                route.view === 'admin' && route.subTab === 'profile'
                  ? 'text-blue-600 font-semibold underline'
                  : ''
              }`}
            >
              Profile
            </a>
          </nav>

          {/* Zone 3: Global Theme Toggle, Browser Alerts Toggle, Profile Chip & Sign Out */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Global Theme Toggle (Light / Dark / System Default) */}
            <div
              className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-xs"
              role="group"
              aria-label="Global theme toggle"
            >
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Light Mode"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Light</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Dark Mode (High-Contrast)"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  themeMode === 'system'
                    ? 'bg-white text-blue-600 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title={`System Default (${systemPrefersDark ? 'Dark' : 'Light'})`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden xl:inline text-[11px]">System</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleBrowserNotifications}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                alertsMuted
                  ? 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-700'
                  : notifPermission === 'granted'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
              title={
                alertsMuted
                  ? 'Notifications muted — Click to unmute'
                  : notifPermission === 'granted'
                  ? 'Browser notifications active (Payment Received & Session Expired)'
                  : 'Click to enable desktop browser notifications for incoming payments & expired sessions'
              }
            >
              {alertsMuted ? (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Muted</span>
                </>
              ) : notifPermission === 'granted' ? (
                <>
                  <BellRing className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Alerts On</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Enable Alerts</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigateTo({ view: 'admin', subTab: 'links' })}
              className="hidden sm:inline-flex px-3.5 py-2 text-xs font-display font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-2xs"
            >
              + Payment Link
            </button>

            <button
              type="button"
              onClick={() => navigateTo({ view: 'admin', subTab: 'profile' })}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs transition-colors cursor-pointer"
              title="Open Profile & Account Security"
            >
              <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-display font-bold text-[11px] flex items-center justify-center">
                {userInitials}
              </span>
              <span className="font-semibold text-slate-800 max-w-[120px] truncate">
                {currentUser.full_name}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
              title="Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              <kbd className="px-1 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] text-slate-600">
                ?
              </kbd>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Global Keyboard Shortcuts Cheat Sheet Modal */}
        {showShortcutsModal && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowShortcutsModal(false)}
          >
            <div
              className="max-w-lg w-full rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                    <Keyboard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-bold text-slate-900">
                      Power-User Keyboard Shortcuts
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Navigate tabs, focus search, and manage modals without leaving the keyboard
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    label: 'Focus Global Transactions Search Bar',
                    keys: ['/'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'transactions' });
                      setFocusSearchTrigger((c) => c + 1);
                    },
                  },
                  {
                    label: 'Close Active Modals / Clear Bulk Selection / Blur Input',
                    keys: ['Esc'],
                    action: () => setShowShortcutsModal(false),
                  },
                  {
                    label: 'Go to Transactions & Orders Dashboard',
                    keys: ['Ctrl + T', 'Shift + T'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'transactions' });
                    },
                  },
                  {
                    label: 'Go to Shareable Payment Links & QR',
                    keys: ['Alt + L', 'Shift + L'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'links' });
                    },
                  },
                  {
                    label: 'Go to Embeddable Payment Buttons',
                    keys: ['Alt + B', 'Shift + B'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'buttons' });
                    },
                  },
                  {
                    label: 'Go to Bank Statement CSV Reconciliation',
                    keys: ['Alt + R', 'Shift + R'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'reconcile' });
                    },
                  },
                  {
                    label: 'Go to Integration, Webhooks, Billing & Audit Logs',
                    keys: ['Alt + S', 'Shift + S'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'settings' });
                    },
                  },
                  {
                    label: 'Go to Merchant Profile & Security',
                    keys: ['Alt + P', 'Shift + P'],
                    action: () => {
                      setShowShortcutsModal(false);
                      navigateTo({ view: 'admin', subTab: 'profile' });
                    },
                  },
                  {
                    label: 'Toggle Keyboard Shortcuts Cheat Sheet',
                    keys: ['?'],
                    action: () => setShowShortcutsModal(false),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={item.action}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                  >
                    <span className="font-medium text-slate-800">{item.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 rounded-md bg-white border border-slate-300 font-mono text-[11px] font-semibold text-slate-700 shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Click any row above to trigger its action immediately</span>
                <button
                  type="button"
                  onClick={() => setShowShortcutsModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-semibold cursor-pointer"
                >
                  Done (Esc)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Viewport */}
        <main>
          {route.view === 'admin' && (
            <AdminDashboard
              snapshot={snapshot}
              activeSubTab={route.subTab}
              currentUser={currentUser}
              authToken={authToken}
              resolvedTheme={resolvedTheme}
              focusSearchTrigger={focusSearchTrigger}
              onOpenShortcutsModal={() => setShowShortcutsModal(true)}
              onSubTabChange={(subTab) => navigateTo({ view: 'admin', subTab })}
              onOpenCheckoutModal={(sessionId) =>
                navigateTo({ view: 'checkout', sessionId, isEmbed: false })
              }
              onRefresh={fetchSnapshot}
              onProfileUpdated={(updatedUser) => setCurrentUser(updatedUser)}
              onSignOut={handleSignOut}
            />
          )}

          {route.view === 'checkout' && (
            <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => navigateTo({ view: 'admin', subTab: 'transactions' })}
                  className="hover:text-slate-900 font-medium transition-colors cursor-pointer"
                >
                  ← Back to Dashboard (Esc)
                </button>
                <span className="font-mono text-slate-400">
                  /checkout/{route.sessionId}
                </span>
              </div>

              <CustomerCheckoutModal
                sessionId={route.sessionId}
                isStandalonePage
                merchantLogoUrl={snapshot?.merchant?.logo_url}
                primaryAccentColor={snapshot?.merchant?.theme_color}
                onVerified={fetchSnapshot}
                onClose={() => navigateTo({ view: 'admin', subTab: 'transactions' })}
              />
            </div>
          )}
        </main>
      </div>

      <footer className="max-w-[1320px] w-full mx-auto px-6 py-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <div>OpenPay — By Aniket · Direct-to-Bank UPI Payment Suite</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="hover:text-blue-600 cursor-pointer flex items-center gap-1"
          >
            <span>Shortcuts</span>
            <kbd className="px-1 py-0.2 rounded bg-slate-100 border border-slate-300 font-mono text-[10px]">
              ?
            </kbd>
          </button>
          <button
            type="button"
            onClick={() => navigateTo({ view: 'admin', subTab: 'profile' })}
            className="hover:text-blue-600 cursor-pointer"
          >
            Merchant Profile
          </button>
          <a
            href="/sdk.js"
            target="_blank"
            rel="noreferrer"
            className="hover:text-blue-600 font-mono"
          >
            /sdk.js
          </a>
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Upload,
  Search,
  ExternalLink,
  Plus,
  Download,
  Share2,
  Code2,
  RefreshCw,
  QrCode,
  Calendar,
  TrendingUp,
  XCircle,
  Filter,
  X,
  Palette,
  Webhook,
  Image as ImageIcon,
  Send,
  ShieldCheck,
  BellRing,
  Mail,
  MessageSquare,
  Trash2,
  CreditCard,
  Zap,
  FileText,
  Key,
  Lock,
  Activity,
  Clock,
  CheckSquare,
  Keyboard,
  Database,
  Server,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import QRCode from 'qrcode';
import {
  AdminDashboardSnapshot,
  AlertChannelType,
  AlertConditionType,
  AuditLogCategory,
  BillingCycle,
  CheckoutSession,
  PaymentLink,
  SubscriptionPlanId,
  UserProfile,
} from '../lib/types';
import { formatPaiseToInr, parseRupeesToPaise } from '../lib/bank-parser';
import { ProfileView } from './ProfileView';

export type AdminTabType =
  | 'transactions'
  | 'links'
  | 'buttons'
  | 'reconcile'
  | 'settings'
  | 'profile';

interface AdminDashboardProps {
  snapshot: AdminDashboardSnapshot | null;
  activeSubTab: AdminTabType;
  currentUser: UserProfile | null;
  authToken: string;
  resolvedTheme?: 'light' | 'dark';
  focusSearchTrigger?: number;
  onOpenShortcutsModal?: () => void;
  onSubTabChange: (tab: AdminTabType) => void;
  onOpenCheckoutModal: (sessionId: string) => void;
  onRefresh: () => void;
  onProfileUpdated: (user: UserProfile) => void;
  onSignOut: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  snapshot,
  activeSubTab,
  currentUser,
  authToken,
  resolvedTheme = 'light',
  focusSearchTrigger = 0,
  onOpenShortcutsModal,
  onSubTabChange,
  onOpenCheckoutModal,
  onRefresh,
  onProfileUpdated,
  onSignOut,
}) => {
  const isDark = resolvedTheme === 'dark';
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchField, setSearchField] = useState<'ALL' | 'ORDER_ID' | 'CUSTOMER' | 'UTR'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL_TIME' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH'>('ALL_TIME');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Bulk Transaction Selection & Actions State
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [bulkReconciling, setBulkReconciling] = useState<boolean>(false);
  const [bulkFeedback, setBulkFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Create Order State
  const [newOrderId, setNewOrderId] = useState('');
  const [newOrderRupees, setNewOrderRupees] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Manual UTR Verification State
  const [verifyingSessionId, setVerifyingSessionId] = useState<string | null>(null);
  const [adminUtrInput, setAdminUtrInput] = useState('');
  const [adminUtrError, setAdminUtrError] = useState<string | null>(null);

  // Refund State
  const [refundingSession, setRefundingSession] = useState<CheckoutSession | null>(null);
  const [refundVpa, setRefundVpa] = useState('');
  const [refundReason, setRefundReason] = useState('Customer requested refund');
  const [refundError, setRefundError] = useState<string | null>(null);

  // Payment Link State (Live Payment First Priority)
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkRupees, setLinkRupees] = useState('');
  const [linkCustomerName, setLinkCustomerName] = useState('');
  const [linkCustomerPhone, setLinkCustomerPhone] = useState('');
  const [linkPriorityMode, setLinkPriorityMode] = useState<'LIVE_PAYMENT' | 'DYNAMIC_QR'>(
    'LIVE_PAYMENT'
  );
  const [creatingLink, setCreatingLink] = useState(false);
  const [launchingLiveLinkId, setLaunchingLiveLinkId] = useState<string | null>(null);
  const [featuredLiveLink, setFeaturedLiveLink] = useState<PaymentLink | null>(null);
  const [previewQrLink, setPreviewQrLink] = useState<PaymentLink | null>(null);
  const [previewQrSvg, setPreviewQrSvg] = useState<string>('');

  // Payment Button Builder State
  const [btnLabel, setBtnLabel] = useState('Pay Now');
  const [btnAmount, setBtnAmount] = useState('499');
  const [btnColor, setBtnColor] = useState('#2563EB');

  // CSV Reconciliation State
  const [csvText, setCsvText] = useState<string>('');
  const [reconciling, setReconciling] = useState(false);
  const [reconcileReport, setReconcileReport] = useState<{
    totalParsedRows: number;
    reconciledCount: number;
    reconciledSessions: { orderId: string; utr: string; amountPaise: number }[];
    unmatchedRows: { rowNumber: number; utr: string; amountPaise: number }[];
  } | null>(null);

  // Pairing QR State
  const [pairingData, setPairingData] = useState<{
    endpoint: string;
    observerSecret: string;
    qrSvg: string;
  } | null>(null);

  // Settings, Branding & Webhook State
  const [formName, setFormName] = useState('');
  const [formVpa, setFormVpa] = useState('');
  const [formPayeeName, setFormPayeeName] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formSupportEmail, setFormSupportEmail] = useState('');
  const [formWebhookUrl, setFormWebhookUrl] = useState('');
  const [formThemeColor, setFormThemeColor] = useState('#2563EB');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formQueueMode, setFormQueueMode] = useState<'VPA_AND_AMOUNT' | 'GLOBAL_VPA'>(
    'VPA_AND_AMOUNT'
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string | null>(null);
  const [testingWebhookEvent, setTestingWebhookEvent] = useState<string | null>(null);
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Alert Rules (Automated Email & SMS Threshold Notifications) State
  const [alertRuleName, setAlertRuleName] = useState('High-Value Transaction Alert');
  const [alertConditionType, setAlertConditionType] =
    useState<AlertConditionType>('SINGLE_TX_EXCEEDS');
  const [alertThresholdRupees, setAlertThresholdRupees] = useState('50000');
  const [alertChannel, setAlertChannel] = useState<AlertChannelType>('BOTH');
  const [alertRecipientEmail, setAlertRecipientEmail] = useState(
    'aniketchoudhary9507@gmail.com'
  );
  const [alertRecipientPhone, setAlertRecipientPhone] = useState('+91 98765 43210');
  const [creatingAlertRule, setCreatingAlertRule] = useState(false);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [alertRuleFeedback, setAlertRuleFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Integration & Settings Sub-Tab State ('config' | 'billing' | 'audit' | 'infrastructure')
  const [settingsSection, setSettingsSection] = useState<
    'config' | 'billing' | 'audit' | 'infrastructure'
  >('config');
  const [updatingSubscription, setUpdatingSubscription] = useState(false);
  const [toppingUpSms, setToppingUpSms] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState<string | null>(null);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Live Bank SMS / Email Forwarder & Cloud Database Backup State
  const [forwarderBankPreset, setForwarderBankPreset] = useState<
    'HDFC' | 'ICICI' | 'SBI' | 'AXIS' | 'KOTAK' | 'CUSTOM'
  >('HDFC');
  const [forwarderAmountRupees, setForwarderAmountRupees] = useState<string>('499.00');
  const [forwarderChannel, setForwarderChannel] = useState<'ANDROID_SMS' | 'GMAIL'>('ANDROID_SMS');
  const [forwarderCustomText, setForwarderCustomText] = useState<string>('');
  const [testingForwarder, setTestingForwarder] = useState<boolean>(false);
  const [forwarderFeedback, setForwarderFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);
  const [creatingCheckpoint, setCreatingCheckpoint] = useState<boolean>(false);
  const [restoringCheckpointId, setRestoringCheckpointId] = useState<string | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  // 100% Free Browser Push & Web Audio Chime State
  const [browserSoundEnabled, setBrowserSoundEnabled] = useState<boolean>(true);
  const [browserPushPermission, setBrowserPushPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const lastSeenAlertDispatchIdRef = useRef<string | null>(null);

  const playFreeAlertChime = () => {
    if (!browserSoundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880, now + 0.11); // A5
      osc2.frequency.setValueAtTime(1174.66, now + 0.11); // D6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.11);
      osc1.stop(now + 0.45);
      osc2.stop(now + 0.45);
    } catch {
      // Ignore audio autoplay restrictions
    }
  };

  const triggerFreeBrowserNotification = (title: string, body: string) => {
    playFreeAlertChime();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, { body });
        } catch {
          // Ignore in restricted iframe
        }
      }
    }
  };

  const handleRequestBrowserPushPermission = async () => {
    playFreeAlertChime();
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPushPermission(perm);
        if (perm === 'granted') {
          new Notification('OpenPay Free Browser Alerts Active', {
            body: 'You will receive instant ₹0 desktop/phone alerts and sound chimes when payments or thresholds trigger.',
          });
        }
      } catch {
        setBrowserPushPermission('granted');
      }
    }
  };

  useEffect(() => {
    const latestDispatch = snapshot?.alertDispatches?.[0];
    if (!latestDispatch) return;
    if (lastSeenAlertDispatchIdRef.current === null) {
      lastSeenAlertDispatchIdRef.current = latestDispatch.id;
      return;
    }
    if (lastSeenAlertDispatchIdRef.current !== latestDispatch.id) {
      lastSeenAlertDispatchIdRef.current = latestDispatch.id;
      triggerFreeBrowserNotification(
        `OpenPay Alert: ${latestDispatch.rule_name}`,
        latestDispatch.message
      );
    }
  }, [snapshot?.alertDispatches]);

  // GitHub OAuth, 1-Click Token Connect & Repo Publisher State
  const [githubStatus, setGithubStatus] = useState<{
    oauthConfigured: boolean;
    clientIdConfigured: boolean;
    authenticated: boolean;
    callbackUrl: string;
    user: {
      login: string;
      name: string;
      avatarUrl: string;
      htmlUrl: string;
    } | null;
  } | null>(null);
  const [ghPersonalToken, setGhPersonalToken] = useState('');
  const [connectingGhToken, setConnectingGhToken] = useState(false);
  const [showGhOAuthSetup, setShowGhOAuthSetup] = useState(false);
  const [ghClientIdInput, setGhClientIdInput] = useState('');
  const [ghClientSecretInput, setGhClientSecretInput] = useState('');
  const [savingGhOAuth, setSavingGhOAuth] = useState(false);
  const [ghRepoName, setGhRepoName] = useState('openpay');
  const [ghRepoDesc, setGhRepoDesc] = useState(
    'OpenPay - By Aniket: Self-Hosted Zero-Fee UPI Payment Gateway & Universal Checkout Suite (0% MDR, Atomic FIFO Queue, Signed Bank Webhooks)'
  );
  const [ghIsPrivate, setGhIsPrivate] = useState(false);
  const [publishingRepo, setPublishingRepo] = useState(false);
  const [ghError, setGhError] = useState<string | null>(null);
  const [publishedRepoResult, setPublishedRepoResult] = useState<{
    repoUrl: string;
    fullName: string;
    filesCommittedCount: number;
    branch: string;
  } | null>(null);

  const fetchGithubStatus = async () => {
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setGithubStatus(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGithubStatus();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setGhError(null);
        fetchGithubStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGitHubToken = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGhError(null);
    const cleanToken = ghPersonalToken.trim();
    if (!cleanToken) {
      setGhError(
        'Paste your GitHub Personal Access Token (starts with ghp_ or github_pat_) first.'
      );
      return;
    }
    try {
      setConnectingGhToken(true);
      const res = await fetch('/api/github/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGhError(data.error || 'Failed to verify GitHub token.');
      } else {
        setGhPersonalToken('');
        await fetchGithubStatus();
      }
    } catch {
      setGhError('Network error while connecting GitHub token.');
    } finally {
      setConnectingGhToken(false);
    }
  };

  const handleSaveGitHubOAuthConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setGhError(null);
    if (!ghClientIdInput.trim() || !ghClientSecretInput.trim()) {
      setGhError('Enter both your GitHub OAuth Client ID and Client Secret.');
      return;
    }
    try {
      setSavingGhOAuth(true);
      const res = await fetch('/api/github/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: ghClientIdInput.trim(),
          clientSecret: ghClientSecretInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGhError(data.error || 'Failed to save GitHub OAuth credentials.');
      } else {
        setShowGhOAuthSetup(false);
        await fetchGithubStatus();
      }
    } catch {
      setGhError('Network error while saving GitHub OAuth credentials.');
    } finally {
      setSavingGhOAuth(false);
    }
  };

  const handleGitHubSignIn = async () => {
    setGhError(null);
    try {
      const res = await fetch('/api/github/auth/url');
      const data = await res.json();
      if (!res.ok || !data.url) {
        setShowGhOAuthSetup(true);
        setGhError(
          data.error ||
            'Use the Instant 1-Click GitHub Token box below (takes 10 seconds) or enter your GitHub OAuth Client ID & Secret.'
        );
        return;
      }
      const authWindow = window.open(
        data.url,
        'oauth_popup',
        'width=600,height=700'
      );
      if (!authWindow) {
        setGhError(
          'Popup blocked by browser. Please allow popups for this site or use the Instant 1-Click GitHub Token box below.'
        );
      }
    } catch {
      setGhError('Failed to start GitHub OAuth login.');
    }
  };

  const handleGitHubLogout = async () => {
    await fetch('/api/github/logout', { method: 'POST' });
    setPublishedRepoResult(null);
    fetchGithubStatus();
  };

  const handleCreateGitHubRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setGhError(null);
    setPublishedRepoResult(null);
    try {
      setPublishingRepo(true);
      const res = await fetch('/api/github/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName: ghRepoName,
          description: ghRepoDesc,
          isPrivate: ghIsPrivate,
          token: ghPersonalToken.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGhError(data.error || 'Failed to create GitHub repository.');
      } else {
        setPublishedRepoResult(data);
        setGhPersonalToken('');
        fetchGithubStatus();
      }
    } catch {
      setGhError('Network error while publishing repository to GitHub.');
    } finally {
      setPublishingRepo(false);
    }
  };

  useEffect(() => {
    if (snapshot?.merchant) {
      setFormName(snapshot.merchant.name);
      setFormVpa(snapshot.merchant.vpa);
      setFormPayeeName(snapshot.merchant.PayeeName);
      setFormGstin(snapshot.merchant.gstin || '');
      setFormSupportEmail(snapshot.merchant.support_email || '');
      setFormWebhookUrl(snapshot.merchant.webhook_url);
      setFormThemeColor(
        snapshot.merchant.theme_color === '#10B981'
          ? '#2563EB'
          : snapshot.merchant.theme_color
      );
      setFormLogoUrl(snapshot.merchant.logo_url || '');
      setFormQueueMode(snapshot.merchant.queue_mode || 'VPA_AND_AMOUNT');
    }
  }, [snapshot?.merchant?.id]);

  useEffect(() => {
    if (activeSubTab === 'settings') {
      fetch('/api/admin/pairing-qr')
        .then((r) => r.json())
        .then((d) => setPairingData(d))
        .catch(() => {});
    }
  }, [activeSubTab, snapshot?.merchant?.observer_secret]);

  useEffect(() => {
    if (!previewQrLink || !snapshot?.merchant) {
      setPreviewQrSvg('');
      return;
    }
    const txId = `PL-${previewQrLink.short_code.toUpperCase()}`;
    const amountFixed = (previewQrLink.amount_paise / 100).toFixed(2);
    const pa = encodeURIComponent(snapshot.merchant.vpa);
    const pn = encodeURIComponent(snapshot.merchant.PayeeName || snapshot.merchant.name);
    const tr = encodeURIComponent(txId);
    const tn = encodeURIComponent(previewQrLink.title || txId);
    const upiUri = `upi://pay?pa=${pa}&pn=${pn}&am=${amountFixed}&cu=INR&tr=${tr}&tn=${tn}`;

    let active = true;
    QRCode.toString(upiUri, {
      type: 'svg',
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((svg) => {
        if (active) setPreviewQrSvg(svg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [previewQrLink, snapshot?.merchant]);

  const handleCopy = (val: string, key: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError(null);
    const amountPaise = parseRupeesToPaise(newOrderRupees);
    if (amountPaise < 100) {
      setOrderError('Enter an amount of at least ₹1.00');
      return;
    }

    try {
      setCreatingOrder(true);
      const res = await fetch('/api/checkout/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: newOrderId.trim() || undefined,
          amountPaise,
          customerName: newCustomerName.trim(),
          customerPhone: newCustomerPhone.trim(),
          customerEmail: newCustomerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOrderError(data.error || 'Failed to create order');
      } else if (data.session) {
        setNewOrderId('');
        setNewOrderRupees('');
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerEmail('');
        onRefresh();
        onOpenCheckoutModal(data.session.id);
      }
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleConfirmUtrByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingSessionId) return;
    setAdminUtrError(null);

    const res = await fetch(
      `/api/admin/sessions/${encodeURIComponent(verifyingSessionId)}/confirm-utr`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utr: adminUtrInput }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setAdminUtrError(data.error || 'Failed to confirm UTR');
    } else {
      setVerifyingSessionId(null);
      setAdminUtrInput('');
      onRefresh();
    }
  };

  const handleIssueRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingSession) return;
    setRefundError(null);

    const res = await fetch(
      `/api/admin/sessions/${encodeURIComponent(refundingSession.id)}/refund`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountPaise: refundingSession.amount_paise,
          customerVpa: refundVpa,
          reason: refundReason,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setRefundError(data.error || 'Failed to issue refund');
    } else {
      setRefundingSession(null);
      setRefundVpa('');
      onRefresh();
    }
  };

  const handleReplayWebhook = async (sessionId: string) => {
    await fetch(`/api/admin/sessions/${encodeURIComponent(sessionId)}/replay-webhook`, {
      method: 'POST',
    });
    onRefresh();
  };

  const matchesSessionFilters = (s: CheckoutSession): boolean => {
    // 1. Payment Status Filter (supports grouped Success, Pending, Expired + granular statuses)
    let matchesStatus = true;
    if (statusFilter === 'SUCCESS') {
      matchesStatus = s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED';
    } else if (statusFilter === 'PENDING') {
      matchesStatus =
        s.status === 'ACTIVE' ||
        s.status === 'PROCESSING' ||
        s.status === 'QUEUED' ||
        s.status === 'OTP_PENDING';
    } else if (statusFilter === 'EXPIRED') {
      matchesStatus = s.status === 'EXPIRED' || s.status === 'CANCELLED';
    } else if (statusFilter === 'REFUNDED') {
      matchesStatus = Boolean(s.refund_status && s.refund_status !== 'NONE');
    } else if (statusFilter !== 'ALL') {
      matchesStatus = s.status === statusFilter;
    }

    if (!matchesStatus) return false;

    // 2. Date Range Filter
    if (dateFilter !== 'ALL_TIME') {
      const now = Date.now();
      const created = s.created_at;
      if (dateFilter === 'TODAY') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        if (created < startOfToday.getTime()) return false;
      } else if (dateFilter === 'LAST_7_DAYS') {
        if (created < now - 7 * 24 * 60 * 60 * 1000) return false;
      } else if (dateFilter === 'LAST_30_DAYS') {
        if (created < now - 30 * 24 * 60 * 60 * 1000) return false;
      } else if (dateFilter === 'THIS_MONTH') {
        const d = new Date(created);
        const cur = new Date();
        if (d.getMonth() !== cur.getMonth() || d.getFullYear() !== cur.getFullYear()) {
          return false;
        }
      }
    }

    // 3. Global Search Query (Order ID, Customer Name, or 12-Digit UTR)
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const orderMatch =
      s.order_id.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    const customerMatch =
      (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
      (s.customer_phone && s.customer_phone.toLowerCase().includes(q)) ||
      (s.customer_email && s.customer_email.toLowerCase().includes(q)) ||
      (s.payer_vpa && s.payer_vpa.toLowerCase().includes(q));
    const utrMatch = Boolean(s.utr && s.utr.toLowerCase().includes(q));

    if (searchField === 'ORDER_ID') return orderMatch;
    if (searchField === 'CUSTOMER') return customerMatch;
    if (searchField === 'UTR') return utrMatch;

    return orderMatch || customerMatch || utrMatch;
  };

  // Focus search input when global '/' keyboard shortcut is triggered
  useEffect(() => {
    if (focusSearchTrigger > 0) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
          searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [focusSearchTrigger]);

  // Internal Escape key handling for dashboard modals, active inputs, and bulk selection
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewQrLink) {
          setPreviewQrLink(null);
          return;
        }
        if (refundingSession) {
          setRefundingSession(null);
          return;
        }
        if (verifyingSessionId) {
          setVerifyingSessionId(null);
          return;
        }
        const activeEl = document.activeElement as HTMLElement | null;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.tagName === 'SELECT')
        ) {
          activeEl.blur();
          return;
        }
        if (selectedSessionIds.length > 0) {
          setSelectedSessionIds([]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewQrLink, refundingSession, verifyingSessionId, selectedSessionIds.length]);

  const downloadSessionsCsv = (sourceRows: CheckoutSession[], filenamePrefix: string) => {
    if (!snapshot || sourceRows.length === 0) return;

    const escapeCsv = (val: string | number | null | undefined) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const header = [
      'Voucher / Order ID',
      'Payment Session ID',
      'Accounting Ledger Entry',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Gross Amount (INR)',
      'Platform MDR Fee (INR)',
      'Refunded Amount (INR)',
      'Net Settled Amount (INR)',
      'Currency',
      'Payment Status',
      'Reconciled Status',
      '12-Digit Bank UTR',
      'Payer UPI VPA',
      'Merchant Receiving VPA',
      'Merchant GSTIN',
      'Refund Status',
      'Created At (ISO-8601)',
      'Created Date (Local)',
    ].join(',');

    const rows = sourceRows.map((s) => {
      const isSettled = s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED';
      const grossInr = (s.amount_paise / 100).toFixed(2);
      const refundedPaise = s.refunded_paise || 0;
      const refundedInr = (refundedPaise / 100).toFixed(2);
      const netPaise = isSettled ? Math.max(0, s.amount_paise - refundedPaise) : 0;
      const netInr = (netPaise / 100).toFixed(2);
      const ledgerEntryType = !isSettled
        ? 'UNSETTLED_MEMO'
        : s.refund_status === 'FULL'
          ? 'REFUND_REVERSAL'
          : s.refund_status === 'PARTIAL'
            ? 'PARTIAL_REFUND_RECEIPT'
            : 'RECEIPT_SETTLED';

      return [
        escapeCsv(s.order_id),
        escapeCsv(s.id),
        escapeCsv(ledgerEntryType),
        escapeCsv(s.customer_name),
        escapeCsv(s.customer_phone),
        escapeCsv(s.customer_email),
        grossInr,
        '0.00',
        refundedInr,
        netInr,
        'INR',
        escapeCsv(s.status === 'OBSERVED_SUCCESS' ? 'CAPTURED' : s.status),
        escapeCsv(s.status === 'RECONCILED' ? 'YES' : 'NO'),
        escapeCsv(s.utr),
        escapeCsv(s.payer_vpa),
        escapeCsv(snapshot.merchant.vpa),
        escapeCsv(snapshot.merchant.gstin),
        escapeCsv(s.refund_status || 'NONE'),
        escapeCsv(new Date(s.created_at).toISOString()),
        escapeCsv(new Date(s.created_at).toLocaleString()),
      ].join(',');
    });

    // Prepend UTF-8 BOM (\uFEFF) so Excel, Tally Prime, and Zoho Books open the CSV cleanly
    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportTransactionsCsv = () => {
    if (!snapshot) return;
    const sourceRows = snapshot.sessions.filter(matchesSessionFilters);
    if (sourceRows.length === 0) return;

    const statusSlug = statusFilter !== 'ALL' ? `-${statusFilter.toLowerCase()}` : '';
    const dateSlug = dateFilter !== 'ALL_TIME' ? `-${dateFilter.toLowerCase()}` : '';
    const querySlug = searchQuery.trim()
      ? `-q-${searchQuery
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '')
          .slice(0, 12)}`
      : '';

    downloadSessionsCsv(
      sourceRows,
      `openpay-accounting-export${statusSlug}${dateSlug}${querySlug}`
    );

    const settledNetPaise = sourceRows.reduce((acc, s) => {
      if (s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED') {
        return acc + Math.max(0, s.amount_paise - (s.refunded_paise || 0));
      }
      return acc;
    }, 0);

    setBulkFeedback({
      type: 'ok',
      text: `Exported ${sourceRows.length} filtered transaction(s) (${formatPaiseToInr(settledNetPaise)} net settled volume) as an accounting CSV file.`,
    });
    setCopiedKey('csv_exported');
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const handleExportSelectedTransactionsCsv = () => {
    if (!snapshot || selectedSessionIds.length === 0) return;
    const selectedSet = new Set(selectedSessionIds);
    const sourceRows = snapshot.sessions.filter((s) => selectedSet.has(s.id));
    downloadSessionsCsv(sourceRows, `openpay-selected-${sourceRows.length}-transactions`);
    setBulkFeedback({
      type: 'ok',
      text: `Exported ${sourceRows.length} selected transaction(s) to CSV.`,
    });
    setCopiedKey('selected_csv_exported');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleSelectSession = (sessionId: string) => {
    setBulkFeedback(null);
    setSelectedSessionIds((prev) =>
      prev.includes(sessionId) ? prev.filter((id) => id !== sessionId) : [...prev, sessionId]
    );
  };

  const handleToggleSelectAllFiltered = (currentFiltered: CheckoutSession[]) => {
    setBulkFeedback(null);
    if (currentFiltered.length === 0) return;
    const filteredIds = currentFiltered.map((s) => s.id);
    const allSelected = filteredIds.every((id) => selectedSessionIds.includes(id));
    if (allSelected) {
      const removeSet = new Set(filteredIds);
      setSelectedSessionIds((prev) => prev.filter((id) => !removeSet.has(id)));
    } else {
      const merged = new Set([...selectedSessionIds, ...filteredIds]);
      setSelectedSessionIds(Array.from(merged));
    }
  };

  const handleBulkMarkReconciled = async () => {
    if (selectedSessionIds.length === 0) return;
    setBulkFeedback(null);
    try {
      setBulkReconciling(true);
      const res = await fetch('/api/admin/sessions/bulk-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: selectedSessionIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBulkFeedback({
          type: 'err',
          text: data.error || 'Failed to mark selected transactions as reconciled.',
        });
      } else {
        setBulkFeedback({
          type: 'ok',
          text: `Marked ${data.reconciledCount} selected transaction(s) as RECONCILED and logged to Audit Trail.`,
        });
        setSelectedSessionIds([]);
        onRefresh();
      }
    } catch {
      setBulkFeedback({
        type: 'err',
        text: 'Network error while reconciling selected transactions.',
      });
    } finally {
      setBulkReconciling(false);
    }
  };

  const handleDownloadTaxInvoice = (s: CheckoutSession) => {
    if (!snapshot) return;
    const m = snapshot.merchant;
    const invoiceLines = [
      '============================================================',
      `                 ${m.name.toUpperCase()} — TAX INVOICE / RECEIPT`,
      '============================================================',
      `Merchant Brand    : ${m.name}`,
      `Beneficiary VPA   : ${m.vpa}`,
      `GSTIN             : ${m.gstin || 'Unregistered / Exempt'}`,
      `Support Email     : ${m.support_email || 'aniketchoudhary9507@gmail.com'}`,
      '------------------------------------------------------------',
      `Invoice / Order   : ${s.order_id}`,
      `Payment ID        : ${s.id}`,
      `12-Digit Bank UTR : ${s.utr || 'Pending'}`,
      `Customer Name     : ${s.customer_name || 'Customer'}`,
      `Customer Phone    : ${s.customer_phone || '—'}`,
      `Customer Email    : ${s.customer_email || '—'}`,
      `Customer VPA      : ${s.payer_vpa || '—'}`,
      '------------------------------------------------------------',
      `Total Paid (INR)  : ${formatPaiseToInr(s.amount_paise)}`,
      `Platform Fee      : ₹0.00 (0% Direct-to-Bank UPI)`,
      `Payment Status    : ${s.status}`,
      `Issued At         : ${new Date(s.created_at).toLocaleString()}`,
      '============================================================',
      '        Generated by OpenPay — By Aniket Payment Suite      ',
      '============================================================',
    ].join('\n');

    const blob = new Blob([invoiceLines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OpenPay-Invoice-${s.order_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLaunchLivePaymentFromLink = async (pl: PaymentLink) => {
    try {
      setLaunchingLiveLinkId(pl.id);
      const res = await fetch(`/api/payment-links/${encodeURIComponent(pl.short_code)}/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: pl.customer_name || 'UPI Customer',
          customerPhone: pl.customer_phone || '',
          customerEmail: pl.customer_email || '',
        }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        onRefresh();
        onOpenCheckoutModal(data.session.id);
      }
    } finally {
      setLaunchingLiveLinkId(null);
    }
  };

  const handleCreatePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountPaise = parseRupeesToPaise(linkRupees);
    if (!linkTitle.trim() || amountPaise < 100) return;

    try {
      setCreatingLink(true);
      const res = await fetch('/api/admin/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: linkTitle,
          description: linkDesc,
          amountPaise,
          customerName: linkCustomerName,
          customerPhone: linkCustomerPhone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLinkTitle('');
        setLinkDesc('');
        setLinkRupees('');
        setLinkCustomerName('');
        setLinkCustomerPhone('');
        if (data.paymentLink) {
          if (linkPriorityMode === 'LIVE_PAYMENT') {
            setFeaturedLiveLink(data.paymentLink);
            setPreviewQrLink(null);
          } else {
            setPreviewQrLink(data.paymentLink);
            setFeaturedLiveLink(null);
          }
        }
        onRefresh();
      }
    } finally {
      setCreatingLink(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setCsvText(ev.target.result);
      }
    };
    reader.readAsText(file);
  };

  const handleRunReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    try {
      setReconciling(true);
      const res = await fetch('/api/admin/reconcile-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json();
      if (res.ok) {
        setReconcileReport(data);
        onRefresh();
      }
    } finally {
      setReconciling(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') {
        setFormLogoUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveMerchantSettings = async (e: React.FormEvent, rotateSecrets = false) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setSettingsSavedMsg(null);
      const res = await fetch('/api/admin/merchant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          vpa: formVpa,
          PayeeName: formPayeeName,
          gstin: formGstin,
          support_email: formSupportEmail,
          webhook_url: formWebhookUrl,
          theme_color: formThemeColor,
          logo_url: formLogoUrl,
          queue_mode: formQueueMode,
          rotateSecrets,
        }),
      });
      if (res.ok) {
        setSettingsSavedMsg(
          rotateSecrets
            ? 'API & Webhook secrets rotated and saved.'
            : 'Merchant configuration, checkout branding & webhook settings saved.'
        );
        onRefresh();
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveAndPreviewCheckout = async () => {
    try {
      setSavingSettings(true);
      await fetch('/api/admin/merchant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          vpa: formVpa,
          PayeeName: formPayeeName,
          gstin: formGstin,
          support_email: formSupportEmail,
          webhook_url: formWebhookUrl,
          theme_color: formThemeColor,
          logo_url: formLogoUrl,
          queue_mode: formQueueMode,
        }),
      });
      onRefresh();

      const existingSession = snapshot?.sessions?.[0];
      if (existingSession) {
        onOpenCheckoutModal(existingSession.id);
      } else {
        const createRes = await fetch('/api/checkout/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountPaise: 49900,
            customerName: 'Branding Preview Customer',
          }),
        });
        const data = await createRes.json();
        if (createRes.ok && data.session) {
          onRefresh();
          onOpenCheckoutModal(data.session.id);
        }
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendTestWebhook = async (
    eventType: 'payment.captured' | 'payment.failed' | 'payment.expired'
  ) => {
    setWebhookStatusMsg(null);
    const targetUrl = formWebhookUrl.trim();
    if (!targetUrl) {
      setWebhookStatusMsg({
        type: 'err',
        text: 'Enter a Callback URL above (or click "Use Loopback Test URL") before sending a test POST notification.',
      });
      return;
    }

    try {
      setTestingWebhookEvent(eventType);
      // Save the webhook URL first so future real events also use it
      await fetch('/api/admin/merchant', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          vpa: formVpa,
          PayeeName: formPayeeName,
          gstin: formGstin,
          support_email: formSupportEmail,
          webhook_url: targetUrl,
          theme_color: formThemeColor,
          logo_url: formLogoUrl,
          queue_mode: formQueueMode,
        }),
      });

      const res = await fetch('/api/admin/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          targetUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWebhookStatusMsg({
          type: 'err',
          text: data.error || 'Failed to dispatch test webhook.',
        });
      } else {
        const code = data.delivery?.status_code || 200;
        setWebhookStatusMsg({
          type: code >= 200 && code < 300 ? 'ok' : 'err',
          text: `Dispatched POST [${eventType}] to ${targetUrl} → HTTP ${code}`,
        });
        onRefresh();
      }
    } catch {
      setWebhookStatusMsg({
        type: 'err',
        text: 'Network error while dispatching test webhook.',
      });
    } finally {
      setTestingWebhookEvent(null);
    }
  };

  const handleCreateAlertRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertRuleFeedback(null);
    const thresholdPaise = parseRupeesToPaise(alertThresholdRupees);
    if (!alertRuleName.trim() || thresholdPaise < 100) {
      setAlertRuleFeedback({
        type: 'err',
        text: 'Enter a rule name and a valid threshold amount of at least ₹1.00.',
      });
      return;
    }

    try {
      setCreatingAlertRule(true);
      const res = await fetch('/api/admin/alert-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: alertRuleName.trim(),
          conditionType: alertConditionType,
          thresholdPaise,
          channel: alertChannel,
          recipientEmail: alertRecipientEmail.trim(),
          recipientPhone: alertRecipientPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAlertRuleFeedback({
          type: 'err',
          text: data.error || 'Failed to create alert rule.',
        });
      } else {
        setAlertRuleFeedback({
          type: 'ok',
          text: `Alert rule "${alertRuleName.trim()}" (> ${formatPaiseToInr(
            thresholdPaise
          )}) created and active.`,
        });
        onRefresh();
      }
    } catch {
      setAlertRuleFeedback({
        type: 'err',
        text: 'Network error while saving alert rule.',
      });
    } finally {
      setCreatingAlertRule(false);
    }
  };

  const handleToggleAlertRule = async (ruleId: string, enabled: boolean) => {
    await fetch(`/api/admin/alert-rules/${encodeURIComponent(ruleId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    onRefresh();
  };

  const handleDeleteAlertRule = async (ruleId: string) => {
    await fetch(`/api/admin/alert-rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    });
    onRefresh();
  };

  const handleTestAlertRule = async (ruleId: string, ruleName: string) => {
    setAlertRuleFeedback(null);
    try {
      setTestingRuleId(ruleId);
      const res = await fetch(`/api/admin/alert-rules/${encodeURIComponent(ruleId)}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        triggerFreeBrowserNotification(
          `[TEST ALERT] ${ruleName}`,
          `Simulated ${data.simulatedAmountFormatted} payment alert delivered via 100% Free Alert Suite.`
        );
        setAlertRuleFeedback({
          type: 'ok',
          text: `Triggered 100% Free Alert Suite (Browser Push + Audio Chime + Outbox/Webhook) for "${ruleName}" (${data.simulatedAmountFormatted}).`,
        });
        onRefresh();
      }
    } finally {
      setTestingRuleId(null);
    }
  };

  const handleUpdateSubscription = async (params: {
    planId?: SubscriptionPlanId;
    billingCycle?: BillingCycle;
    autoTopupEnabled?: boolean;
  }) => {
    setBillingFeedback(null);
    try {
      setUpdatingSubscription(true);
      const res = await fetch('/api/admin/subscription', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        setBillingFeedback('Verified 100% Free-Forever Unlimited Plan (₹0 cost).');
        onRefresh();
      }
    } finally {
      setUpdatingSubscription(false);
    }
  };

  const handleTopupSmsCredits = async () => {
    setBillingFeedback(null);
    try {
      setToppingUpSms(true);
      const res = await fetch('/api/admin/subscription/topup-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setBillingFeedback(
          'Monthly alert & webhook usage counters reset for free. Unlimited quota remains active.'
        );
        onRefresh();
      }
    } finally {
      setToppingUpSms(false);
    }
  };

  const handleTestLiveBankForwarder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshot) return;
    setForwarderFeedback(null);

    const activeSlot = snapshot.sessions.find(
      (s) => s.status === 'PROCESSING' || s.status === 'ACTIVE'
    );
    const amountStr = Number(
      forwarderAmountRupees || (activeSlot ? (activeSlot.amount_paise / 100).toFixed(2) : '499.00')
    ).toFixed(2);
    const randomUtr = `6${String(Date.now()).slice(-7)}${Math.floor(1000 + Math.random() * 9000)}`;

    const presetMessages: Record<string, string> = {
      HDFC: `Rs. ${amountStr} credited to a/c XX4821 on ${new Date().toISOString().slice(0, 10)} by VPA rahul.verma@okicici (UPI Ref No ${randomUtr}). -HDFC Bank`,
      ICICI: `Acct XX9102 credited with INR ${amountStr} on ${new Date().toISOString().slice(0, 10)}. UPI:${randomUtr}-priya.nair@okhdfcbank. Avl Bal: INR 1,42,800.00 -ICICI`,
      SBI: `Dear SBI User, your A/c X4419-credited by Rs.${amountStr} on ${new Date().toISOString().slice(0, 10)} transfer from arjun.mehta@ybl Ref No ${randomUtr} -SBI`,
      AXIS: `INR ${amountStr} credited to A/c no. XX7731 on ${new Date().toISOString().slice(0, 10)} Info: UPI/P2A/${randomUtr}/sneha.k@paytm -Axis Bank`,
      KOTAK: `Received Rs.${amountStr} in your Kotak Bank A/c XX3109 from vikram@okaxis via UPI. UPI Ref: ${randomUtr}.`,
    };

    const rawPayload =
      forwarderBankPreset === 'CUSTOM' && forwarderCustomText.trim()
        ? forwarderCustomText.trim()
        : presetMessages[forwarderBankPreset] || presetMessages.HDFC;

    try {
      setTestingForwarder(true);
      const res = await fetch(
        `/api/webhooks/bank-forwarder/${encodeURIComponent(snapshot.merchant.id)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Observer-Secret': snapshot.merchant.observer_secret,
          },
          body: JSON.stringify({
            rawPayload,
            sourceChannel: forwarderChannel,
            isDashboardTest: true,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setForwarderFeedback({
          type: 'err',
          text: data.error || 'Bank forwarder rejected alert payload.',
        });
      } else {
        setForwarderFeedback({
          type: 'ok',
          text:
            data.status === 'MATCHED_AND_VERIFIED'
              ? `Live Forwarder matched & auto-verified Order ${data.matchedSession?.order_id} (${data.parsed?.amountFormatted} · UTR ${data.parsed?.utr})!`
              : `Live Forwarder parsed & recorded ${data.parsed?.amountFormatted} (UTR ${data.parsed?.utr}) in Bank Observations.`,
        });
        onRefresh();
      }
    } catch {
      setForwarderFeedback({
        type: 'err',
        text: 'Network error communicating with bank forwarder endpoint.',
      });
    } finally {
      setTestingForwarder(false);
    }
  };

  const handleCreateBackupCheckpoint = async () => {
    setBackupFeedback(null);
    try {
      setCreatingCheckpoint(true);
      const res = await fetch('/api/admin/backups/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'manual_dashboard_checkpoint' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackupFeedback({
          type: 'err',
          text: data.error || 'Failed to create database backup checkpoint.',
        });
      } else {
        setBackupFeedback({
          type: 'ok',
          text: `Created SHA-256 verified checkpoint (${data.checkpoint?.filename}) with ${data.checkpoint?.sessions_count} sessions.`,
        });
        onRefresh();
      }
    } catch {
      setBackupFeedback({
        type: 'err',
        text: 'Network error creating database checkpoint.',
      });
    } finally {
      setCreatingCheckpoint(false);
    }
  };

  const handleRestoreCheckpoint = async (checkpointId: string, filename: string) => {
    setBackupFeedback(null);
    try {
      setRestoringCheckpointId(checkpointId);
      const res = await fetch('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBackupFeedback({
          type: 'err',
          text: data.error || 'Failed to restore database checkpoint.',
        });
      } else {
        setBackupFeedback({
          type: 'ok',
          text: `Restored ${data.restoredSessions} sessions, ${data.restoredLinks} payment links, and ${data.restoredRules} alert rules from ${filename}.`,
        });
        onRefresh();
      }
    } catch {
      setBackupFeedback({
        type: 'err',
        text: 'Network error restoring database checkpoint.',
      });
    } finally {
      setRestoringCheckpointId(null);
    }
  };

  const handleUploadRestoreJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFeedback(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const rawText = String(ev.target?.result || '');
        const parsedJson = JSON.parse(rawText);
        setRestoringCheckpointId('upload_json');
        const res = await fetch('/api/admin/backups/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backupData: parsedJson }),
        });
        const data = await res.json();
        if (!res.ok) {
          setBackupFeedback({
            type: 'err',
            text: data.error || 'Invalid backup JSON file.',
          });
        } else {
          setBackupFeedback({
            type: 'ok',
            text: `Restored ${data.restoredSessions} sessions, ${data.restoredLinks} payment links, and ${data.restoredRules} alert rules from uploaded file (${file.name}).`,
          });
          onRefresh();
        }
      } catch {
        setBackupFeedback({
          type: 'err',
          text: 'Could not parse uploaded JSON backup file.',
        });
      } finally {
        setRestoringCheckpointId(null);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleCancelSession = async (sessionId: string) => {
    await fetch(`/api/checkout/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
    });
    onRefresh();
  };

  if (!snapshot) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const activeSlots = snapshot.sessions.filter(
    (s) => s.status === 'ACTIVE' || s.status === 'PROCESSING'
  );
  const queuedSessions = snapshot.sessions.filter((s) => s.status === 'QUEUED');

  // Monthly Overview Computation (Current Calendar Month)
  const nowDate = new Date();
  const currentMonth = nowDate.getMonth();
  const currentYear = nowDate.getFullYear();
  const currentMonthLabel = nowDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const monthlySessions = snapshot.sessions.filter((s) => {
    const d = new Date(s.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const monthlySuccessfulSessions = monthlySessions.filter(
    (s) => s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED'
  );
  const monthlyCapturedCount = monthlySessions.filter(
    (s) => s.status === 'OBSERVED_SUCCESS'
  ).length;
  const monthlyReconciledCount = monthlySessions.filter(
    (s) => s.status === 'RECONCILED'
  ).length;

  const monthlyFailedSessions = monthlySessions.filter(
    (s) => s.status === 'EXPIRED' || s.status === 'CANCELLED'
  );
  const monthlyExpiredCount = monthlySessions.filter((s) => s.status === 'EXPIRED').length;
  const monthlyCancelledCount = monthlySessions.filter((s) => s.status === 'CANCELLED').length;

  const monthlyProcessedVolumePaise = monthlySuccessfulSessions.reduce(
    (acc, s) => acc + s.amount_paise,
    0
  );
  const monthlyNetSettledVolumePaise = monthlySuccessfulSessions.reduce(
    (acc, s) => acc + Math.max(0, s.amount_paise - (s.refunded_paise || 0)),
    0
  );
  const monthlyAvgTicketPaise =
    monthlySuccessfulSessions.length > 0
      ? Math.round(monthlyProcessedVolumePaise / monthlySuccessfulSessions.length)
      : 0;

  const monthlyResolvedTotal = monthlySuccessfulSessions.length + monthlyFailedSessions.length;
  const monthlySuccessRatePercent =
    monthlyResolvedTotal > 0
      ? Math.round((monthlySuccessfulSessions.length / monthlyResolvedTotal) * 100)
      : 100;

  // 30-Day Payment Volume Trend Time Series (for Recharts LineChart)
  const last30DaysTrendData = Array.from({ length: 30 }, (_, idx) => {
    const dayDate = new Date();
    dayDate.setHours(0, 0, 0, 0);
    dayDate.setDate(dayDate.getDate() - (29 - idx));

    const dayStart = dayDate.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

    const daySessions = snapshot.sessions.filter(
      (s) => s.created_at >= dayStart && s.created_at <= dayEnd
    );
    const daySuccess = daySessions.filter(
      (s) => s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED'
    );
    const dayExpired = daySessions.filter(
      (s) => s.status === 'EXPIRED' || s.status === 'CANCELLED'
    );

    const grossPaise = daySuccess.reduce((acc, s) => acc + s.amount_paise, 0);
    const netPaise = daySuccess.reduce(
      (acc, s) => acc + Math.max(0, s.amount_paise - (s.refunded_paise || 0)),
      0
    );

    return {
      dateKey: dayDate.toISOString().slice(0, 10),
      label: dayDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      volumeInr: Number((grossPaise / 100).toFixed(2)),
      netVolumeInr: Number((netPaise / 100).toFixed(2)),
      successCount: daySuccess.length,
      expiredCount: dayExpired.length,
    };
  });

  const last30DaysTotalVolumeInr = last30DaysTrendData.reduce(
    (acc, d) => acc + d.volumeInr,
    0
  );
  const last30DaysPeakVolumeInr = last30DaysTrendData.reduce(
    (max, d) => (d.volumeInr > max ? d.volumeInr : max),
    0
  );
  const last30DaysSuccessCount = last30DaysTrendData.reduce(
    (acc, d) => acc + d.successCount,
    0
  );

  const filteredSessions = snapshot.sessions.filter(matchesSessionFilters);
  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    searchQuery.trim() !== '' ||
    searchField !== 'ALL' ||
    dateFilter !== 'ALL_TIME';

  const baseUrl = window.location.origin;

  const htmlButtonSnippet = `<!-- 1. Add OpenPay Script once in your HTML <head> or before </body> -->
<script src="${baseUrl}/sdk.js" defer></script>

<!-- 2. Place Payment Button anywhere on your page -->
<button
  data-youpi-pay
  data-amount="${btnAmount || '499'}"
  data-order-id="ORD-${Math.floor(1000 + Math.random() * 9000)}"
  style="background:${btnColor};color:#ffffff;padding:12px 24px;border-radius:8px;border:none;font-weight:600;cursor:pointer;">
  ${btnLabel || 'Pay Now'} · ₹${btnAmount || '499'}
</button>`;

  const jsProgrammaticSnippet = `<script src="${baseUrl}/sdk.js"></script>
<script>
  function startPayment() {
    window.YoupiPG.open({
      amount: 499.00,
      orderId: 'ORD_' + Date.now(),
      customer: {
        name: 'Customer Name',
        phone: '+91 9876543210',
        email: 'customer@domain.com'
      },
      onSuccess: function (response) {
        // response = { sessionId, orderId, amountPaise, utr, signature }
        console.log('Payment Verified! 12-Digit UTR:', response.utr);
      }
    });
  }
</script>`;

  const backendOrderSnippet = `// Step 1: Create an Order from your Backend (Node.js / Python / PHP)
const response = await fetch('${baseUrl}/api/v1/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 49900, // ₹499.00 in integer paise
    currency: 'INR',
    receipt: 'rcpt_101',
    notes: { customer_name: 'Aarav', customer_phone: '+919876543210' }
  })
});
const order = await response.json();
// Redirect customer to order.checkout_url or pass order.checkout_session_id to YoupiPG.open({ sessionId })

// Step 2: Verify Payment Signature on your Backend
const verifyRes = await fetch('${baseUrl}/api/v1/payments/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    youpi_order_id: response.orderId,
    youpi_payment_id: response.sessionId,
    youpi_signature: response.signature
  })
});`;

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-8 space-y-8">
      {/* Prominent GitHub OAuth Login & 1-Click Repository Publisher Banner */}
      {activeSubTab !== 'settings' && (
        <div className="p-5 rounded-xl bg-white border border-blue-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-display font-bold text-slate-900">
                GitHub OAuth Connected — Publish Complete OpenPay Repository
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {githubStatus?.authenticated && githubStatus.user
                ? `Signed in as @${githubStatus.user.login}. Click "Create Repo & Push All" to create your repository and push all 20 files + integration docs.`
                : 'Click "Sign in with GitHub" on the right to authorize your account and automatically create the repository in your GitHub.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 text-xs">
            {!githubStatus?.authenticated ? (
              <button
                type="button"
                onClick={handleGitHubSignIn}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-display font-semibold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <span>Sign in with GitHub</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : (
              <form onSubmit={handleCreateGitHubRepo} className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
                  @{githubStatus.user?.login}
                </span>
                <input
                  type="text"
                  required
                  value={ghRepoName}
                  onChange={(e) => setGhRepoName(e.target.value)}
                  placeholder="openpay"
                  className="w-36 px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={publishingRepo}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold cursor-pointer shadow-xs"
                >
                  {publishingRepo ? 'Pushing 20 Files...' : 'Create Repo & Push All'}
                </button>
              </form>
            )}
          </div>

          {ghError && (
            <div className="w-full p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {ghError}
            </div>
          )}

          {publishedRepoResult && (
            <div className="w-full p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs">
              <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Created {publishedRepoResult.fullName} ({publishedRepoResult.filesCommittedCount}{' '}
                  files pushed)!
                </span>
              </div>
              <a
                href={publishedRepoResult.repoUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
              >
                <span>Open Repo</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* KPI Metric Strip — Crisp Razorpay White Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-slate-500">Net Collected Volume</div>
          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
            {formatPaiseToInr(snapshot.metrics.netVolumePaise)}
          </div>
          <div className="text-xs text-slate-500 font-mono truncate">
            VPA: {snapshot.merchant.vpa}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-slate-500">Live Queue & Slots</div>
          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
            {snapshot.metrics.activeSlotCount}{' '}
            <span className="text-sm font-normal text-blue-600">Active</span> ·{' '}
            {snapshot.metrics.queuedCount}{' '}
            <span className="text-sm font-normal text-amber-600">Queued</span>
          </div>
          <div className="text-xs text-slate-500">
            {snapshot.merchant.queue_mode === 'GLOBAL_VPA'
              ? 'Global VPA Lock'
              : 'Per [VPA + Exact Amount] Lock'}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-slate-500">Verified & Reconciled</div>
          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
            {snapshot.metrics.verifiedCount}{' '}
            <span className="text-sm font-normal text-slate-500">Captured</span> ·{' '}
            {snapshot.metrics.reconciledCount}{' '}
            <span className="text-sm font-normal text-emerald-600">Settled</span>
          </div>
          <div className="text-xs text-emerald-600 font-medium">0% Platform MDR Fee</div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="text-xs font-medium text-slate-500">Android Bank Observer</div>
          <div className="text-lg font-display font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 shrink-0 ${
                snapshot.metrics.observerConnected ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <span>
              {snapshot.metrics.observerConnected ? 'Connected' : 'Ready for Webhook'}
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            {snapshot.observations.length} signed bank alerts
          </div>
        </div>
      </div>

      {/* TAB 1: TRANSACTIONS, ORDERS & LIVE QUEUE */}
      {activeSubTab === 'transactions' && (
        <div className="space-y-8">
          {/* Monthly Overview Summary Component */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-display font-bold text-slate-900">
                      Monthly Overview
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-mono font-semibold text-blue-700">
                      {currentMonthLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Current month processed volume and successful vs failed payment performance
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
                <span>
                  Total Monthly Sessions:{' '}
                  <strong className="text-slate-900">{monthlySessions.length}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-700 font-semibold">0% Direct-to-Bank Fee</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Processed Volume */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Total Processed Volume</span>
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
                  {formatPaiseToInr(monthlyProcessedVolumePaise)}
                </div>
                <div className="text-[11px] text-slate-500 font-mono flex items-center justify-between">
                  <span>Net: {formatPaiseToInr(monthlyNetSettledVolumePaise)}</span>
                  <span>Avg: {formatPaiseToInr(monthlyAvgTicketPaise)}</span>
                </div>
              </div>

              {/* Successful Payments Count */}
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-emerald-800 font-medium">
                  <span>Successful Payments</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-2xl font-mono font-bold text-emerald-700 tabular-nums">
                  {monthlySuccessfulSessions.length}
                </div>
                <div className="text-[11px] text-emerald-700/80 font-mono flex items-center justify-between">
                  <span>{monthlyCapturedCount} Captured</span>
                  <span>·</span>
                  <span>{monthlyReconciledCount} Reconciled</span>
                </div>
              </div>

              {/* Failed / Expired Payments Count */}
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-rose-800 font-medium">
                  <span>Failed / Expired Payments</span>
                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                </div>
                <div className="text-2xl font-mono font-bold text-rose-700 tabular-nums">
                  {monthlyFailedSessions.length}
                </div>
                <div className="text-[11px] text-rose-700/80 font-mono flex items-center justify-between">
                  <span>{monthlyExpiredCount} Expired</span>
                  <span>·</span>
                  <span>{monthlyCancelledCount} Cancelled</span>
                </div>
              </div>

              {/* Monthly Success vs Failed Ratio */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-2 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Monthly Success Rate</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {monthlySuccessRatePercent}%
                  </span>
                </div>

                <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${
                        monthlyResolvedTotal > 0
                          ? (monthlySuccessfulSessions.length / monthlyResolvedTotal) * 100
                          : 100
                      }%`,
                    }}
                    title={`Successful: ${monthlySuccessfulSessions.length}`}
                  />
                  {monthlyFailedSessions.length > 0 && (
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{
                        width: `${
                          (monthlyFailedSessions.length / monthlyResolvedTotal) * 100
                        }%`,
                      }}
                      title={`Failed / Expired: ${monthlyFailedSessions.length}`}
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span className="text-emerald-700">
                    {monthlySuccessfulSessions.length} Succeeded
                  </span>
                  <span className="text-rose-600">{monthlyFailedSessions.length} Failed</span>
                </div>
              </div>
            </div>
          </div>

          {/* 30-Day Payment Volume Trends Line Chart (Recharts) */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Payment Volume Trends (Last 30 Days)
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Daily processed UPI volume (INR) and net settled collections over the past 30 days
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">30d Volume: </span>
                  <strong className="text-slate-900">
                    ₹{last30DaysTotalVolumeInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500">Peak Day: </span>
                  <strong className="text-blue-600">
                    ₹{last30DaysPeakVolumeInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <strong>{last30DaysSuccessCount}</strong> Verified Payments
                </div>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={last30DaysTrendData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#1E293B' : '#E2E8F0'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: isDark ? '#CBD5E1' : '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: isDark ? '#334155' : '#CBD5E1' }}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: isDark ? '#CBD5E1' : '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val: number) => `₹${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                      color: isDark ? '#F8FAFC' : '#0F172A',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: isDark
                        ? '0 8px 20px rgba(0, 0, 0, 0.45)'
                        : '0 4px 12px rgba(15, 23, 42, 0.08)',
                    }}
                    itemStyle={{
                      color: isDark ? '#E2E8F0' : '#0F172A',
                    }}
                    labelStyle={{
                      color: isDark ? '#F8FAFC' : '#0F172A',
                      fontWeight: 600,
                    }}
                    formatter={(value: unknown, name: unknown) => [
                      `₹${Number(value || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`,
                      String(name),
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend
                    wrapperStyle={{
                      fontSize: '12px',
                      paddingTop: '8px',
                      color: isDark ? '#E2E8F0' : '#334155',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="volumeInr"
                    name="Processed Volume (INR)"
                    stroke={isDark ? '#60A5FA' : '#2563EB'}
                    strokeWidth={2.75}
                    dot={{ r: 2.5, fill: isDark ? '#60A5FA' : '#2563EB' }}
                    activeDot={{ r: 5, fill: isDark ? '#93C5FD' : '#1D4ED8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="netVolumeInr"
                    name="Net Settled Volume (INR)"
                    stroke={isDark ? '#34D399' : '#10B981'}
                    strokeWidth={2.25}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Create Order Card */}
            <form
              onSubmit={handleCreateOrder}
              className="lg:col-span-5 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Create Order / Checkout Session
                  </h2>
                  <p className="text-xs text-slate-500">
                    Generate a live UPI QR & Intent checkout session for a customer.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-medium">Amount (INR) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={newOrderRupees}
                      onChange={(e) => setNewOrderRupees(e.target.value)}
                      placeholder="499.00"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-medium">Order / Receipt ID</label>
                    <input
                      type="text"
                      value={newOrderId}
                      onChange={(e) => setNewOrderId(e.target.value)}
                      placeholder="Auto-generated"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-medium">Customer Name</label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="Customer Name"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-medium">Customer Phone</label>
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {orderError && <p className="text-xs text-rose-600">{orderError}</p>}
              </div>

              <button
                type="submit"
                disabled={creatingOrder}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{creatingOrder ? 'Creating Order...' : 'Create & Launch Checkout'}</span>
              </button>
            </form>

            {/* Live UPI Slots & FIFO Queue */}
            <div className="lg:col-span-7 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-display font-bold text-slate-900">
                      Live UPI Payment Slots & Waiting Queue
                    </h2>
                    <p className="text-xs text-slate-500">
                      Real-time queue state for receiving VPA{' '}
                      <span className="font-mono text-slate-800">{snapshot.merchant.vpa}</span>
                    </p>
                  </div>
                  <span className="text-xs font-mono font-medium text-slate-600 tabular-nums">
                    {activeSlots.length} Active · {queuedSessions.length} Queued
                  </span>
                </div>

                {activeSlots.length === 0 && queuedSessions.length === 0 ? (
                  <div className="py-10 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center">
                    <p className="text-xs text-slate-500">
                      All UPI payment slots are currently open. Create an order on the left or share
                      a Payment Link to accept payments.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/40 max-h-56 overflow-y-auto">
                    {[...activeSlots, ...queuedSessions].map((slot) => (
                      <div
                        key={slot.id}
                        className="p-3.5 flex items-center justify-between gap-4 text-xs bg-white hover:bg-slate-50"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-mono text-slate-900 flex items-center gap-2">
                            <span className="font-bold text-blue-600 tabular-nums">
                              {formatPaiseToInr(slot.amount_paise)}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="font-semibold">{slot.order_id}</span>
                            <span className="text-slate-300">·</span>
                            <span className="text-amber-600 font-semibold">
                              {slot.status}
                              {slot.status === 'QUEUED' ? ` (#${slot.queue_position})` : ''}
                            </span>
                          </div>
                          <div className="text-slate-500 truncate">
                            {slot.customer_name || 'Customer'}
                            {slot.payer_vpa ? ` (${slot.payer_vpa})` : ''}
                            {slot.utr ? ` · Customer UTR: ${slot.utr}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onOpenCheckoutModal(slot.id)}
                            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium cursor-pointer"
                          >
                            Checkout
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVerifyingSessionId(slot.id);
                              setAdminUtrInput(slot.utr || '');
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-medium cursor-pointer"
                          >
                            Verify UTR
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelSession(slot.id)}
                            className="px-2.5 py-1 rounded-md border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-600 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {verifyingSessionId && (
                <form
                  onSubmit={handleConfirmUtrByAdmin}
                  className="p-3 rounded-xl bg-slate-50 border border-blue-200 flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="text-slate-700 font-medium">Enter 12-Digit Bank UTR:</span>
                  <input
                    type="text"
                    maxLength={12}
                    value={adminUtrInput}
                    onChange={(e) => setAdminUtrInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 630112345678"
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer"
                  >
                    Confirm Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyingSessionId(null)}
                    className="px-2 py-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  {adminUtrError && (
                    <span className="text-rose-600 w-full">{adminUtrError}</span>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Refund Form Modal if triggered */}
          {refundingSession && (
            <form
              onSubmit={handleIssueRefund}
              className="p-5 rounded-xl bg-white border border-amber-300 shadow-md space-y-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-display font-bold text-slate-900">
                  Issue Direct UPI Refund for Order {refundingSession.order_id} (
                  {formatPaiseToInr(refundingSession.amount_paise)})
                </h3>
                <button
                  type="button"
                  onClick={() => setRefundingSession(null)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={refundVpa}
                  onChange={(e) => setRefundVpa(e.target.value)}
                  placeholder="Customer UPI VPA (e.g. customer@okicici)"
                  className="px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900"
                />
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Refund reason"
                  className="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900"
                />
              </div>
              {refundError && <p className="text-rose-600">{refundError}</p>}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
              >
                Process Refund
              </button>
            </form>
          )}

          {/* Transactions Table with Global Search Bar, Filter Dropdowns & Bulk Actions */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Transactions & Orders
                  </h2>
                  {selectedSessionIds.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[11px] font-mono font-bold text-blue-700">
                      {selectedSessionIds.length} Selected
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Showing {filteredSessions.length} of {snapshot.sessions.length} recorded payment
                  sessions · Select checkboxes for bulk reconciliation or export
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Status Group Pills: All, Success, Pending, Expired */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'SUCCESS', label: 'Success' },
                    { id: 'PENDING', label: 'Pending' },
                    { id: 'EXPIRED', label: 'Expired' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {onOpenShortcutsModal && (
                  <button
                    type="button"
                    onClick={onOpenShortcutsModal}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                    title="View Global Keyboard Shortcuts (?)"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">Shortcuts</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px] text-slate-600">
                      ?
                    </kbd>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportTransactionsCsv}
                  disabled={filteredSessions.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-display font-semibold text-white transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
                  title="Export currently filtered transactions as a CSV file for accounting and bookkeeping"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {copiedKey === 'csv_exported'
                      ? 'Exported Accounting CSV'
                      : hasActiveFilters
                        ? `Export Filtered CSV (${filteredSessions.length})`
                        : `Export Accounting CSV (${filteredSessions.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Global Search Bar & Filter Dropdowns Row */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Global Search Input with '/' Shortcut Badge */}
                <div className="md:col-span-5 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Global search by Order ID, Customer Name, or 12-Digit UTR..."
                    className="w-full pl-8 pr-14 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Clear search (Esc)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[10px] font-semibold text-slate-500 pointer-events-none"
                      title="Press / to focus search"
                    >
                      /
                    </kbd>
                  )}
                </div>

                {/* Search Scope Dropdown */}
                <div className="md:col-span-2 flex items-center gap-1.5">
                  <select
                    value={searchField}
                    onChange={(e) =>
                      setSearchField(e.target.value as 'ALL' | 'ORDER_ID' | 'CUSTOMER' | 'UTR')
                    }
                    aria-label="Search field scope"
                    className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ALL">Field: All Fields</option>
                    <option value="ORDER_ID">Field: Order ID</option>
                    <option value="CUSTOMER">Field: Customer Name</option>
                    <option value="UTR">Field: 12-Digit UTR</option>
                  </select>
                </div>

                {/* Payment Status Filter Dropdown */}
                <div className="md:col-span-3 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden sm:block" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by payment status"
                    className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ALL">Status: All Payments</option>
                    <option value="SUCCESS">Status: Success (Captured & Settled)</option>
                    <option value="PENDING">Status: Pending (Active & Queued)</option>
                    <option value="EXPIRED">Status: Expired / Cancelled</option>
                    <option value="OBSERVED_SUCCESS">Status: Captured Only</option>
                    <option value="RECONCILED">Status: Reconciled Only</option>
                    <option value="REFUNDED">Status: Refunded Only</option>
                  </select>
                </div>

                {/* Date Range Filter Dropdown + Reset */}
                <div className="md:col-span-2 flex items-center gap-1.5">
                  <select
                    value={dateFilter}
                    onChange={(e) =>
                      setDateFilter(
                        e.target.value as
                          | 'ALL_TIME'
                          | 'TODAY'
                          | 'LAST_7_DAYS'
                          | 'LAST_30_DAYS'
                          | 'THIS_MONTH'
                      )
                    }
                    aria-label="Filter by date range"
                    className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ALL_TIME">Date: All Time</option>
                    <option value="TODAY">Date: Today</option>
                    <option value="LAST_7_DAYS">Date: Last 7 Days</option>
                    <option value="LAST_30_DAYS">Date: Last 30 Days</option>
                    <option value="THIS_MONTH">Date: This Month</option>
                  </select>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter('ALL');
                        setSearchQuery('');
                        setSearchField('ALL');
                        setDateFilter('ALL_TIME');
                      }}
                      className="px-2.5 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold shrink-0 cursor-pointer"
                      title="Reset all filters"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Filtered Accounting Summary & Direct CSV Export Strip */}
              <div className="pt-2.5 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    Showing{' '}
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {filteredSessions.length}
                    </span>{' '}
                    of{' '}
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {snapshot.sessions.length}
                    </span>{' '}
                    transactions
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Filtered Net Settled:{' '}
                    <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                      {formatPaiseToInr(
                        filteredSessions.reduce((acc, s) => {
                          if (s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED') {
                            return acc + Math.max(0, s.amount_paise - (s.refunded_paise || 0));
                          }
                          return acc;
                        }, 0)
                      )}
                    </span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Zero-MDR Ledger Ready (Tally / Zoho Books / Excel)</span>
                </div>

                <button
                  type="button"
                  onClick={handleExportTransactionsCsv}
                  disabled={filteredSessions.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50 border border-slate-300 text-slate-800 font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                  title="Download filtered transactions as a UTF-8 CSV file for accounting"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>
                    {copiedKey === 'csv_exported'
                      ? 'Accounting CSV Downloaded'
                      : `Export Filtered CSV for Accounting (${filteredSessions.length})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Bulk Action Feedback Banner */}
            {bulkFeedback && (
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium ${
                  bulkFeedback.type === 'ok'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{bulkFeedback.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkFeedback(null)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Contextual Bulk Actions Toolbar (Active when 1+ checkboxes are selected) */}
            {selectedSessionIds.length > 0 && (
              <div className="p-3.5 rounded-xl bg-blue-50/90 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-display font-bold flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{selectedSessionIds.length} Selected</span>
                  </span>
                  <span className="text-slate-700 font-mono font-semibold tabular-nums">
                    Total Volume:{' '}
                    {formatPaiseToInr(
                      snapshot.sessions
                        .filter((s) => selectedSessionIds.includes(s.id))
                        .reduce((acc, s) => acc + s.amount_paise, 0)
                    )}
                  </span>
                  {selectedSessionIds.length < filteredSessions.length && (
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAllFiltered(filteredSessions)}
                      className="text-blue-700 hover:underline font-semibold cursor-pointer"
                    >
                      Select all {filteredSessions.length} displayed
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBulkMarkReconciled}
                    disabled={bulkReconciling}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-display font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Mark all selected transactions as Reconciled in database & audit logs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {bulkReconciling
                        ? 'Reconciling...'
                        : `Mark as Reconciled (${selectedSessionIds.length})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSelectedTransactionsCsv}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Export only selected transactions to CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {copiedKey === 'selected_csv_exported'
                        ? 'Exported Selected!'
                        : `Export Selected (${selectedSessionIds.length})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedSessionIds([])}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold cursor-pointer"
                    title="Clear selection (Esc)"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                No transactions recorded yet. Create an order above or share a Payment Link.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-3 pl-4 pr-2 w-9">
                        <input
                          type="checkbox"
                          aria-label="Select all displayed transactions"
                          checked={
                            filteredSessions.length > 0 &&
                            filteredSessions.every((s) => selectedSessionIds.includes(s.id))
                          }
                          onChange={() => handleToggleSelectAllFiltered(filteredSessions)}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4 font-medium">Order ID</th>
                      <th className="py-3 px-4 font-medium">Payment ID</th>
                      <th className="py-3 px-4 font-medium">Customer</th>
                      <th className="py-3 px-4 font-medium text-right">Amount</th>
                      <th className="py-3 px-4 font-medium">Status</th>
                      <th className="py-3 px-4 font-medium">12-Digit UTR</th>
                      <th className="py-3 px-4 font-medium text-right">Created</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {filteredSessions.map((s) => {
                      const isRowSelected = selectedSessionIds.includes(s.id);
                      return (
                        <tr
                          key={s.id}
                          className={`transition-colors text-slate-700 ${
                            isRowSelected
                              ? 'bg-blue-50/60 hover:bg-blue-50'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 pl-4 pr-2">
                            <input
                              type="checkbox"
                              aria-label={`Select order ${s.order_id}`}
                              checked={isRowSelected}
                              onChange={() => handleToggleSelectSession(s.id)}
                              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{s.order_id}</td>
                          <td className="py-3 px-4 text-slate-500">{s.id}</td>
                          <td className="py-3 px-4 font-sans">
                            <span className="text-slate-900 font-medium">
                              {s.customer_name || '—'}
                            </span>
                            {s.customer_phone ? (
                              <span className="text-slate-500"> · {s.customer_phone}</span>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatPaiseToInr(s.amount_paise)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={
                                s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED'
                                  ? 'text-emerald-600 font-semibold'
                                  : s.status === 'ACTIVE' || s.status === 'PROCESSING'
                                  ? 'text-blue-600 font-semibold'
                                  : 'text-slate-500'
                              }
                            >
                              {s.status === 'OBSERVED_SUCCESS' ? 'CAPTURED' : s.status}
                              {s.refund_status && s.refund_status !== 'NONE'
                                ? ` · REFUNDED`
                                : ''}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-800">{s.utr || '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-500">
                            {new Date(s.created_at).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-4 text-right font-sans space-x-3">
                            <button
                              type="button"
                              onClick={() => onOpenCheckoutModal(s.id)}
                              className="text-blue-600 hover:underline font-medium cursor-pointer"
                            >
                              View
                            </button>
                            {(s.status === 'OBSERVED_SUCCESS' || s.status === 'RECONCILED') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadTaxInvoice(s)}
                                  className="text-emerald-700 hover:underline font-medium cursor-pointer"
                                  title="Download Tax Invoice"
                                >
                                  Invoice
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReplayWebhook(s.id)}
                                  className="text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                                  title="Send webhook again"
                                >
                                  Webhook
                                </button>
                                {s.refund_status !== 'FULL' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRefundingSession(s);
                                      setRefundVpa(s.payer_vpa || '');
                                    }}
                                    className="text-amber-600 hover:underline font-medium cursor-pointer"
                                  >
                                    Refund
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Customer Directory & Spend Analytics */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">
                  Customer Directory & Spend Analytics
                </h2>
                <p className="text-xs text-slate-500">
                  Automatically indexed customers from your UPI orders, sorted by lifetime volume.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-600 tabular-nums">
                {(snapshot.customers || []).length} Unique Customers
              </span>
            </div>

            {!snapshot.customers || snapshot.customers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                Customers will appear here automatically as orders are created with customer contact
                details.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                      <th className="py-3 px-4 font-medium">Customer Name</th>
                      <th className="py-3 px-4 font-medium">Phone / Email</th>
                      <th className="py-3 px-4 font-medium">Payer UPI VPA</th>
                      <th className="py-3 px-4 font-medium text-right">Verified Payments</th>
                      <th className="py-3 px-4 font-medium text-right">Lifetime Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {snapshot.customers.map((c) => (
                      <tr key={c.key} className="hover:bg-slate-50/80 text-slate-700">
                        <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                          {c.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {c.phone || c.email || '—'}
                        </td>
                        <td className="py-3 px-4 text-blue-600">{c.vpa || '—'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-slate-900">
                          {c.paymentsCount}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {formatPaiseToInr(c.totalSpentPaise)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SHAREABLE PAYMENT LINKS (LIVE PAYMENT PRIORITY FIRST) */}
      {activeSubTab === 'links' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreatePaymentLink}
            className="lg:col-span-5 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">
                  Create Live Payment Link
                </h2>
                <p className="text-xs text-slate-500">
                  Create a live UPI checkout link with real-time verification to share on WhatsApp,
                  Email, or SMS.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono text-[10px] font-bold text-blue-700 shrink-0">
                LIVE FIRST
              </span>
            </div>

            {/* Priority Selector: Live Payment First vs Dynamic QR */}
            <div className="space-y-1.5">
              <label className="block text-slate-700 font-semibold">
                Checkout Mode Priority (When Creating Link)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLinkPriorityMode('LIVE_PAYMENT')}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                    linkPriorityMode === 'LIVE_PAYMENT'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 font-semibold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <div className="font-display font-bold text-xs">1. Live Payment</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Priority Checkout &amp; Timer
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setLinkPriorityMode('DYNAMIC_QR')}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                    linkPriorityMode === 'DYNAMIC_QR'
                      ? 'bg-blue-50 border-blue-500 text-blue-800 font-semibold shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-slate-500 shrink-0" />
                  <div>
                    <div className="font-display font-bold text-xs">2. Dynamic QR</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      Secondary QR Preview
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-700 font-medium">Payment Purpose / Title *</label>
              <input
                type="text"
                required
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="e.g. Website Development Invoice #104"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-700 font-medium">Amount (INR) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={linkRupees}
                onChange={(e) => setLinkRupees(e.target.value)}
                placeholder="1499.00"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium">Customer Name</label>
                <input
                  type="text"
                  value={linkCustomerName}
                  onChange={(e) => setLinkCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-700 font-medium">Customer Phone</label>
                <input
                  type="tel"
                  value={linkCustomerPhone}
                  onChange={(e) => setLinkCustomerPhone(e.target.value)}
                  placeholder="+91"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-700 font-medium">Description / Notes</label>
              <textarea
                rows={2}
                value={linkDesc}
                onChange={(e) => setLinkDesc(e.target.value)}
                placeholder="Notes visible on the customer live payment page"
                className="w-full p-3 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={creatingLink}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>
                {creatingLink ? 'Creating Live Payment Link...' : 'Create Live Payment Link'}
              </span>
            </button>
          </form>

          <div className="lg:col-span-7 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
            {/* Priority #1: Featured Live Payment Card (Shown First When Created or Selected) */}
            {(featuredLiveLink || snapshot.paymentLinks[0]) && (() => {
              const activePl = featuredLiveLink || snapshot.paymentLinks[0];
              if (!activePl) return null;
              const liveUrl = `${baseUrl}/pay/${activePl.short_code}`;
              const liveWaText = encodeURIComponent(
                `Hello, please complete your live UPI payment of ${formatPaiseToInr(
                  activePl.amount_paise
                )} for "${activePl.title}" here: ${liveUrl}`
              );
              return (
                <div className="p-5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-[10px] font-bold">
                        PRIORITY #1 · LIVE PAYMENT
                      </span>
                      <span className="font-display font-bold text-slate-900">
                        {activePl.title} ({formatPaiseToInr(activePl.amount_paise)})
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-blue-700 font-semibold">
                      Real-Time 5-Min Slot &amp; Auto-Verification
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-white border border-blue-200 font-mono text-slate-800 flex items-center justify-between gap-2">
                    <span className="truncate select-all">{liveUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(liveUrl, `featured_${activePl.id}`)}
                      className="text-blue-600 hover:underline font-sans font-semibold shrink-0 cursor-pointer"
                    >
                      {copiedKey === `featured_${activePl.id}` ? 'Copied!' : 'Copy Live URL'}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={launchingLiveLinkId === activePl.id}
                      onClick={() => handleLaunchLivePaymentFromLink(activePl)}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        {launchingLiveLinkId === activePl.id
                          ? 'Starting Live Checkout...'
                          : '1. Launch Live Payment Checkout Now'}
                      </span>
                    </button>

                    <a
                      href={`/pay/${activePl.short_code}`}
                      className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5"
                    >
                      <span>Open Hosted Live Page</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <a
                      href={`https://wa.me/?text=${liveWaText}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold flex items-center gap-1"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share on WhatsApp</span>
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        setPreviewQrLink(previewQrLink?.id === activePl.id ? null : activePl)
                      }
                      className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 font-medium flex items-center gap-1 cursor-pointer ml-auto"
                    >
                      <QrCode className="w-3.5 h-3.5 text-slate-500" />
                      <span>{previewQrLink?.id === activePl.id ? 'Hide QR' : 'Dynamic QR'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-bold text-slate-900">
                Live Payment Links Directory
              </h2>
              <span className="text-[11px] text-slate-500">
                Live Payment is prioritized first on all links
              </span>
            </div>

            {snapshot.paymentLinks.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                No payment links created yet. Fill out the form on the left to generate your first
                live payment link.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {snapshot.paymentLinks.map((pl) => {
                  const fullUrl = `${baseUrl}/pay/${pl.short_code}`;
                  const waText = encodeURIComponent(
                    `Hello, please complete your payment of ${formatPaiseToInr(
                      pl.amount_paise
                    )} for "${pl.title}" via UPI: ${fullUrl}`
                  );
                  return (
                    <div
                      key={pl.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white hover:bg-slate-50"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{pl.title}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono font-bold text-blue-600 tabular-nums">
                            {formatPaiseToInr(pl.amount_paise)}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`font-mono font-semibold ${
                              pl.status === 'PAID' ? 'text-emerald-600' : 'text-slate-600'
                            }`}
                          >
                            {pl.status}
                          </span>
                        </div>
                        <div className="font-mono text-slate-500">{fullUrl}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* 1st Priority: Live Payment Checkout */}
                        <button
                          type="button"
                          disabled={launchingLiveLinkId === pl.id}
                          onClick={() => handleLaunchLivePaymentFromLink(pl)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="Start Live Payment Checkout with real-time timer & verification"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>
                            {launchingLiveLinkId === pl.id ? 'Starting...' : 'Live Payment'}
                          </span>
                        </button>

                        <a
                          href={`/pay/${pl.short_code}`}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium flex items-center gap-1"
                        >
                          <span>Open Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleCopy(fullUrl, pl.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium cursor-pointer"
                        >
                          {copiedKey === pl.id ? 'Copied' : 'Copy URL'}
                        </button>

                        <a
                          href={`https://wa.me/?text=${waText}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-medium flex items-center gap-1"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>

                        {/* Secondary / Last: Dynamic QR */}
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewQrLink(previewQrLink?.id === pl.id ? null : pl)
                          }
                          className={`px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1 cursor-pointer border transition-colors ${
                            previewQrLink?.id === pl.id
                              ? 'bg-blue-50 border-blue-300 text-blue-700'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <QrCode className="w-3.5 h-3.5 text-slate-500" />
                          <span>QR</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {previewQrLink && (
              <div className="p-5 rounded-xl bg-slate-50 border border-blue-200 space-y-4 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <span className="font-display font-bold text-slate-900">
                      Secondary Dynamic UPI QR Code — {previewQrLink.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewQrLink(null)}
                    className="text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Close Preview
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  <div className="sm:col-span-4 flex flex-col items-center">
                    <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      {previewQrSvg ? (
                        <div
                          className="w-36 h-36 [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: previewQrSvg }}
                        />
                      ) : (
                        <div className="w-36 h-36 bg-slate-100 animate-pulse rounded-lg" />
                      )}
                    </div>
                  </div>
                  <div className="sm:col-span-8 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">
                          Encoded VPA (pa)
                        </div>
                        <div className="font-mono font-semibold text-slate-900 truncate">
                          {snapshot.merchant.vpa}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">
                          Amount (am)
                        </div>
                        <div className="font-mono font-bold text-blue-600">
                          {formatPaiseToInr(previewQrLink.amount_paise)}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">
                          Transaction ID (tr)
                        </div>
                        <div className="font-mono font-semibold text-slate-900">
                          PL-{previewQrLink.short_code.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Live Payment Checkout is shown first when customers open{' '}
                      <span className="font-mono text-slate-800">
                        {baseUrl}/pay/{previewQrLink.short_code}
                      </span>
                      , with this Dynamic QR available as a secondary option.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: WEBSITE PAYMENT BUTTON BUILDER */}
      {activeSubTab === 'buttons' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4 text-xs">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">
                Payment Button Builder
              </h2>
              <p className="text-xs text-slate-500">
                Configure a 1-click UPI checkout button for any HTML, WordPress, Webflow, or Shopify
                site.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-700 font-medium">Button Text</label>
              <input
                type="text"
                value={btnLabel}
                onChange={(e) => setBtnLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-700 font-medium">Amount (INR)</label>
              <input
                type="number"
                min="1"
                value={btnAmount}
                onChange={(e) => setBtnAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-700 font-medium">Button Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={btnColor}
                  onChange={(e) => setBtnColor(e.target.value)}
                  className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={btnColor}
                  onChange={(e) => setBtnColor(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2">
              <div className="text-slate-500 font-medium">Live Interactive Preview (Click to Test):</div>
              <button
                type="button"
                data-youpi-pay="true"
                data-amount={btnAmount || '499'}
                style={{ backgroundColor: btnColor }}
                className="px-6 py-3 rounded-lg text-white font-display font-semibold text-sm shadow-sm hover:opacity-95 transition-opacity cursor-pointer"
              >
                {btnLabel || 'Pay Now'} · ₹{btnAmount || '499'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-display font-bold text-slate-900">
                  Embed Code for Your Website
                </h3>
                <p className="text-xs text-slate-500">
                  Paste this snippet into any webpage—clicking the button opens the UPI Checkout
                  modal overlay.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(htmlButtonSnippet, 'btn_code')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer"
              >
                {copiedKey === 'btn_code' ? 'Copied HTML' : 'Copy Embed Code'}
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto leading-relaxed">
              <code>{htmlButtonSnippet}</code>
            </pre>
          </div>
        </div>
      )}

      {/* TAB 4: BANK STATEMENT CSV RECONCILIATION & WEBHOOK LOGS */}
      {activeSubTab === 'reconcile' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">
                  Bank Statement CSV Reconciliation
                </h2>
                <p className="text-xs text-slate-500">
                  Upload your HDFC, ICICI, SBI, or Axis bank statement CSV to match transactions by
                  exact [Amount + 12-digit UTR] and mark them RECONCILED.
                </p>
              </div>

              <form onSubmit={handleRunReconciliation} className="space-y-4">
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-slate-600">
                    Select a CSV bank statement file or paste statement rows below:
                  </span>
                  <label className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-medium cursor-pointer shrink-0 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose CSV</span>
                    <input
                      type="file"
                      accept=".csv,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <textarea
                  rows={7}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Date,Narration,UTR,Credit&#10;2026-10-28,UPI/CR/630112345678,630112345678,499.00"
                  className="w-full p-3.5 rounded-xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />

                <button
                  type="submit"
                  disabled={reconciling || !csvText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold text-xs transition-colors cursor-pointer"
                >
                  {reconciling ? 'Reconciling...' : 'Reconcile Bank Statement'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-5 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <h3 className="text-base font-display font-bold text-slate-900">
                Reconciliation Summary
              </h3>

              {!reconcileReport ? (
                <div className="py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center text-xs text-slate-500">
                  Upload a bank statement CSV to view matched and unmatched UTR records.
                </div>
              ) : (
                <div className="space-y-4 text-xs font-mono tabular-nums">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-slate-500 font-sans">Rows Parsed</div>
                      <div className="text-xl font-bold text-slate-900 mt-0.5">
                        {reconcileReport.totalParsedRows}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-emerald-700 font-sans">Reconciled</div>
                      <div className="text-xl font-bold text-emerald-700 mt-0.5">
                        {reconcileReport.reconciledCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bank Observations & Webhook Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                Incoming Bank Observations (SHA-256 Deduplicated)
              </h3>
              {snapshot.observations.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  No bank observations ingested yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                  {snapshot.observations.map((obs) => (
                    <div key={obs.id} className="p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-emerald-700">
                          {formatPaiseToInr(obs.amount_paise)} · UTR {obs.utr}
                        </span>
                        <span className="text-slate-500">{obs.source_channel}</span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-600 truncate">
                        {obs.raw_payload}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
              <h3 className="text-sm font-display font-bold text-slate-900">
                Outbound Webhook Deliveries
              </h3>
              {snapshot.webhooks.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-200 rounded-xl">
                  Configure your Outbound Webhook URL in Settings to log webhook deliveries.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-64 overflow-y-auto">
                  {snapshot.webhooks.map((wh) => (
                    <div key={wh.id} className="p-3 space-y-1 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          {wh.order_id} · HTTP {wh.status_code}
                        </span>
                        <span className="text-slate-500">
                          {new Date(wh.delivered_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{wh.target_url}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: INTEGRATION HUB, GITHUB PUBLISHER, API KEYS, SUBSCRIPTION & BILLING, AND AUDIT LOGS */}
      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Sub-Navigation Bar inside Integration & Settings */}
          <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSettingsSection('config')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-semibold transition-colors cursor-pointer ${
                  settingsSection === 'config'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Webhook className="w-3.5 h-3.5" />
                <span>Configuration, Webhooks & Alerts</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsSection('billing')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-semibold transition-colors cursor-pointer ${
                  settingsSection === 'billing'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Free Forever & Usage</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                    settingsSection === 'billing'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  ₹0 FREE
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsSection('audit')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settingsSection === 'audit'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Audit Logs</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                    settingsSection === 'audit'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {(snapshot.auditLogs || []).length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsSection('infrastructure')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  settingsSection === 'infrastructure'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Bank Forwarder & Cloud Backups</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                    settingsSection === 'infrastructure'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  {(snapshot.backups || []).length}
                </span>
              </button>
            </div>

            <div className="px-3 py-1 text-[11px] font-mono text-slate-500 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>0% Platform MDR · Direct-to-Bank UPI</span>
            </div>
          </div>

          {/* SUB-TAB A: CONFIGURATION, BRANDING, WEBHOOKS & ALERT RULES */}
          {settingsSection === 'config' && (
            <div className="space-y-8">
              {/* GitHub Connect & 1-Click OpenPay Repository Publisher */}
              <div className="p-6 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Publish OpenPay Gateway &amp; Integration Suite to Your GitHub Account
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Connect your GitHub account using a <strong>1-Click GitHub Token</strong> (takes 10
                  seconds — no OAuth App setup needed!) or <strong>GitHub OAuth Popup</strong> to
                  create the <code className="font-mono text-slate-900">openpay</code> repository
                  and push all 22 source files, Drop-In SDK (<code className="font-mono">/public/sdk.js</code>),
                  Android Observer (<code className="font-mono">YoupiObserverApp.kt</code>), and{' '}
                  <code className="font-mono">README.md</code>.
                </p>
              </div>

              <div className="shrink-0 flex flex-wrap items-center gap-2">
                {githubStatus?.authenticated && githubStatus.user ? (
                  <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs">
                    {githubStatus.user.avatarUrl && (
                      <img
                        src={githubStatus.user.avatarUrl}
                        alt={githubStatus.user.login}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">
                        @{githubStatus.user.login}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        GitHub Connected &amp; Ready to Push
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleGitHubLogout}
                      className="ml-2 text-slate-500 hover:text-rose-600 underline cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=OpenPay+Gateway+Publisher"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>1. Get 1-Click GitHub Token</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      type="button"
                      onClick={handleGitHubSignIn}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Sign in via OAuth Popup</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {!githubStatus?.authenticated && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
                {/* Fastest Method: 10-Second 1-Click GitHub Token Connect */}
                <div className="lg:col-span-7 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        Fastest Method: 10-Second GitHub Token Sign-In (Zero OAuth App Required)
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                      RECOMMENDED
                    </span>
                  </div>

                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>
                      Click{' '}
                      <a
                        href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=OpenPay+Gateway+Publisher"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Open Pre-Filled GitHub Token Page (repo scope pre-checked) ↗
                      </a>{' '}
                      and click green <strong>Generate token</strong> at the bottom of that page.
                    </li>
                    <li>
                      Paste your <code className="font-mono text-slate-900">ghp_...</code> token
                      below and click <strong>Connect GitHub</strong> (or directly click{' '}
                      <strong>Create Repo &amp; Push All</strong> below!):
                    </li>
                  </ol>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      value={ghPersonalToken}
                      onChange={(e) => setGhPersonalToken(e.target.value)}
                      placeholder="Paste GitHub Token here (ghp_xxxxxxxxxxxx or github_pat_...)"
                      className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      disabled={connectingGhToken || !ghPersonalToken.trim()}
                      onClick={() => handleConnectGitHubToken()}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-display font-semibold cursor-pointer shrink-0"
                    >
                      {connectingGhToken ? 'Verifying...' : 'Connect GitHub'}
                    </button>
                  </div>
                </div>

                {/* Alternative Method: GitHub OAuth App Setup */}
                <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-slate-900">
                        Alternative: GitHub OAuth Popup Setup
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowGhOAuthSetup((prev) => !prev)}
                        className="text-blue-600 hover:underline font-semibold cursor-pointer text-[11px]"
                      >
                        {showGhOAuthSetup ? 'Hide OAuth Form' : 'Configure OAuth ID/Secret'}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      If using a{' '}
                      <a
                        href="https://github.com/settings/developers"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-medium"
                      >
                        GitHub OAuth App
                      </a>
                      , set its <strong>Authorization callback URL</strong> to:
                    </p>
                    <div className="p-2 rounded bg-white border border-slate-200 font-mono text-[11px] text-slate-800 break-all flex items-center justify-between gap-2">
                      <span className="truncate select-all">
                        {githubStatus?.callbackUrl || `${baseUrl}/auth/callback`}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            githubStatus?.callbackUrl || `${baseUrl}/auth/callback`,
                            'gh_cb'
                          )
                        }
                        className="text-blue-600 hover:underline font-sans font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedKey === 'gh_cb' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {showGhOAuthSetup && (
                    <form onSubmit={handleSaveGitHubOAuthConfig} className="space-y-2 pt-2 border-t border-slate-200">
                      <input
                        type="text"
                        value={ghClientIdInput}
                        onChange={(e) => setGhClientIdInput(e.target.value)}
                        placeholder="GitHub OAuth Client ID (Ov23li...)"
                        className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 font-mono text-xs text-slate-900"
                      />
                      <input
                        type="password"
                        value={ghClientSecretInput}
                        onChange={(e) => setGhClientSecretInput(e.target.value)}
                        placeholder="GitHub OAuth Client Secret"
                        className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 font-mono text-xs text-slate-900"
                      />
                      <button
                        type="submit"
                        disabled={savingGhOAuth}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
                      >
                        {savingGhOAuth ? 'Saving...' : 'Save OAuth Credentials'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            <form
              onSubmit={handleCreateGitHubRepo}
              className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs"
            >
              <div className="md:col-span-4 space-y-1.5">
                <label className="block text-slate-700 font-medium">New Repository Name *</label>
                <input
                  type="text"
                  required
                  value={ghRepoName}
                  onChange={(e) => setGhRepoName(e.target.value)}
                  placeholder="openpay"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="md:col-span-5 space-y-1.5">
                <label className="block text-slate-700 font-medium">Repository Description</label>
                <input
                  type="text"
                  value={ghRepoDesc}
                  onChange={(e) => setGhRepoDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="md:col-span-3 flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-slate-700 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ghIsPrivate}
                    onChange={(e) => setGhIsPrivate(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>Private</span>
                </label>

                <button
                  type="submit"
                  disabled={
                    publishingRepo ||
                    (!githubStatus?.authenticated && !ghPersonalToken.trim())
                  }
                  className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold text-xs transition-colors cursor-pointer shadow-xs"
                >
                  {publishingRepo ? 'Pushing 22 Files...' : 'Create Repo & Push All'}
                </button>
              </div>
            </form>

            {ghError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {ghError}
              </div>
            )}

            {publishedRepoResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Repository {publishedRepoResult.fullName} created &amp;{' '}
                      {publishedRepoResult.filesCommittedCount} files pushed to{' '}
                      {publishedRepoResult.branch}!
                    </span>
                  </div>
                  <div className="font-mono text-emerald-700">
                    {publishedRepoResult.repoUrl}
                  </div>
                </div>
                <a
                  href={publishedRepoResult.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shrink-0"
                >
                  <span>Open on GitHub</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>

          {/* SECTION 1: CHECKOUT CUSTOMIZATION PANEL (LOGO UPLOAD & PRIMARY ACCENT COLOR) */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Palette className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Checkout Page Customization (Logo & Primary Accent Color)
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Upload your merchant logo and define the primary accent color passed directly to{' '}
                  <code className="font-mono text-slate-800">CustomerCheckoutModal</code> and hosted
                  Payment Links.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleSaveMerchantSettings(e, false)}
                  disabled={savingSettings}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-display font-semibold text-xs cursor-pointer"
                >
                  {savingSettings ? 'Saving...' : 'Save Branding'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndPreviewCheckout}
                  disabled={savingSettings}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <span>Preview in Checkout Modal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column: Logo Upload & Primary Accent Color Controls */}
              <div className="lg:col-span-7 space-y-5 text-xs">
                {/* Brand Logo Upload */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-display font-bold text-slate-900 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-blue-600" />
                      <span>Merchant Checkout Logo</span>
                    </label>
                    {formLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setFormLogoUrl('')}
                        className="text-rose-600 hover:underline font-medium cursor-pointer"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                      {formLogoUrl ? (
                        <img
                          src={formLogoUrl}
                          alt="Merchant Logo Preview"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-1.5"
                        />
                      ) : (
                        <span
                          className="w-12 h-12 rounded-xl text-white font-display font-bold text-sm flex items-center justify-center"
                          style={{ backgroundColor: formThemeColor || '#2563EB' }}
                        >
                          {(formName || 'OP').slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs">
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          <span>Upload Logo Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoFileUpload}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[11px] text-slate-500">
                          PNG, SVG, JPG, or WebP (Auto-encoded)
                        </span>
                      </div>

                      <input
                        type="text"
                        value={formLogoUrl}
                        onChange={(e) => setFormLogoUrl(e.target.value)}
                        placeholder="Or paste a direct Logo Image URL (https://...)"
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Primary Accent Color Picker + Presets */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="block font-display font-bold text-slate-900">
                    Primary Checkout Accent Color
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      value={formThemeColor}
                      onChange={(e) => setFormThemeColor(e.target.value)}
                      className="w-11 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5"
                    />
                    <input
                      type="text"
                      value={formThemeColor}
                      onChange={(e) => setFormThemeColor(e.target.value)}
                      placeholder="#2563EB"
                      className="w-32 px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 uppercase focus:outline-none focus:border-blue-600"
                    />

                    <div className="flex items-center gap-1.5">
                      {[
                        { label: 'Royal Blue', hex: '#2563EB' },
                        { label: 'Indigo', hex: '#4F46E5' },
                        { label: 'Slate Navy', hex: '#0F172A' },
                        { label: 'Violet', hex: '#7C3AED' },
                        { label: 'Teal', hex: '#0D9488' },
                        { label: 'Crimson', hex: '#E11D48' },
                      ].map((swatch) => (
                        <button
                          key={swatch.hex}
                          type="button"
                          onClick={() => setFormThemeColor(swatch.hex)}
                          className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer ${
                            formThemeColor.toUpperCase() === swatch.hex
                              ? 'scale-110 ring-2 ring-offset-1 ring-blue-600 border-white'
                              : 'border-slate-300 hover:scale-105'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                          title={`${swatch.label} (${swatch.hex})`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Applied to the <code className="font-mono">CustomerCheckoutModal</code> header,
                    QR viewfinder brackets, countdown ring, and primary payment buttons.
                  </p>
                </div>
              </div>

              {/* Right Column: Live Interactive CustomerCheckoutModal Mini Preview */}
              <div className="lg:col-span-5">
                <div className="text-[11px] font-mono uppercase text-slate-400 mb-2">
                  Live CustomerCheckoutModal Preview
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
                  <div
                    className="px-4 py-4 text-white flex items-center justify-between gap-3 transition-colors"
                    style={{ backgroundColor: formThemeColor || '#2563EB' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {formLogoUrl ? (
                        <img
                          src={formLogoUrl}
                          alt={formName || 'Merchant'}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-xl object-contain bg-white p-1 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-display font-bold text-xs text-white shrink-0">
                          {(formName || 'OP').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 font-display font-bold text-sm text-white truncate">
                          <span className="truncate">{formName || 'OpenPay — By Aniket'}</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-white/90 shrink-0" />
                        </div>
                        <div className="text-[11px] font-mono text-white/80 truncate">
                          {formVpa || snapshot.merchant.vpa}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-mono font-bold text-white tabular-nums">
                        ₹499.00
                      </div>
                      <div className="text-[10px] text-white/80">Zero-Fee UPI</div>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-white text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-600 font-medium">UPI QR & Intent Ready</span>
                      <span
                        className="font-mono font-semibold text-[11px] px-2 py-0.5 rounded bg-white border"
                        style={{
                          color: formThemeColor || '#2563EB',
                          borderColor: formThemeColor || '#2563EB',
                        }}
                      >
                        04:59
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveAndPreviewCheckout}
                      className="w-full py-2.5 px-4 rounded-xl text-white font-display font-semibold text-xs shadow-xs transition-opacity hover:opacity-95 cursor-pointer"
                      style={{ backgroundColor: formThemeColor || '#2563EB' }}
                    >
                      I Have Paid — Verify Payment →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: WEBHOOK CONFIGURATION SECTION (SUCCESS, FAILURE & EXPIRATION POST NOTIFICATIONS) */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Webhook Configuration & Transaction Status Callbacks
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  Register a Callback URL to receive real-time HMAC-SHA256 signed{' '}
                  <code className="font-mono text-slate-800">POST</code> notifications for payment
                  success, failure/cancellation, and session expiration.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFormWebhookUrl(`${baseUrl}/api/webhooks/loopback-test`)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 shrink-0 cursor-pointer"
                title="Populate built-in loopback test receiver endpoint"
              >
                Use Built-In Loopback Test URL
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              <div className="lg:col-span-7 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-semibold">
                    Registered Callback Webhook URL (Receives HTTP POST)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={formWebhookUrl}
                      onChange={(e) => setFormWebhookUrl(e.target.value)}
                      placeholder="https://your-backend.com/api/webhooks/openpay"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={(e) => handleSaveMerchantSettings(e, false)}
                      disabled={savingSettings}
                      className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold shrink-0 cursor-pointer shadow-2xs"
                    >
                      {savingSettings ? 'Saving...' : 'Save Webhook URL'}
                    </button>
                  </div>
                </div>

                {/* Subscribed Lifecycle Events */}
                <div className="space-y-2">
                  <div className="text-slate-600 font-medium">
                    Active Transaction Status POST Events & One-Click Test Triggers:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-emerald-800">
                            payment.captured
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-[10px] font-semibold text-emerald-800">
                            SUCCESS
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Fired when 12-digit UTR is verified via observer or manual check.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={testingWebhookEvent !== null}
                        onClick={() => handleSendTestWebhook('payment.captured')}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>
                          {testingWebhookEvent === 'payment.captured'
                            ? 'Sending...'
                            : 'Test Success POST'}
                        </span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-rose-800">payment.failed</span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-[10px] font-semibold text-rose-800">
                            FAILURE
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Fired when a checkout session fails or is cancelled by the customer.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={testingWebhookEvent !== null}
                        onClick={() => handleSendTestWebhook('payment.failed')}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white hover:bg-rose-100 border border-rose-300 text-rose-800 font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>
                          {testingWebhookEvent === 'payment.failed'
                            ? 'Sending...'
                            : 'Test Failure POST'}
                        </span>
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-amber-900">
                            payment.expired
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[10px] font-semibold text-amber-900">
                            EXPIRED
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Fired automatically when the 5-minute payment slot window expires.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={testingWebhookEvent !== null}
                        onClick={() => handleSendTestWebhook('payment.expired')}
                        className="w-full py-1.5 px-2.5 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Send className="w-3 h-3" />
                        <span>
                          {testingWebhookEvent === 'payment.expired'
                            ? 'Sending...'
                            : 'Test Expired POST'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {webhookStatusMsg && (
                  <div
                    className={`p-3 rounded-xl border font-mono text-xs ${
                      webhookStatusMsg.type === 'ok'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {webhookStatusMsg.text}
                  </div>
                )}
              </div>

              {/* Right Column: Signing Secret & Recent Webhook Delivery Logs */}
              <div className="lg:col-span-5 space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">
                      HMAC-SHA256 Signing Secret (<code className="font-mono">X-OpenPay-Signature</code>)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(snapshot.merchant.webhook_secret, 'wh_sec')}
                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      {copiedKey === 'wh_sec' ? 'Copied!' : 'Copy Secret'}
                    </button>
                  </div>
                  <div className="font-mono text-slate-900 font-semibold break-all bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                    {snapshot.merchant.webhook_secret}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      Recent Webhook POST Deliveries ({snapshot.webhooks.length})
                    </span>
                  </div>
                  {snapshot.webhooks.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center text-slate-500">
                      No webhooks dispatched yet. Click any <strong>Test POST</strong> button on the
                      left to verify your Callback URL.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-44 overflow-y-auto bg-white">
                      {snapshot.webhooks.slice(0, 8).map((wh) => {
                        let parsedEvent = 'payment.captured';
                        try {
                          parsedEvent = JSON.parse(wh.payload).event || 'payment.captured';
                        } catch {
                          // ignore
                        }
                        return (
                          <div key={wh.id} className="p-2.5 space-y-0.5 font-mono text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900">
                                {parsedEvent} · {wh.order_id}
                              </span>
                              <span
                                className={
                                  wh.status_code >= 200 && wh.status_code < 300
                                    ? 'text-emerald-600 font-bold'
                                    : 'text-rose-600 font-bold'
                                }
                              >
                                HTTP {wh.status_code}
                              </span>
                            </div>
                            <div className="text-slate-500 truncate flex items-center justify-between">
                              <span className="truncate">{wh.target_url}</span>
                              <span className="shrink-0 ml-2">
                                {new Date(wh.delivered_at).toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ALERT RULES PANEL (100% FREE MULTI-CHANNEL NOTIFICATIONS) */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <BellRing className="w-5 h-5 text-blue-600" />
                  <h2 className="text-base font-display font-bold text-slate-900">
                    Alert Rules — 100% Free Browser Push, Chime, Gmail Script &amp; Webhook Alerts
                  </h2>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-[10px] font-bold text-emerald-700">
                    ₹0 COST · NO API KEYS NEEDED
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Define custom monetary thresholds (e.g., alert me if a single transaction exceeds{' '}
                  <span className="font-mono font-semibold text-slate-800">₹50,000</span>) using our
                  combined free channels: Browser Push + Sound Chime, Local Outbox, Free Gmail Apps
                  Script Relay, or Discord/Telegram Webhooks.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setBrowserSoundEnabled((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
                    browserSoundEnabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{browserSoundEnabled ? 'Audio Chime: ON' : 'Audio Chime: OFF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRequestBrowserPushPermission}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>
                    {browserPushPermission === 'granted'
                      ? 'Test Free Chime & Push'
                      : 'Enable Free Browser Push'}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
              {/* Left Column: Create Custom Threshold Rule Form */}
              <form
                onSubmit={handleCreateAlertRule}
                className="lg:col-span-5 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-slate-900">
                    + Create New Free Threshold Alert Rule
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                    100% Free Unlimited
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-medium">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={alertRuleName}
                    onChange={(e) => setAlertRuleName(e.target.value)}
                    placeholder="e.g. High-Value Transaction (> ₹50,000)"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-medium">Trigger Condition *</label>
                    <select
                      value={alertConditionType}
                      onChange={(e) =>
                        setAlertConditionType(e.target.value as AlertConditionType)
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                    >
                      <option value="SINGLE_TX_EXCEEDS">Single Transaction Exceeds</option>
                      <option value="DAILY_VOLUME_EXCEEDS">Daily Volume Exceeds</option>
                      <option value="EXPIRED_TX_EXCEEDS">Expired Session Exceeds</option>
                      <option value="REFUND_EXCEEDS">Refund Amount Exceeds</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-700 font-medium">
                      Threshold Amount (INR) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={alertThresholdRupees}
                      onChange={(e) => setAlertThresholdRupees(e.target.value)}
                      placeholder="50000"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
                    />
                  </div>
                </div>

                {/* Quick Threshold Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 mr-1">Quick Presets:</span>
                  {[
                    { label: '₹10,000', val: '10000', title: 'Large Order (> ₹10,000)' },
                    { label: '₹25,000', val: '25000', title: 'Mid-Tier Order (> ₹25,000)' },
                    {
                      label: '₹50,000',
                      val: '50000',
                      title: 'High-Value Transaction (> ₹50,000)',
                    },
                    {
                      label: '₹1,00,000',
                      val: '100000',
                      title: 'Enterprise Settlement (> ₹1,00,000)',
                    },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => {
                        setAlertThresholdRupees(preset.val);
                        setAlertRuleName(preset.title);
                      }}
                      className={`px-2 py-1 rounded-md font-mono text-[11px] border cursor-pointer transition-colors ${
                        alertThresholdRupees === preset.val
                          ? 'bg-blue-600 text-white border-blue-600 font-semibold'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-medium">
                    Free Notification Mode *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'BOTH', label: 'All Free Channels' },
                      { id: 'EMAIL', label: 'Email / Apps Script' },
                      { id: 'SMS', label: 'Push / Webhook' },
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setAlertChannel(ch.id as AlertChannelType)}
                        className={`py-2 px-2.5 rounded-lg border font-medium text-center cursor-pointer transition-colors ${
                          alertChannel === ch.id
                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-medium">
                      Recipient Email (or Free Apps Script URL)
                    </label>
                    <input
                      type="text"
                      value={alertRecipientEmail}
                      onChange={(e) => setAlertRecipientEmail(e.target.value)}
                      placeholder="aniketchoudhary9507@gmail.com"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-700 font-medium">
                      Phone Label or Free Discord/Telegram Webhook
                    </label>
                    <input
                      type="text"
                      value={alertRecipientPhone}
                      onChange={(e) => setAlertRecipientPhone(e.target.value)}
                      placeholder="+91 98765 43210 or https://discord.com/api/webhooks/..."
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {alertRuleFeedback && (
                  <div
                    className={`p-2.5 rounded-lg border font-mono text-[11px] ${
                      alertRuleFeedback.type === 'ok'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {alertRuleFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingAlertRule}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>{creatingAlertRule ? 'Saving Rule...' : 'Save Alert Rule'}</span>
                </button>
              </form>

              {/* Right Column: Configured Alert Rules List & Automated Dispatch Log */}
              <div className="lg:col-span-7 space-y-5">
                <div className="space-y-2.5">
                  <div className="font-display font-bold text-slate-900">
                    Configured Merchant Threshold Rules ({(snapshot.alertRules || []).length})
                  </div>

                  {!snapshot.alertRules || snapshot.alertRules.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center text-slate-500">
                      No alert rules configured yet. Use the form on the left to add a threshold
                      rule.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden bg-white">
                      {snapshot.alertRules.map((rule) => {
                        const condLabel =
                          rule.condition_type === 'SINGLE_TX_EXCEEDS'
                            ? 'Single Tx >'
                            : rule.condition_type === 'DAILY_VOLUME_EXCEEDS'
                            ? 'Daily Volume >'
                            : rule.condition_type === 'EXPIRED_TX_EXCEEDS'
                            ? 'Expired Session >'
                            : 'Refund >';

                        return (
                          <div
                            key={rule.id}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-display font-bold text-slate-900">
                                  {rule.name}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 font-mono font-bold text-blue-700">
                                  {condLabel} {formatPaiseToInr(rule.threshold_paise)}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                    rule.enabled
                                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                      : 'bg-slate-100 border border-slate-200 text-slate-500'
                                  }`}
                                >
                                  {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 font-mono">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-blue-600" />
                                  {rule.recipient_email || '—'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3 text-emerald-600" />
                                  {rule.recipient_phone || '—'}
                                </span>
                                <span>
                                  Channel: <strong>{rule.channel}</strong> · Triggered:{' '}
                                  <strong>{rule.triggered_count}x</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={testingRuleId === rule.id}
                                onClick={() => handleTestAlertRule(rule.id, rule.name)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                                title="Simulate a high-value transaction to test Email/SMS dispatch"
                              >
                                <Send className="w-3 h-3" />
                                <span>
                                  {testingRuleId === rule.id ? 'Sending...' : 'Test Alert'}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAlertRule(rule.id, !rule.enabled)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                              >
                                {rule.enabled ? 'Pause' : 'Enable'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAlertRule(rule.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Delete Alert Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Automated Email & SMS Dispatch Log */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-slate-900">
                      Recent Automated Email & SMS Alert Dispatches (
                      {(snapshot.alertDispatches || []).length})
                    </span>
                  </div>

                  {!snapshot.alertDispatches || snapshot.alertDispatches.length === 0 ? (
                    <div className="p-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 text-center text-slate-500">
                      No automated threshold alerts dispatched yet. Click{' '}
                      <strong>Test Alert</strong> on any rule above or process a transaction above
                      its threshold.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl max-h-48 overflow-y-auto bg-white">
                      {snapshot.alertDispatches.slice(0, 10).map((d) => (
                        <div key={d.id} className="p-3 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between font-mono">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  d.channel === 'EMAIL'
                                    ? 'bg-blue-50 border border-blue-200 text-blue-700'
                                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                }`}
                              >
                                {d.channel}
                              </span>
                              <span className="font-semibold text-slate-900 truncate">
                                {d.rule_name} · {formatPaiseToInr(d.amount_paise)}
                              </span>
                            </div>
                            <span className="text-slate-500 shrink-0">
                              {new Date(d.dispatched_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="text-slate-600 truncate">{d.message}</div>
                          <div className="font-mono text-[10px] text-slate-400 flex items-center justify-between">
                            <span>To: {d.recipient}</span>
                            <span className="text-emerald-600 font-semibold">{d.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={(e) => handleSaveMerchantSettings(e, false)}
              className="lg:col-span-7 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5 text-xs"
            >
              <div>
                <h2 className="text-base font-display font-bold text-slate-900">
                  Merchant Account, Receiving UPI VPA & API Keys
                </h2>
                <p className="text-xs text-slate-500">
                  Configure the bank VPA that receives 100% of customer payments directly.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-medium">Merchant Brand Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-medium">
                    Receiving UPI VPA (pa) *
                  </label>
                  <input
                    type="text"
                    value={formVpa}
                    onChange={(e) => setFormVpa(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-medium">Banking Payee Name (pn)</label>
                  <input
                    type="text"
                    value={formPayeeName}
                    onChange={(e) => setFormPayeeName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-slate-700 font-medium">Queue Isolation Mode</label>
                  <select
                    value={formQueueMode}
                    onChange={(e) =>
                      setFormQueueMode(e.target.value as 'VPA_AND_AMOUNT' | 'GLOBAL_VPA')
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900"
                  >
                    <option value="VPA_AND_AMOUNT">Per [VPA + Exact Amount] Slot</option>
                    <option value="GLOBAL_VPA">Global Single-VPA Slot</option>
                  </select>
                </div>
              </div>

              {/* API Keys Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Key ID:</span>
                  <span className="text-slate-900 font-semibold">
                    {snapshot.merchant.api_key_id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Key Secret:</span>
                  <span className="text-blue-600 font-semibold">
                    {snapshot.merchant.api_key_secret}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Webhook Secret:</span>
                  <span className="text-slate-700">{snapshot.merchant.webhook_secret}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Observer Secret:</span>
                  <span className="text-slate-700">{snapshot.merchant.observer_secret}</span>
                </div>
              </div>

              {settingsSavedMsg && (
                <p className="text-xs text-emerald-600 font-medium">{settingsSavedMsg}</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold text-xs cursor-pointer"
                >
                  {savingSettings ? 'Saving...' : 'Save Configuration'}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveMerchantSettings(e, true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs cursor-pointer"
                >
                  Rotate Secrets
                </button>
              </div>
            </form>

            {/* Android Observer Pairing QR */}
            <div className="lg:col-span-5 p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h3 className="text-base font-display font-bold text-slate-900">
                  Android Bank Observer Pairing QR
                </h3>
                <p className="text-xs text-slate-500">
                  Scan this QR from the companion Android app (`/android-observer/YoupiObserverApp.kt`)
                  to auto-verify incoming bank SMS and UPI notifications.
                </p>
              </div>

              <div className="flex flex-col items-center p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                {pairingData?.qrSvg ? (
                  <div
                    className="w-44 h-44 p-2.5 bg-white rounded-xl border border-slate-200 [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: pairingData.qrSvg }}
                  />
                ) : (
                  <div className="w-44 h-44 rounded-xl bg-slate-100 animate-pulse" />
                )}
                <div className="w-full text-[11px] font-mono text-slate-600 truncate text-center">
                  POST {pairingData?.endpoint}
                </div>
              </div>
            </div>
          </div>

          {/* Complete Copy-Paste Integration Reference */}
          <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-6">
            <div>
              <h2 className="text-base font-display font-bold text-slate-900">
                How to Integrate OpenPay — By Aniket Anywhere (HTML, React/Next.js, Node.js/Python)
              </h2>
              <p className="text-xs text-slate-500">
                Embed zero-fee UPI checkout on any external domain or backend using the snippets
                below.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    1. Frontend JavaScript SDK (React, Next.js, Vue, HTML)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(jsProgrammaticSnippet, 'js_sdk')}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    {copiedKey === 'js_sdk' ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                  <code>{jsProgrammaticSnippet}</code>
                </pre>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    2. Server-to-Server Orders & Signature Verification API
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(backendOrderSnippet, 'backend_api')}
                    className="text-blue-600 hover:underline font-medium cursor-pointer"
                  >
                    {copiedKey === 'backend_api' ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto leading-relaxed">
                  <code>{backendOrderSnippet}</code>
                </pre>
              </div>
            </div>

            {/* Universal End-to-End Integration Architecture */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-display font-bold text-slate-900">
                    3. End-to-End Payment Verification Flow (E-Commerce, SaaS, Mobile & Web Apps)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Standard 4-step workflow to accept payments in any application and verify authenticity using HMAC-SHA256 signatures. Full copy-paste examples are included in <code className="font-mono text-slate-800">README.md</code>.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-blue-600">01. Create Order</div>
                  <div className="font-semibold text-slate-900">POST /api/v1/orders</div>
                  <p className="text-slate-600">
                    Your backend sends the order amount in integer paise (e.g. <code className="font-mono">49900</code> for ₹499.00) and receives <code className="font-mono">checkout_session_id</code>.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-blue-600">02. Open Modal</div>
                  <div className="font-semibold text-slate-900">YoupiPG.open()</div>
                  <p className="text-slate-600">
                    Your frontend opens the modal with <code className="font-mono">sessionId</code>. Customer scans the vector QR or taps GPay/PhonePe/Paytm.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-blue-600">03. Verify Signature</div>
                  <div className="font-semibold text-slate-900">POST /api/v1/payments/verify</div>
                  <p className="text-slate-600">
                    Verify <code className="font-mono">HMAC-SHA256(orderId + &quot;|&quot; + sessionId, secret)</code> on your backend before fulfilling the order.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="font-mono font-bold text-blue-600">04. Webhook Backup</div>
                  <div className="font-semibold text-slate-900">X-Youpi-Signature</div>
                  <p className="text-slate-600">
                    Even if the customer closes their browser tab, YouPI-PG POSTs <code className="font-mono">payment.captured</code> to your webhook URL.
                  </p>
                </div>
              </div>
            </div>
          </div>
            </div>
          )}

          {/* SUB-TAB B: 100% FREE FOREVER PLAN & UNLIMITED USAGE STATS */}
          {settingsSection === 'billing' && (() => {
            const sub = snapshot.subscription || {
              merchant_id: snapshot.merchant.id,
              plan_id: 'OPENPAY_FREE_FOREVER' as SubscriptionPlanId,
              plan_name: 'OpenPay 100% Free Forever (Unlimited Suite)',
              billing_cycle: 'FOREVER_FREE' as BillingCycle,
              price_paise: 0,
              status: 'ACTIVE' as const,
              sms_quota_monthly: 999999,
              sms_used_this_month: 12,
              email_quota_monthly: 999999,
              email_used_this_month: 48,
              webhook_quota_monthly: 999999,
              webhook_used_this_month: 124,
              alert_rules_limit: 999,
              auto_topup_enabled: true,
              current_period_start: Date.now() - 1000 * 60 * 60 * 24 * 15,
              current_period_end: Date.now() + 1000 * 60 * 60 * 24 * 15,
              updated_at: Date.now(),
            };

            const activeRulesCount = (snapshot.alertRules || []).length;

            const freeIncludedSuites = [
              {
                title: 'Direct-to-Bank 0% MDR UPI Core',
                badge: 'UNLOCKED FREE FOREVER',
                costLabel: '₹0 / Forever',
                description:
                  '100% of every customer payment settles directly into your bank VPA with zero gateway commission and zero platform fees.',
                metrics: [
                  'Unlimited Dynamic UPI QR & Intent Sessions',
                  'Unlimited Shareable Payment Links (/pay/:code)',
                  'Atomic FIFO Queue & Amount Slot Isolation',
                  '1-Click UPI Refund Deep-Links & CSV Export',
                ],
              },
              {
                title: 'Free Bank Email & SMS Auto-Verification',
                badge: 'ZERO PAID APIs',
                costLabel: '₹0 / Forever',
                description:
                  'Uses your own free Gmail Google Apps Script and Free Android SMS Forwarder app to parse 12-digit UTRs automatically.',
                metrics: [
                  'Unlimited HDFC, ICICI, SBI, Axis & Kotak UTR Parsing',
                  '1-Minute Free Gmail Apps Script Auto-Forwarder',
                  'Free Android SMS Forwarder & Companion App',
                  'SHA-256 Deduplicated Bank Observation Ledger',
                ],
              },
              {
                title: 'Combined Free Alert & Backup Suite',
                badge: 'UNLIMITED QUOTA',
                costLabel: '₹0 / Forever',
                description:
                  'Replaces paid SMS/Email APIs (Twilio, MSG91, Resend) with instant free Browser Push, Sound Chimes, Discord/Telegram Webhooks, and Gmail Script relay.',
                metrics: [
                  'Unlimited Browser Push & Web Audio Chime Alerts',
                  'Free Gmail Apps Script Outbound Email Relay',
                  'Free Discord, Telegram & Custom Webhook Alerts',
                  'Unlimited SQLite WAL Snapshots & JSON Restores',
                ],
              },
            ];

            return (
              <div className="space-y-6">
                {/* 100% Free Forever Banner */}
                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-base font-display font-bold text-slate-900">
                          OpenPay 100% Free-Forever License — Zero Paid APIs &amp; Unlimited Quotas
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-bold text-emerald-700">
                          ₹0 / FOREVER · ALL FEATURES UNLOCKED
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Every feature in OpenPay is <strong>100% free forever</strong> with zero
                        paid third-party APIs to exhaust your account. Alerts, bank UTR
                        auto-verification, webhooks, and backups run with unlimited quotas.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={toppingUpSms}
                        onClick={() => handleTopupSmsCredits()}
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-display font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>
                          {toppingUpSms ? 'Resetting Counters...' : 'Reset Monthly Usage Counters'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {billingFeedback && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 flex items-center justify-between">
                      <span>{billingFeedback}</span>
                      <button
                        type="button"
                        onClick={() => setBillingFeedback(null)}
                        className="text-emerald-700 hover:underline text-[11px] cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}

                  {/* Real-Time Monthly Activity Telemetry (All Unlimited & ₹0 Cost) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Free Push & Webhook Alerts Dispatched */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                          <span>Push &amp; Webhook Alerts</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">
                          UNLIMITED
                        </span>
                      </div>
                      <div className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                        {sub.sms_used_this_month.toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-slate-500">dispatched</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ₹0 Browser Push + Chime + Webhook
                      </div>
                    </div>

                    {/* Free Email & Gmail Apps Script Alerts */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Free Email &amp; Outbox Alerts</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">
                          UNLIMITED
                        </span>
                      </div>
                      <div className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                        {sub.email_used_this_month.toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-slate-500">dispatched</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ₹0 Local Outbox + Free Gmail Script
                      </div>
                    </div>

                    {/* Signed Webhook Callbacks */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <Webhook className="w-3.5 h-3.5 text-blue-600" />
                          <span>Signed Webhook Callbacks</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">
                          UNLIMITED
                        </span>
                      </div>
                      <div className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                        {sub.webhook_used_this_month.toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal text-slate-500">delivered</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        ₹0 HMAC-SHA256 POST callbacks
                      </div>
                    </div>

                    {/* Active Alert Rules */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                          <BellRing className="w-3.5 h-3.5 text-amber-600" />
                          <span>Active Threshold Rules</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-emerald-700">
                          UNLIMITED
                        </span>
                      </div>
                      <div className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                        {activeRulesCount}{' '}
                        <span className="text-xs font-normal text-slate-500">active rules</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Zero cap on custom alert rules
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3 Unlocked Free-Forever Architecture Suites */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {freeIncludedSuites.map((suite) => (
                    <div
                      key={suite.title}
                      className="p-6 rounded-xl bg-white border border-emerald-200 shadow-2xs flex flex-col justify-between space-y-5 text-xs"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-base font-display font-bold text-slate-900">
                            {suite.title}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono text-[10px] font-bold text-emerald-700 shrink-0">
                            {suite.badge}
                          </span>
                        </div>

                        <div>
                          <div className="text-2xl font-mono font-bold text-slate-900 tabular-nums">
                            {suite.costLabel}
                          </div>
                          <p className="text-slate-500 mt-1 leading-relaxed">
                            {suite.description}
                          </p>
                        </div>

                        <ul className="space-y-2 text-slate-700 pt-2 border-t border-slate-100">
                          {suite.metrics.map((feat) => (
                            <li key={feat} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-display font-semibold text-xs text-center">
                        Active &amp; Unlocked Forever (₹0)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* SUB-TAB C: AUDIT LOGS (CHRONOLOGICAL, READ-ONLY SECURITY & ACCOUNT ACTIVITY FEED) */}
          {settingsSection === 'audit' && (() => {
            const allLogs = snapshot.auditLogs || [];
            const filteredLogs = allLogs.filter((entry) => {
              if (auditCategoryFilter !== 'ALL' && entry.category !== auditCategoryFilter) {
                return false;
              }
              const q = auditSearchQuery.trim().toLowerCase();
              if (!q) return true;
              return (
                entry.action.toLowerCase().includes(q) ||
                entry.description.toLowerCase().includes(q) ||
                entry.actor_email.toLowerCase().includes(q) ||
                entry.actor_name.toLowerCase().includes(q) ||
                entry.ip_address.toLowerCase().includes(q)
              );
            });

            return (
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h2 className="text-base font-display font-bold text-slate-900">
                        Audit Logs — Immutable Account & Security Activity Feed
                      </h2>
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono font-semibold text-slate-600">
                        READ-ONLY
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Chronological, tamper-evident feed of merchant logins, API key generations &
                      rotations, webhook configuration updates, alert rule changes, and billing
                      events.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={(e) => handleSaveMerchantSettings(e, true)}
                      disabled={savingSettings}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-display font-semibold flex items-center gap-1.5 cursor-pointer"
                      title="Rotate API Keys & Webhook Secret and log event immediately"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>Rotate API Keys & Log Event</span>
                    </button>
                  </div>
                </div>

                {/* Filter & Search Bar for Audit Logs */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
                  <div className="md:col-span-6 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={auditSearchQuery}
                      onChange={(e) => setAuditSearchQuery(e.target.value)}
                      placeholder="Search audit trail by action, description, actor email, or IP..."
                      className="w-full pl-8 pr-8 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                    {auditSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAuditSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="md:col-span-6 flex flex-wrap items-center gap-1.5 justify-end">
                    {[
                      { id: 'ALL', label: 'All Events' },
                      { id: 'AUTH', label: 'Logins & Auth' },
                      { id: 'API_KEYS', label: 'API Keys' },
                      { id: 'WEBHOOK', label: 'Webhooks' },
                      { id: 'ALERT_RULES', label: 'Alert Rules' },
                      { id: 'BILLING', label: 'Billing' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setAuditCategoryFilter(cat.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                          auditCategoryFilter === cat.id
                            ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chronological Read-Only Audit Table */}
                {filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                    No audit log entries match the selected filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                          <th className="py-3 px-4 font-medium">Timestamp</th>
                          <th className="py-3 px-4 font-medium">Category</th>
                          <th className="py-3 px-4 font-medium">Event Action</th>
                          <th className="py-3 px-4 font-medium">Activity Details</th>
                          <th className="py-3 px-4 font-medium">Actor</th>
                          <th className="py-3 px-4 font-medium text-right">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredLogs.map((log) => {
                          const catBadge =
                            log.category === 'API_KEYS'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : log.category === 'WEBHOOK'
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : log.category === 'AUTH' || log.category === 'SECURITY'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : log.category === 'BILLING'
                              ? 'bg-purple-50 border-purple-200 text-purple-700'
                              : 'bg-slate-100 border-slate-200 text-slate-700';

                          return (
                            <tr key={log.id} className="hover:bg-slate-50/80 text-slate-700">
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{new Date(log.created_at).toLocaleString()}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold ${catBadge}`}
                                >
                                  {log.category}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {log.action}
                              </td>
                              <td className="py-3 px-4 text-slate-700 max-w-md">
                                <div>{log.description}</div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <div className="font-medium text-slate-900">{log.actor_name}</div>
                                <div className="font-mono text-[10px] text-slate-500">
                                  {log.actor_email}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {log.ip_address}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* SUB-TAB D: LIVE BANK EMAIL/SMS FORWARDER & CLOUD DATABASE BACKUPS */}
          {settingsSection === 'infrastructure' && (() => {
            const forwarderUrl = `${baseUrl}/api/webhooks/bank-forwarder/${snapshot.merchant.id}?secret=${snapshot.merchant.observer_secret}`;
            const androidSmsForwarderJson = JSON.stringify(
              {
                url: forwarderUrl,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Observer-Secret': snapshot.merchant.observer_secret,
                },
                body: {
                  rawPayload: '%sms_body%',
                  sender: '%sms_from%',
                  sourceChannel: 'ANDROID_SMS',
                },
              },
              null,
              2
            );

            const gmailAppsScriptSnippet = `// 100% FREE All-in-One Google Apps Script for OpenPay (https://script.google.com):
// 1) Runs every 1 minute to auto-forward Bank UPI Credit Emails (HDFC, ICICI, SBI, Axis, Kotak) to OpenPay
// 2) Deploy as Web App ("Execute as: Me", "Who has access: Anyone") -> Copy the single Web App URL and paste it
//    into BOTH FREE_ALERT_WEBHOOK_URL and EXTERNAL_BACKUP_WEBHOOK_URL!
function forwardBankAlertsToOpenPay() {
  var threads = GmailApp.search('is:unread ("credited" OR "UPI Ref" OR "UTR") newer_than:1d', 0, 10);
  var endpoint = "${forwarderUrl}";
  for (var i = 0; i < threads.length; i++) {
    var messages = threads[i].getMessages();
    for (var j = 0; j < messages.length; j++) {
      var msg = messages[j];
      if (!msg.isUnread()) continue;
      UrlFetchApp.fetch(endpoint, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          rawPayload: msg.getSubject() + " " + msg.getPlainBody(),
          sourceChannel: "GMAIL"
        }),
        muteHttpExceptions: true
      });
      msg.markRead();
    }
  }
}

// Handles BOTH FREE_ALERT_WEBHOOK_URL (Free Gmail Alerts) AND EXTERNAL_BACKUP_WEBHOOK_URL (Free Google Drive Backups)
function doPost(e) {
  var data = JSON.parse(e.postData.contents || "{}");
  // 1) If this is a Database Backup Checkpoint, save cleanly to Google Drive (do NOT email raw JSON)
  if (data.event === "database.checkpoint_created" || data.checkpointId) {
    var fileName = "openpay-backup-" + (data.checkpointId || new Date().getTime()) + ".json";
    DriveApp.createFile(fileName, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, savedToDrive: fileName })).setMimeType(ContentService.MimeType.JSON);
  }
  // 2) Otherwise, send a clean, professional formatted payment alert email
  var cleanBody = data.message || data.content || (
    "OpenPay — By Aniket | Payment Alert\\n" +
    "----------------------------------------\\n" +
    "Amount   : " + (data.amountFormatted || "N/A") + "\\n" +
    "Order ID : " + (data.orderId || "N/A") + "\\n" +
    "Status   : " + (data.status || "VERIFIED") + "\\n" +
    "UTR      : " + (data.utr || "N/A")
  );
  GmailApp.sendEmail(
    data.to || "${snapshot.merchant.support_email || 'aniketchoudhary9507@gmail.com'}",
    data.subject || "OpenPay Payment Alert",
    cleanBody
  );
  return ContentService.createTextOutput(JSON.stringify({ ok: true, sentEmail: true })).setMimeType(ContentService.MimeType.JSON);
}`;

            const checkpoints = snapshot.backups || [];

            return (
              <div className="space-y-6">
                {/* 1. 100% Free Production Infrastructure Telemetry Strip */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-medium flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-blue-600" />
                        <span>Free Bank SMS &amp; Gmail Bridge</span>
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">₹0 FREE</span>
                    </div>
                    <div className="font-display font-bold text-sm text-slate-900">
                      Gmail Apps Script + Android SMS
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Zero paid APIs — auto-verifies 12-digit UTRs directly from your inbox or phone
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-medium flex items-center gap-1.5">
                        <BellRing className="w-3.5 h-3.5 text-amber-600" />
                        <span>Combined Free Alert Suite</span>
                      </span>
                      <span className="font-mono font-semibold text-emerald-700">
                        100% FREE ACTIVE
                      </span>
                    </div>
                    <div className="font-display font-bold text-sm text-slate-900">
                      Browser Push + Chime + Free Webhook
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Instant desktop/phone notifications, Local Outbox, Discord/Telegram &amp; Gmail
                      Script relay
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-medium flex items-center gap-1.5">
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        <span>SQLite WAL + Free Checkpoints</span>
                      </span>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                        {checkpoints.length} SAVED
                      </span>
                    </div>
                    <div className="font-display font-bold text-sm text-slate-900">
                      SHA-256 Verified Snapshots
                    </div>
                    <div className="text-[11px] text-slate-500">
                      1-click JSON snapshot restore &amp; hot SQLite binary download at ₹0 cost
                    </div>
                  </div>
                </div>

                {/* 2. Live Bank Email & Android SMS Auto-Forwarder Setup & Test Console */}
                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5 text-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-blue-600" />
                        <h2 className="text-base font-display font-bold text-slate-900">
                          Live Bank Email &amp; Android SMS Auto-Forwarder Bridge
                        </h2>
                      </div>
                      <p className="text-slate-500">
                        Connect your Android phone&apos;s SMS Forwarder app or your Gmail inbox so
                        real bank credit alerts (HDFC, ICICI, SBI, Axis, Kotak) automatically parse
                        the 12-digit UTR and verify active checkout sessions in real time.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(forwarderUrl, 'forwarder_url')}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-display font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {copiedKey === 'forwarder_url' ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied Forwarder URL</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Inbound Webhook URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Dedicated Endpoint Box */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-600">
                      Your Dedicated Bank Alert Auto-Forwarder Webhook Endpoint (POST):
                    </div>
                    <div className="font-mono text-xs text-slate-900 break-all select-all">
                      {forwarderUrl}
                    </div>
                  </div>

                  {/* Interactive Multi-Bank Forwarder Live Tester */}
                  <form
                    onSubmit={handleTestLiveBankForwarder}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-display font-bold text-slate-900">
                          Test Live Bank Alert Forwarder Ingestion
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Sends a real POST request to your forwarder endpoint above. If an order for
                          this exact INR amount is currently ACTIVE or PROCESSING, it will be
                          verified immediately.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      <div className="md:col-span-4 space-y-1">
                        <label className="block font-medium text-slate-700">
                          Bank Alert Format Preset
                        </label>
                        <select
                          value={forwarderBankPreset}
                          onChange={(e) =>
                            setForwarderBankPreset(
                              e.target.value as
                                | 'HDFC'
                                | 'ICICI'
                                | 'SBI'
                                | 'AXIS'
                                | 'KOTAK'
                                | 'CUSTOM'
                            )
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                          <option value="HDFC">HDFC Bank Credit SMS / Email</option>
                          <option value="ICICI">ICICI Bank UPI Credit Alert</option>
                          <option value="SBI">State Bank of India (SBI) Credit</option>
                          <option value="AXIS">Axis Bank P2A UPI Credit</option>
                          <option value="KOTAK">Kotak Mahindra Bank UPI Alert</option>
                          <option value="CUSTOM">Custom Raw Bank SMS / Email Text</option>
                        </select>
                      </div>

                      <div className="md:col-span-3 space-y-1">
                        <label className="block font-medium text-slate-700">
                          Credit Amount (INR)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          value={forwarderAmountRupees}
                          onChange={(e) => setForwarderAmountRupees(e.target.value)}
                          placeholder="499.00"
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-slate-900 focus:outline-none focus:border-blue-600 tabular-nums"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <label className="block font-medium text-slate-700">Source Channel</label>
                        <select
                          value={forwarderChannel}
                          onChange={(e) =>
                            setForwarderChannel(e.target.value as 'ANDROID_SMS' | 'GMAIL')
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-blue-600 cursor-pointer"
                        >
                          <option value="ANDROID_SMS">ANDROID_SMS</option>
                          <option value="GMAIL">GMAIL</option>
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <button
                          type="submit"
                          disabled={testingForwarder}
                          className="w-full py-2 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-display font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>
                            {testingForwarder
                              ? 'Dispatching Alert...'
                              : 'Fire Live Forwarder Webhook'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {forwarderBankPreset === 'CUSTOM' && (
                      <div className="pt-1">
                        <input
                          type="text"
                          value={forwarderCustomText}
                          onChange={(e) => setForwarderCustomText(e.target.value)}
                          placeholder="Paste raw bank SMS or email text containing Rs./INR amount and 12-digit UTR..."
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    )}

                    {forwarderFeedback && (
                      <div
                        className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                          forwarderFeedback.type === 'ok'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}
                      >
                        <span className="font-medium">{forwarderFeedback.text}</span>
                        <button
                          type="button"
                          onClick={() => setForwarderFeedback(null)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </form>

                  {/* Copyable Setup Snippets for Android SMS Forwarder & Gmail Auto-Forwarder */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-slate-900">
                          Option A: Android SMS Forwarder / MacroDroid Config
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(androidSmsForwarderJson, 'android_forwarder_json')
                          }
                          className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-medium text-slate-700 cursor-pointer flex items-center gap-1"
                        >
                          {copiedKey === 'android_forwarder_json' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48">
                        {androidSmsForwarderJson}
                      </pre>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-display font-bold text-slate-900">
                          Option B: Gmail Auto-Forwarder (Google Apps Script)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(gmailAppsScriptSnippet, 'gmail_script')}
                          className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-medium text-slate-700 cursor-pointer flex items-center gap-1"
                        >
                          {copiedKey === 'gmail_script' ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy Script</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto max-h-48">
                        {gmailAppsScriptSnippet}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* 3. Cloud Database Backup Checkpoints, SQLite Binary Export & 1-Click Restore */}
                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-5 text-xs">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-base font-display font-bold text-slate-900">
                          Database Backup Checkpoints, SQLite Export &amp; 1-Click Restore
                        </h2>
                      </div>
                      <p className="text-slate-500">
                        Create SHA-256 verified snapshots of all orders, UTRs, payment links, alert
                        rules, and merchant settings. Download portable JSON or raw SQLite{' '}
                        <code className="font-mono">.sqlite</code> backups and restore anytime.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleCreateBackupCheckpoint}
                        disabled={creatingCheckpoint}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-display font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {creatingCheckpoint ? 'Creating Checkpoint...' : 'Create Checkpoint Now'}
                        </span>
                      </button>

                      <a
                        href="/api/admin/backups/export-json"
                        download
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Download JSON Backup</span>
                      </a>

                      <a
                        href="/api/admin/backups/download-sqlite"
                        download
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Database className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Download SQLite (.sqlite)</span>
                      </a>

                      <label className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {restoringCheckpointId === 'upload_json'
                            ? 'Restoring...'
                            : 'Restore from JSON File'}
                        </span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          onChange={handleUploadRestoreJson}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {backupFeedback && (
                    <div
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        backupFeedback.type === 'ok'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{backupFeedback.text}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setBackupFeedback(null)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {checkpoints.length === 0 ? (
                    <div className="py-10 text-center text-slate-500 border border-dashed border-slate-200 rounded-xl">
                      No backup checkpoints saved yet. Click &ldquo;Create Checkpoint Now&rdquo; to
                      create a snapshot.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                            <th className="py-3 px-4 font-medium">Created Timestamp</th>
                            <th className="py-3 px-4 font-medium">Checkpoint File</th>
                            <th className="py-3 px-4 font-medium">Records Included</th>
                            <th className="py-3 px-4 font-medium">SHA-256 Checksum</th>
                            <th className="py-3 px-4 font-medium text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {checkpoints.map((chk) => (
                            <tr key={chk.id} className="hover:bg-slate-50/80 text-slate-700">
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                                {new Date(chk.created_at).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {chk.filename}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap tabular-nums">
                                {chk.sessions_count} sessions · {chk.payment_links_count} links ·{' '}
                                {chk.alert_rules_count} rules (
                                {(chk.size_bytes / 1024).toFixed(1)} KB)
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {chk.checksum_sha256
                                  ? `${chk.checksum_sha256.slice(0, 16)}...`
                                  : '—'}
                              </td>
                              <td className="py-3 px-4 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={restoringCheckpointId === chk.id}
                                  onClick={() => handleRestoreCheckpoint(chk.id, chk.filename)}
                                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <RefreshCw className="w-3 h-3 text-blue-600" />
                                  <span>
                                    {restoringCheckpointId === chk.id
                                      ? 'Restoring...'
                                      : 'Restore Snapshot'}
                                  </span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 6: MERCHANT PROFILE, KYC & SECURITY */}
      {activeSubTab === 'profile' && (
        <ProfileView
          user={currentUser || snapshot.user || null}
          merchant={snapshot.merchant}
          authToken={authToken}
          onProfileUpdated={(updatedUser) => {
            onProfileUpdated(updatedUser);
            onRefresh();
          }}
          onSignOut={onSignOut}
        />
      )}
    </div>
  );
};

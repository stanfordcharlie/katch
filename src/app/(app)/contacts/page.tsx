'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SIGNAL_LABELS } from '@/lib/katch-constants';

type Contact = {
  id: string;
  user_id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  event: string | null;
  image?: string | null;
  free_note?: string | null;
  freeNote?: string | null;
  lead_score?: number | null;
  leadScore?: number | null;
  checks?: string[] | null;
  enriched?: boolean | null;
  created_at?: string | null;
  date?: string | null;
  synced_to_hubspot?: boolean | null;
  hubspot_synced_at?: string | null;
  ai_enrichment?: Record<string, unknown> | null;
  enriched_at?: string | null;
  source?: string | null;
  status?: string | null;
  sequences?: {
    generatedAt?: string;
    cadence?: { day: number; tone: string }[];
    emails: { day: number; subject: string; body: string }[];
    context?: string;
  } | null;
};

type EditForm = {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
  event: string;
  free_note: string;
  lead_score: number;
  checks: string[];
};

const scoreAccent = (score: number | null | undefined): 'high' | 'mid' | 'low' => {
  const s = score == null || Number.isNaN(Number(score)) ? 0 : Number(score);
  if (s >= 7) return 'high';
  if (s >= 4) return 'mid';
  return 'low';
};

/** Desktop contacts table: shared flex/minWidth per column (header + body). */
const CONTACTS_DESKTOP_COL_STYLE: CSSProperties[] = [
  { minWidth: 40, width: 40, flexGrow: 0, flexShrink: 0, flexBasis: 40, boxSizing: 'border-box' },
  { minWidth: 160, flexGrow: 2, flexShrink: 1, flexBasis: 0, boxSizing: 'border-box' },
  { minWidth: 130, flexGrow: 1.5, flexShrink: 1, flexBasis: 0, boxSizing: 'border-box' },
  { minWidth: 130, flexGrow: 1.5, flexShrink: 1, flexBasis: 0, boxSizing: 'border-box' },
  { minWidth: 160, flexGrow: 2, flexShrink: 1, flexBasis: 0, boxSizing: 'border-box' },
  { minWidth: 90, flexGrow: 1, flexShrink: 1, flexBasis: 0, boxSizing: 'border-box' },
  { minWidth: 60, flexGrow: 0, flexShrink: 0, flexBasis: 60, boxSizing: 'border-box' },
  { minWidth: 90, flexGrow: 0, flexShrink: 0, flexBasis: 90, boxSizing: 'border-box' },
  { minWidth: 100, flexGrow: 0, flexShrink: 0, flexBasis: 100, boxSizing: 'border-box' },
  { minWidth: 50, flexGrow: 0, flexShrink: 0, flexBasis: 50, boxSizing: 'border-box' },
];

const normalizeText = (v: string | null | undefined) => (v ?? '').toLowerCase().trim();

const levenshteinDistance = (a: string, b: string) => {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  const dp: number[][] = Array.from({ length: aa.length + 1 }, () => Array(bb.length + 1).fill(0));
  for (let i = 0; i <= aa.length; i++) dp[i][0] = i;
  for (let j = 0; j <= bb.length; j++) dp[0][j] = j;
  for (let i = 1; i <= aa.length; i++) {
    for (let j = 1; j <= bb.length; j++) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[aa.length][bb.length];
};

const areSimilarNames = (a: string, b: string) => {
  const normalize = (str: string) => str.toLowerCase().trim();
  if (normalize(a) === normalize(b)) return true;
  const aWords = normalize(a).split(' ').filter(Boolean);
  const bWords = normalize(b).split(' ').filter(Boolean);
  if (!aWords.length || !bWords.length) return false;
  if (aWords[0] === bWords[0] && aWords[aWords.length - 1] === bWords[bWords.length - 1]) {
    return true;
  }
  return levenshteinDistance(a, b) <= 1;
};

const findDuplicateGroups = (list: Contact[]): Contact[][] => {
  if (list.length < 2) return [];

  const parent = list.map((_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r];
    let c = x;
    while (parent[c] !== c) {
      const n = parent[c];
      parent[c] = r;
      c = n;
    }
    return r;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const emailMatch =
        normalizeText(a.email) !== '' &&
        normalizeText(b.email) !== '' &&
        normalizeText(a.email) === normalizeText(b.email);
      const nameMatch =
        normalizeText(a.name) !== '' &&
        normalizeText(b.name) !== '' &&
        areSimilarNames(a.name ?? '', b.name ?? '');
      const sameNameAndCompany =
        normalizeText(a.name) !== '' &&
        normalizeText(a.company) !== '' &&
        normalizeText(a.name) === normalizeText(b.name) &&
        normalizeText(a.company) === normalizeText(b.company);

      if (emailMatch || nameMatch || sameNameAndCompany) {
        union(i, j);
      }
    }
  }

  const buckets: Record<string, Contact[]> = {};
  list.forEach((c, i) => {
    const r = String(find(i));
    if (!buckets[r]) buckets[r] = [];
    buckets[r].push(c);
  });

  return Object.values(buckets).filter((g) => g.length >= 2);
};

function ContactSourceCell({ contact }: { contact: Contact }) {
  const src = contact.source;

  if (src === 'scan' || src == null) {
    return (
      <span
        style={{
          background: '#f0f7eb',
          color: '#2d6a1f',
          border: '1px solid #c8e6c0',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        Badge Scan
      </span>
    );
  }

  if (src === 'lead_list') {
    return (
      <span
        style={{
          background: '#f0f4ff',
          color: '#4a6fa5',
          border: '1px solid #c5d3f0',
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        Lead List
      </span>
    );
  }

  return (
    <span
      style={{
        background: '#f5f5f5',
        color: '#666',
        border: '1px solid #e0e0e0',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {String(src)}
    </span>
  );
}

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const eventFromUrl = searchParams.get('event');

  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'az' | 'za' | 'highest' | 'lowest'
  >('newest');

  const [selected, setSelected] = useState<Contact | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error' | 'warning'>('success');

  const [signalLabels, setSignalLabels] = useState<string[]>(DEFAULT_SIGNAL_LABELS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [eventsMap, setEventsMap] = useState<Record<string, string>>({});
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [isDeleteAllWarning, setIsDeleteAllWarning] = useState(false);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<Contact[][]>([]);
  const [showDuplicateBanner, setShowDuplicateBanner] = useState(true);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateGroupIndex, setDuplicateGroupIndex] = useState(0);
  const [reEnrichingId, setReEnrichingId] = useState<string | null>(null);
  const [reEnrichErrorForId, setReEnrichErrorForId] = useState<string | null>(null);

  type SeqTone = 'professional' | 'friendly' | 'direct';
  type SeqCadenceStep = { day: number; tone: SeqTone };
  const [sequenceDrawerContact, setSequenceDrawerContact] = useState<Contact | null>(null);
  const [sequenceCadence, setSequenceCadence] = useState<SeqCadenceStep[]>([
    { day: 1, tone: 'professional' },
    { day: 4, tone: 'professional' },
    { day: 14, tone: 'professional' },
  ]);
  const [sequenceContext, setSequenceContext] = useState('');
  const [sequenceLoading, setSequenceLoading] = useState(false);
  const [sequenceEmails, setSequenceEmails] = useState<{ day: number; subject: string; body: string }[] | null>(
    null
  );
  const [sequenceSaving, setSequenceSaving] = useState(false);
  const [sequenceDrawerExpanded, setSequenceDrawerExpanded] = useState<Record<number, boolean>>({});
  const [sequenceDrawerEditIdx, setSequenceDrawerEditIdx] = useState<number | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!user?.id) return;
    const [{ data, error }, { data: eventsData }] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('events').select('id, name').eq('user_id', user.id),
    ]);

    if (error) {
      console.error('Contacts fetch error:', error);
      return;
    }

    const nextContacts = (((data as unknown) as Contact[]) || []);
    setContacts(nextContacts);
    setDuplicateGroups(findDuplicateGroups(nextContacts));
    setShowDuplicateBanner(true);
    setEvents(eventsData || []);
    const map: Record<string, string> = {};
    ((eventsData as Array<{ id: string; name: string }>) || []).forEach((e) => {
      map[e.id] = e.name;
    });
    setEventsMap(map);
  }, [user?.id]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (eventFromUrl) setFilterEvent(eventFromUrl);
  }, [eventFromUrl]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user as User);
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const run = async () => {
      setLoading(true);
      await fetchContacts();
      setLoading(false);
    };

    void run();
  }, [user?.id, fetchContacts]);

  useEffect(() => {
    if (!user?.id) return;

    const loadSignals = async () => {
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('signals')
          .eq('user_id', user.id)
          .single();

        if (data?.signals && Array.isArray(data.signals)) {
          const enabled = (data.signals as any[])
            .filter((s) => s && s.enabled !== false)
            .map((s) => (typeof s.name === 'string' ? s.name : ''))
            .filter((v) => !!v);

          if (enabled.length) {
            setSignalLabels(enabled);
          }
        }
      } catch (err) {
        console.error('user_settings fetch error:', err);
      }
    };

    loadSignals();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        supabase
          .from('contacts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.error('Contacts refresh error:', error);
              return;
            }
            const nextContacts = (((data as unknown) as Contact[]) || []);
    setContacts(nextContacts);
    setDuplicateGroups(findDuplicateGroups(nextContacts));
    setShowDuplicateBanner(true);
          });
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user?.id]);

  const showToast = (msg: string, variant: 'success' | 'error' | 'warning' = 'success') => {
    setToast(msg);
    setToastVariant(variant);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
      setToastVariant('success');
    }, 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const getEventName = (eventId: string | null | undefined) => {
    if (!eventId) return null;
    return eventsMap[eventId] || null;
  };

  const formatHubSpotSyncedAt = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${datePart} at ${timePart}`;
  };

  const formatEnrichedAgo = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 45) return 'just now';
    if (min < 60) return `${min} min ago`;
    if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
    if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const syncSingleContact = async (contactId: string) => {
    setIsSyncing(contactId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: [contactId], userId: user?.id }),
      });
      const data = await res.json();
      if (res.status === 401) {
        showToast('HubSpot not connected. Go to Settings → Integrations.', 'error');
        return;
      }
      if (data.succeeded > 0) {
        showToast('Synced to HubSpot!', 'success');
        await fetchContacts();
      } else {
        showToast(`Sync failed: ${data.results?.[0]?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast('Sync failed. Please try again.', 'error');
    } finally {
      setIsSyncing(null);
    }
  };

  const handleReEnrich = async (contact: Contact) => {
    if (!user?.id) return;
    setReEnrichingId(contact.id);
    setReEnrichErrorForId((prev) => (prev === contact.id ? null : prev));
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: contact.id, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error || data.enrichment == null) throw new Error('enrich failed');
      const result = data.enrichment as Record<string, unknown>;
      const at = new Date().toISOString();
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id
            ? { ...c, ai_enrichment: result, enriched: true, enriched_at: at }
            : c
        )
      );
      setSelected((sel) =>
        sel?.id === contact.id
          ? { ...sel, ai_enrichment: result, enriched: true, enriched_at: at }
          : sel
      );
    } catch {
      setReEnrichErrorForId(contact.id);
    } finally {
      setReEnrichingId(null);
    }
  };

  const syncToHubSpot = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkSyncing(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const res = await fetch('/api/hubspot/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: selectedIds, userId: user.id }),
      });

      if (res.status === 401) {
        showToast('HubSpot not connected. Go to Settings → Integrations to connect.', 'error');
        return;
      }

      if (res.status === 400) {
        showToast('No contacts selected to sync.', 'error');
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        showToast(`Sync failed: ${data.message || 'Unknown error. Please try again.'}`, 'error');
        return;
      }

      setSyncResult({ succeeded: data.succeeded, failed: data.failed });

      if (data.succeeded === 0 && data.failed > 0) {
        showToast(
          data.message ||
            data.results?.[0]?.error ||
            `HubSpot rejected all ${data.failed} contacts.`,
          'error'
        );
        return;
      }

      if (data.failed > 0) {
        const partialErr =
          data.message ||
          data.results?.find((r: { success?: boolean; error?: string }) => !r.success)?.error;
        showToast(
          `${data.succeeded} synced, ${data.failed} failed${partialErr ? ` — ${partialErr}` : '.'}`,
          'warning'
        );
        return;
      }

      showToast(
        `${data.succeeded} contact${data.succeeded !== 1 ? 's' : ''} synced to HubSpot successfully!`,
        'success'
      );
    } catch (err) {
      console.error('HubSpot sync error:', err);
      showToast('Sync failed. Please try again.', 'error');
    } finally {
      setIsBulkSyncing(false);
    }
  };

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return contacts.filter((c) => {
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q);

      const matchesEvent =
        filterEvent === 'all' || (c.event && c.event === filterEvent);

      return matchesSearch && matchesEvent;
    });
  }, [contacts, searchQuery, filterEvent]);

  const sortedContacts = useMemo(() => {
    const list = [...filteredContacts];
    const createdMs = (c: Contact) => {
      const d = c.created_at ?? c.date;
      if (d == null || d === '') return 0;
      const t = new Date(d as string).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    const leadNum = (c: Contact) => {
      const s = c.lead_score ?? c.leadScore;
      if (s == null || Number.isNaN(Number(s))) return null;
      return Number(s);
    };
    const nameStr = (c: Contact) => (c.name ?? '').toString();

    list.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return createdMs(b) - createdMs(a);
        case 'oldest':
          return createdMs(a) - createdMs(b);
        case 'az':
          return nameStr(a).localeCompare(nameStr(b), undefined, { sensitivity: 'base' });
        case 'za':
          return nameStr(b).localeCompare(nameStr(a), undefined, { sensitivity: 'base' });
        case 'highest': {
          const sa = leadNum(a);
          const sb = leadNum(b);
          if (sa == null && sb == null) return 0;
          if (sa == null) return 1;
          if (sb == null) return -1;
          return sb - sa;
        }
        case 'lowest': {
          const sa = leadNum(a);
          const sb = leadNum(b);
          if (sa == null && sb == null) return 0;
          if (sa == null) return 1;
          if (sb == null) return -1;
          return sa - sb;
        }
        default:
          return 0;
      }
    });
    return list;
  }, [filteredContacts, sortBy]);

  const allEventNames = useMemo(() => {
    const uniqueEventIds = Array.from(new Set(contacts.map((c) => c.event).filter(Boolean))) as string[];
    const validEventIds = uniqueEventIds.filter((id) => eventsMap[id]);
    return validEventIds;
  }, [contacts, eventsMap]);

  const startEditing = (contact: Contact) => {
    const checksArray = Array.isArray(contact.checks)
      ? [...(contact.checks as string[])]
      : [];

    const lead =
      typeof contact.lead_score === 'number'
        ? contact.lead_score
        : typeof contact.leadScore === 'number'
        ? contact.leadScore
        : 5;

    setEditForm({
      name: contact.name ?? '',
      title: contact.title ?? '',
      company: contact.company ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      linkedin: contact.linkedin ?? '',
      event: contact.event ?? '',
      free_note: (contact.free_note ?? contact.freeNote ?? '') as string,
      lead_score: lead,
      checks: checksArray,
    });
    setEditingContactId(contact.id);
    setSelected(contact);
    setConfirmDeleteId(null);
  };

  const cancelEditing = () => {
    setEditingContactId(null);
    setEditForm(null);
  };

  const toggleEditCheck = (label: string) => {
    if (!editForm) return;
    setEditForm((prev) => {
      if (!prev) return prev;
      const exists = prev.checks.includes(label);
      const nextChecks = exists
        ? prev.checks.filter((c) => c !== label)
        : [...prev.checks, label];
      return { ...prev, checks: nextChecks };
    });
  };

  const handleSaveContact = async () => {
    if (!selected || !editForm || editingContactId !== selected.id) return;

    const updatePayload = {
      name: editForm.name || null,
      title: editForm.title || null,
      company: editForm.company || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      linkedin: editForm.linkedin || null,
      event: editForm.event || null,
      free_note: editForm.free_note || null,
      lead_score: editForm.lead_score,
      checks: editForm.checks,
    };

    const { error } = await supabase
      .from('contacts')
      .update(updatePayload)
      .eq('id', selected.id);

    if (error) {
      console.error('Update contact error:', error);
      return;
    }

    const updated: Contact = {
      ...selected,
      ...updatePayload,
    };

    setContacts((prev) => prev.map((c) => (c.id === selected.id ? updated : c)));
    setSelected(updated);
    setEditingContactId(null);
    setEditForm(null);
    showToast('Contact updated', 'success');
  };

  const confirmBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToDelete = [...selectedIds];
    const { error } = await supabase.from('contacts').delete().in('id', idsToDelete);
    if (error) {
      console.error('Bulk delete error:', error);
      return;
    }
    setContacts((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
    setSelectedIds([]);
    setShowDeleteWarning(false);
    setPendingDeleteCount(0);
    setIsDeleteAllWarning(false);
    showToast(`${idsToDelete.length} contacts deleted`, 'success');
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const totalContactCount = contacts.length;
    const deleteAllScenario = selectedIds.length === totalContactCount;
    setIsDeleteAllWarning(deleteAllScenario);
    setPendingDeleteCount(selectedIds.length);
    setShowDeleteWarning(true);
  };

  const handleDeleteContact = async (contact: Contact) => {
    const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
    if (error) {
      console.error('Delete contact error:', error);
      return;
    }

    setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    if (selected?.id === contact.id) setSelected(null);
    setConfirmDeleteId(null);
    setEditingContactId(null);
    setEditForm(null);
  };

  const resolveDuplicateGroup = (index: number) => {
    const remaining = duplicateGroups.filter((_, i) => i !== index);
    setDuplicateGroups(remaining);
    if (remaining.length === 0) {
      setShowDuplicateModal(false);
      setShowDuplicateBanner(false);
      setDuplicateGroupIndex(0);
      showToast('All duplicates resolved', 'success');
      return;
    }
    setDuplicateGroupIndex((prev) => Math.max(0, Math.min(prev, remaining.length - 1)));
  };

  const handleKeepSeparate = (index: number) => {
    resolveDuplicateGroup(index);
  };

  const handleMergeDuplicateGroup = async (group: Contact[], index: number) => {
    if (!group.length) return;

    const leadNum = (c: Contact) => {
      const v = c.lead_score ?? c.leadScore;
      return v == null || Number.isNaN(Number(v)) ? -1 : Number(v);
    };

    const baseContact = [...group].sort((a, b) => leadNum(b) - leadNum(a))[0];
    const nonBase = group.filter((c) => c.id !== baseContact.id);

    const pickFirstValue = (...vals: Array<string | null | undefined>) => {
      for (const v of vals) {
        if (v != null && String(v).trim() !== '') return v;
      }
      return null;
    };

    const latestByCreated = [...group].sort((a, b) => {
      const ta = new Date(a.created_at ?? 0).getTime();
      const tb = new Date(b.created_at ?? 0).getTime();
      return tb - ta;
    })[0];

    const allChecks = Array.from(
      new Set(
        group.flatMap((c) => (Array.isArray(c.checks) ? c.checks : []))
      )
    );

    const enrichedCandidates = group.filter((c) => c.enriched === true && c.ai_enrichment);
    const bestEnrichmentContact = [...enrichedCandidates].sort((a, b) => {
      const aScore = Number((a.ai_enrichment as Record<string, unknown> | null)?.icp_fit_score ?? -1);
      const bScore = Number((b.ai_enrichment as Record<string, unknown> | null)?.icp_fit_score ?? -1);
      return (Number.isNaN(bScore) ? -1 : bScore) - (Number.isNaN(aScore) ? -1 : aScore);
    })[0] ?? null;

    const freeNoteCombined = group
      .map((c) => (c.free_note ?? c.freeNote ?? '').toString().trim())
      .filter(Boolean)
      .join(' | ');

    const mergedFields = {
      name: pickFirstValue(baseContact.name, ...group.map((c) => c.name)) ?? null,
      title: pickFirstValue(baseContact.title, ...group.map((c) => c.title)) ?? null,
      company: pickFirstValue(baseContact.company, ...group.map((c) => c.company)) ?? null,
      email: pickFirstValue(baseContact.email, ...group.map((c) => c.email)) ?? null,
      phone: pickFirstValue(baseContact.phone, ...group.map((c) => c.phone)) ?? null,
      linkedin: pickFirstValue(baseContact.linkedin, ...group.map((c) => c.linkedin)) ?? null,
      checks: allChecks,
      ai_enrichment: bestEnrichmentContact?.ai_enrichment ?? null,
      enriched: bestEnrichmentContact ? true : false,
      free_note: freeNoteCombined || null,
      event: latestByCreated?.event ?? null,
      lead_score: leadNum(baseContact) >= 0 ? leadNum(baseContact) : null,
    };

    const { error: updateError } = await supabase
      .from('contacts')
      .update(mergedFields)
      .eq('id', baseContact.id);

    if (updateError) {
      console.error('Merge update error:', updateError);
      showToast('Merge failed. Please try again.', 'error');
      return;
    }

    const otherContactIds = nonBase.map((c) => c.id);
    if (otherContactIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('contacts')
        .delete()
        .in('id', otherContactIds);
      if (deleteError) {
        console.error('Merge delete error:', deleteError);
        showToast('Merge failed. Please try again.', 'error');
        return;
      }
    }

    const mergedContact: Contact = { ...baseContact, ...mergedFields };
    const nextContacts = contacts
      .filter((c) => !otherContactIds.includes(c.id))
      .map((c) => (c.id === baseContact.id ? mergedContact : c));
    setContacts(nextContacts);

    const remaining = duplicateGroups
      .filter((_, i) => i !== index)
      .map((g) => g.filter((c) => !otherContactIds.includes(c.id)).map((c) => (c.id === baseContact.id ? mergedContact : c)))
      .filter((g) => g.length >= 2);

    if (remaining.length === 0) {
      setDuplicateGroups([]);
      setShowDuplicateModal(false);
      setShowDuplicateBanner(false);
      setDuplicateGroupIndex(0);
      showToast('Contacts merged successfully', 'success');
      showToast('All duplicates resolved', 'success');
      return;
    }

    setDuplicateGroups(remaining);
    setDuplicateGroupIndex((prev) => Math.max(0, Math.min(prev, remaining.length - 1)));
    showToast('Contacts merged successfully', 'success');
  };

  if (!user) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f0' }} />;
  }

  return (
    <div
      className='max-w-2xl mx-auto'
      style={{
        overflowX: 'hidden',
        maxWidth: '100vw',
        width: '100%',
        boxSizing: 'border-box',
        padding: isMobile ? '20px 16px 100px' : '32px 36px',
        backgroundColor: '#f0f2f0',
        minHeight: '100vh',
      }}
    >
      {toast && (
        <div
          role='status'
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background:
              toastVariant === 'success'
                ? '#7dde3c'
                : toastVariant === 'error'
                  ? '#e55a5a'
                  : '#f59e0f',
            color: toastVariant === 'success' ? '#0a1a0a' : '#fff',
            borderRadius: '10px',
            padding: '12px 20px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            zIndex: 1000,
            maxWidth: 'min(90vw, 360px)',
          }}
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          from {
            background-position: 200% 0;
          }
          to {
            background-position: -200% 0;
          }
        }
        @keyframes aiInsightsPending {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .pills-scroll-mobile::-webkit-scrollbar {
          display: none;
        }
        .pills-scroll-mobile {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 8,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: '#111111',
              margin: 0,
            }}
          >
            Contacts
          </h1>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 400,
              color: '#999',
              marginTop: 2,
              marginBottom: 0,
            }}
          >
            {filterEvent === 'all' && !searchQuery.trim()
              ? `${filteredContacts.length} contact${
                  filteredContacts.length === 1 ? '' : 's'
                }`
              : `${filteredContacts.length} of ${contacts.length} contact${
                  contacts.length === 1 ? '' : 's'
                }`}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!isMobile && (
            <button
              type='button'
              onClick={() => {
                const visibleIds = sortedContacts.map((c) => c.id);
                const allSelected =
                  visibleIds.length > 0 &&
                  visibleIds.every((id) => selectedIds.includes(id));
                if (allSelected) {
                  setSelectedIds((prev) =>
                    prev.filter((id) => !visibleIds.includes(id))
                  );
                } else {
                  setSelectedIds(visibleIds);
                }
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                color: '#111111',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                padding: '8px 16px',
                borderRadius: '999px',
                cursor: 'pointer',
                lineHeight: 1,
                display: 'inline-flex',
                alignItems: 'center',
                height: '36px',
              }}
            >
              {(() => {
                const visibleIds = sortedContacts.map((c) => c.id);
                const allSelected =
                  visibleIds.length > 0 &&
                  visibleIds.every((id) => selectedIds.includes(id));
                return allSelected ? 'Deselect all' : 'Select all';
              })()}
            </button>
          )}
          <Link
            href='/scan'
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              height: 40,
              width: 'auto',
              padding: isMobile ? '0 16px' : '0 18px',
              background: '#1a3a2a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <svg
              width='12'
              height='12'
              fill='none'
              viewBox='0 0 24 24'
              stroke='#ffffff'
              strokeWidth='2.5'
            >
              <path d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' />
              <circle cx='12' cy='13' r='4' />
            </svg>
            Scan
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: 16, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            position: 'relative',
            minHeight: 44,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            maxWidth: '100%',
          }}
        >
          <svg
            width='14'
            height='14'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth='2'
            style={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#c0c0c0',
              pointerEvents: 'none',
            }}
          >
            <circle cx='11' cy='11' r='8' />
            <path d='m21 21-4.35-4.35' />
          </svg>
          <input
            type='text'
            placeholder='Search contacts...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              minHeight: 44,
              padding: '10px 16px 10px 44px',
              fontSize: isMobile ? 15 : 14,
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              color: '#111111',
              borderRadius: 12,
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {showDuplicateBanner && duplicateGroups.length > 0 && (
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={{ color: '#b45309', fontSize: 14 }}>⚠</span>
            <span style={{ fontSize: 13, color: '#92400e' }}>
              {duplicateGroups.length} duplicate contacts detected.
            </span>
            <button
              type='button'
              onClick={() => {
                setShowDuplicateModal(true);
                setDuplicateGroupIndex(0);
              }}
              style={{
                color: '#b45309',
                fontWeight: 600,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                fontSize: 13,
                padding: 0,
              }}
            >
              Review & merge
            </button>
          </div>
          <button
            type='button'
            onClick={() => setShowDuplicateBanner(false)}
            style={{
              color: '#b45309',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div
        style={{
          marginBottom: 8,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div
          className={isMobile ? 'pills-scroll-mobile' : undefined}
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? 4 : 0,
            WebkitOverflowScrolling: isMobile ? 'touch' : undefined,
            scrollbarWidth: isMobile ? 'none' : undefined,
            flex: 1,
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <button
            type='button'
            onClick={() => setFilterEvent('all')}
            style={{
              background: filterEvent === 'all' ? '#1a3a2a' : 'rgba(255,255,255,0.8)',
              color: filterEvent === 'all' ? '#fff' : '#666',
              border:
                filterEvent === 'all'
                  ? 'none'
                  : '1px solid rgba(0,0,0,0.08)',
              borderRadius: 999,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: filterEvent === 'all' ? 500 : undefined,
              cursor: 'pointer',
              minHeight: isMobile ? 44 : undefined,
              flexShrink: isMobile ? 0 : 1,
            }}
          >
            All
          </button>
          {allEventNames.map((eventId) => (
            <button
              key={eventId}
              type='button'
              onClick={() => setFilterEvent(eventId)}
              style={{
                background: filterEvent === eventId ? '#1a3a2a' : 'rgba(255,255,255,0.8)',
                color: filterEvent === eventId ? '#fff' : '#666',
                border:
                  filterEvent === eventId
                    ? 'none'
                    : '1px solid rgba(0,0,0,0.08)',
                borderRadius: 999,
                padding: '7px 16px',
                fontSize: 13,
                fontWeight: filterEvent === eventId ? 500 : undefined,
                cursor: 'pointer',
                minHeight: isMobile ? 44 : undefined,
                flexShrink: isMobile ? 0 : 1,
              }}
            >
              {eventsMap[eventId]}
            </button>
          ))}
        </div>
        {contacts.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 12, color: '#999' }}>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as typeof sortBy)
              }
              style={{
                background: '#fff',
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: '#111',
                cursor: 'pointer',
                outline: 'none',
                width: 'auto',
                maxWidth: '100%',
              }}
            >
              <option value='newest'>newest</option>
              <option value='oldest'>oldest</option>
              <option value='az'>A → Z</option>
              <option value='za'>Z → A</option>
              <option value='highest'>Highest score</option>
              <option value='lowest'>Lowest score</option>
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div
          style={{
            marginTop: 16,
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.2s infinite',
                borderRadius: 12,
                height: 72,
                marginBottom: 8,
              }}
            />
          ))}
        </div>
      )}

      {!loading && contacts.length === 0 && (
        <div className='text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl'>
          <div className='w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3'>
            <svg
              width='20'
              height='20'
              fill='none'
              viewBox='0 0 24 24'
              stroke='#94a3b8'
              strokeWidth='1.5'
            >
              <path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />
              <circle cx='9' cy='7' r='4' />
              <path d='M23 21v-2a4 4 0 0 0-3-3.87' />
              <path d='M16 3.13a4 4 0 0 1 0 7.75' />
            </svg>
          </div>
          <p
            className='mb-1'
            style={{ fontSize: '13px', fontWeight: 400, color: '#999' }}
          >
            No contacts yet
          </p>
          <p
            className='mb-4'
            style={{ fontSize: '13px', fontWeight: 400, color: '#999' }}
          >
            Scan your first badge or card to get started
          </p>
          <Link
            href='/scan'
            style={{
              display: 'inline-block',
              background: '#1a3a2a',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Scan first contact
          </Link>
        </div>
      )}

      {!loading && (
      <div
        style={{
          marginTop: 8,
          background: isMobile ? 'transparent' : '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 8 : 0,
          border: isMobile ? 'none' : '1px solid #ebebeb',
          borderRadius: isMobile ? 0 : 16,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div
          style={{
            marginTop: 0,
            paddingTop: 0,
            width: '100%',
            overflowX: 'auto',
          }}
        >
        {!isMobile && (
          <div
            style={{
              width: '100%',
              background: '#fafafa',
              borderBottom: '1px solid #ebebeb',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              {[
                '',
                'NAME',
                'COMPANY',
                'TITLE',
                'EMAIL',
                'EVENT',
                'SCORE',
                'SIGNALS',
                'SOURCE',
                'SYNC',
              ].map((h, i) => (
                <div
                  key={h + i}
                  style={{
                    ...CONTACTS_DESKTOP_COL_STYLE[i],
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#999',
                    paddingTop: 10,
                    paddingBottom: 10,
                    paddingLeft: i === 0 ? 0 : 12,
                    paddingRight: i === 0 ? 0 : 12,
                    textAlign: i === 0 ? 'center' : i >= 6 ? 'center' : 'left',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    ...(h === 'NAME'
                      ? {
                          display: 'flex',
                          alignItems: 'center',
                        }
                      : {}),
                  }}
                >
                  {h === 'NAME' ? (
                    <>
                      <input
                        type='checkbox'
                        checked={
                          selectedIds.length === contacts.length &&
                          contacts.length > 0
                        }
                        onChange={(e) =>
                          e.target.checked
                            ? setSelectedIds(contacts.map((c) => c.id))
                            : setSelectedIds([])
                        }
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: 14,
                          height: 14,
                          cursor: 'pointer',
                          accentColor: '#1a3a2a',
                          marginRight: 8,
                          flexShrink: 0,
                        }}
                      />
                      {h}
                    </>
                  ) : (
                    h
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {sortedContacts.length === 0 && contacts.length > 0 ? (
          <div
            style={{
              padding: '40px 24px',
              textAlign: 'center',
              fontSize: 13,
              color: '#999',
            }}
          >
            No contacts match your filters.
          </div>
        ) : (
          sortedContacts.map((contact) => {
          const rawScore =
            (contact.lead_score ??
              contact.leadScore ??
              null) as number | null | undefined;
          const accent = scoreAccent(
            rawScore == null || Number.isNaN(Number(rawScore))
              ? null
              : Number(rawScore)
          );
          const leftBorder =
            accent === 'high'
              ? '3px solid #7dde3c'
              : accent === 'mid'
                ? '3px solid #f59e3f'
                : '3px solid #e55a5a';
          const badgeBg =
            accent === 'high'
              ? '#f0f7eb'
              : accent === 'mid'
                ? '#fff3eb'
                : '#fde8e8';
          const badgeColor =
            accent === 'high'
              ? '#2d6a1f'
              : accent === 'mid'
                ? '#b07020'
                : '#e55a5a';
          const scoreNum =
            rawScore == null || Number.isNaN(Number(rawScore))
              ? null
              : Number(rawScore);

          const initials = (contact.name || '?')
            .toString()
            .trim()
            .charAt(0)
            .toUpperCase();

          const expandedDetailInitials = (() => {
            const n = (contact.name || '').trim();
            if (!n) return '?';
            const parts = n.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
              return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
            }
            return n.charAt(0).toUpperCase();
          })();

          const eventLabel = contact.event ? eventsMap[contact.event] || null : null;

          return (
            <div
              key={contact.id}
              onClick={() =>
                setSelected(
                  selected?.id === contact.id ? null : (contact as Contact)
                )
              }
              className='group cursor-pointer'
              style={{
                background: '#fff',
                borderBottom: '1px solid #f5f5f5',
                overflow: 'hidden',
                transition: 'background 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (!isMobile) e.currentTarget.style.background = '#fafafa';
              }}
              onMouseLeave={(e) => {
                if (!isMobile) e.currentTarget.style.background = '#fff';
              }}
            >
              <div
                style={
                  isMobile
                    ? {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }
                    : {
                        display: 'flex',
                        width: '100%',
                        boxSizing: 'border-box',
                        alignItems: 'center',
                      }
                }
              >
                {isMobile ? (
                  <input
                    type='checkbox'
                    checked={selectedIds.includes(contact.id)}
                    onChange={(e) =>
                      e.target.checked
                        ? setSelectedIds((prev) => [...prev, contact.id])
                        : setSelectedIds((prev) =>
                            prev.filter((id) => id !== contact.id)
                          )
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: 14,
                      height: 14,
                      cursor: 'pointer',
                      accentColor: '#1a3a2a',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      ...CONTACTS_DESKTOP_COL_STYLE[0],
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <input
                      type='checkbox'
                      checked={selectedIds.includes(contact.id)}
                      onChange={(e) =>
                        e.target.checked
                          ? setSelectedIds((prev) => [...prev, contact.id])
                          : setSelectedIds((prev) =>
                              prev.filter((id) => id !== contact.id)
                            )
                      }
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 14,
                        height: 14,
                        cursor: 'pointer',
                        accentColor: '#1a3a2a',
                        flexShrink: 0,
                      }}
                    />
                  </div>
                )}
                {isMobile && contact.image ? (
                  <img
                    src={contact.image as string}
                    alt={`${contact.name || 'Contact'} badge`}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : isMobile ? (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 10,
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 400,
                        color: '#999',
                      }}
                    >
                      {initials}
                    </span>
                  </div>
                ) : null}
                <div
                  style={
                    isMobile
                      ? {
                          minWidth: 0,
                          flex: 1,
                          padding: 0,
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                        }
                      : {
                          ...CONTACTS_DESKTOP_COL_STYLE[1],
                          padding: '12px 12px',
                          overflow: 'hidden',
                          boxSizing: 'border-box',
                        }
                  }
                >
                  {!isMobile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {contact.image ? (
                        <img
                          src={contact.image as string}
                          alt={`${contact.name || 'Contact'} badge`}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#999',
                            flexShrink: 0,
                          }}
                        >
                          {initials}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#111',
                        }}
                      >
                        {contact.name}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#111',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {contact.name}
                      </div>
                      {contact.enriched ? (
                        <div style={{ marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: '#7ab648',
                              fontWeight: 400,
                            }}
                          >
                            Enriched
                          </span>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                {!isMobile && (
                  <>
                    <div
                      title={contact.company ?? undefined}
                      style={{
                        ...CONTACTS_DESKTOP_COL_STYLE[2],
                        padding: '12px 12px',
                        fontSize: 14,
                        color: '#555',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {contact.company || '—'}
                    </div>
                    <div
                      title={contact.title ?? undefined}
                      style={{
                        ...CONTACTS_DESKTOP_COL_STYLE[3],
                        padding: '12px 12px',
                        fontSize: 14,
                        color: '#555',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {contact.title || '—'}
                    </div>
                    <div
                      title={contact.email ?? undefined}
                      style={{
                        ...CONTACTS_DESKTOP_COL_STYLE[4],
                        padding: '12px 12px',
                        fontSize: 13,
                        color: '#999',
                        fontFamily: 'monospace',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {contact.email || '—'}
                    </div>
                    <div
                      title={eventLabel ?? undefined}
                      style={{
                        ...CONTACTS_DESKTOP_COL_STYLE[5],
                        padding: '12px 12px',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {eventLabel ? (
                        <span
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 12,
                            color: '#666',
                          }}
                        >
                          {eventLabel}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: '#999' }}>—</span>
                      )}
                    </div>
                  </>
                )}
                <div
                  style={
                    isMobile
                      ? {
                          textAlign: 'center',
                          padding: 0,
                          width: 36,
                          minWidth: 0,
                          boxSizing: 'border-box',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                        }
                      : {
                          ...CONTACTS_DESKTOP_COL_STYLE[6],
                          textAlign: 'center',
                          padding: '12px 12px',
                          boxSizing: 'border-box',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }
                  }
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      padding: isMobile ? '4px 0' : '5px 12px',
                      borderRadius: 999,
                      background: badgeBg,
                      color: badgeColor,
                      flexShrink: 0,
                      minWidth: isMobile ? 28 : undefined,
                      textAlign: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    {scoreNum == null ? '—' : scoreNum}
                  </span>
                </div>
                {!isMobile && (
                  <div
                    style={{
                      ...CONTACTS_DESKTOP_COL_STYLE[7],
                      padding: '12px 12px',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                    }}
                  >
                    {contact.checks && contact.checks.length > 0 ? (
                      <span
                        style={{
                          display: 'inline-block',
                          background: '#f0f7eb',
                          color: '#2d6a1f',
                          border: '1px solid #c8e6c0',
                          fontSize: 11,
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}
                      >
                        {contact.checks.length} signals
                      </span>
                    ) : (
                      <span style={{ fontSize: 14, color: '#999' }}>—</span>
                    )}
                  </div>
                )}
                {!isMobile && (
                  <div
                    style={{
                      ...CONTACTS_DESKTOP_COL_STYLE[8],
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '12px 12px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <ContactSourceCell contact={contact} />
                  </div>
                )}
                {!isMobile && (
                  <div
                    style={{
                      ...CONTACTS_DESKTOP_COL_STYLE[9],
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      padding: '12px 12px',
                      boxSizing: 'border-box',
                    }}
                  >
                    {contact.synced_to_hubspot === true ? (
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: '#ff7a59',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        H
                      </span>
                    ) : (
                      <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                    )}
                  </div>
                )}
              </div>

              {selected?.id === contact.id && (
                <div
                  style={{
                    padding: editingContactId === contact.id ? '0 18px 18px' : '20px 32px',
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                    marginTop: 8,
                    paddingTop: editingContactId === contact.id ? 16 : undefined,
                    cursor: 'default',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingContactId === contact.id && editForm ? (
                    <div className='space-y-4 rounded-2xl border border-[#dce8d0] bg-[#f0f0ec] p-4'>
                      <p
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          color: '#999',
                          margin: 0,
                        }}
                      >
                        Edit contact
                      </p>
                      <div className='grid grid-cols-2 gap-3'>
                        {[
                          { key: 'name', label: 'Name' },
                          { key: 'title', label: 'Title' },
                          { key: 'company', label: 'Company' },
                          { key: 'email', label: 'Email' },
                          { key: 'phone', label: 'Phone' },
                          { key: 'linkedin', label: 'LinkedIn' },
                          { key: 'event', label: 'Event' },
                        ].map(({ key, label }) => (
                          <div key={key}>
                            <label
                              className='mb-0.5 block'
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#999',
                              }}
                            >
                              {label}
                            </label>
                            {key === 'event' ? (
                              <select
                                value={editForm.event || ''}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          event: e.target.value,
                                        }
                                      : prev
                                  )
                                }
                                style={{
                                  width: '100%',
                                  background: '#f7f7f5',
                                  border: '1px solid #e8e8e8',
                                  borderRadius: 8,
                                  height: 40,
                                  padding: '0 12px',
                                  fontSize: '13px',
                                  fontWeight: 400,
                                  color: '#111',
                                  cursor: 'pointer',
                                  appearance: 'none',
                                  boxSizing: 'border-box',
                                }}
                              >
                                <option value=''>Untagged</option>
                                {events.map((ev) => (
                                  <option key={ev.id} value={ev.name}>
                                    {ev.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type='text'
                                value={editForm[key as keyof EditForm] as string}
                                onChange={(e) =>
                                  setEditForm((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          [key]: e.target.value,
                                        }
                                      : prev
                                  )
                                }
                                className='w-full rounded-lg border border-[#dce8d0] bg-white px-3 py-2 outline-none focus:border-[#7ab648]'
                                style={{
                                  color: '#1a2e1a',
                                  fontSize: '13px',
                                  fontWeight: 400,
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label
                          className='mb-0.5 block'
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: '#999',
                          }}
                        >
                          Notes
                        </label>
                        <textarea
                          value={editForm.free_note}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev
                                ? { ...prev, free_note: e.target.value }
                                : prev
                            )
                          }
                          rows={3}
                          className='w-full rounded-lg border border-[#dce8d0] bg-white p-3 outline-none resize-none focus:border-[#7ab648]'
                          style={{
                            color: '#1a2e1a',
                            fontSize: '13px',
                            fontWeight: 400,
                          }}
                        />
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: '#999',
                            marginBottom: 8,
                            marginTop: 0,
                          }}
                        >
                          Lead Score
                        </p>
                        <div className='flex items-center gap-3'>
                          <input
                            type='range'
                            min={1}
                            max={10}
                            value={editForm.lead_score}
                            style={{
                              ['--val' as string]: `${
                                ((editForm.lead_score - 1) / 9) * 100
                              }%`,
                            }}
                            onChange={(e) =>
                              setEditForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      lead_score: Number(e.target.value),
                                    }
                                  : prev
                              )
                            }
                            onInput={(e) => {
                              const val =
                                ((Number(e.currentTarget.value) - 1) / 9) *
                                100;
                              e.currentTarget.style.setProperty(
                                '--val',
                                `${val}%`
                              );
                              e.currentTarget.style.background = `linear-gradient(to right, #7ab648 ${val}%, #dce8d0 ${val}%)`;
                            }}
                            className='flex-1'
                          />
                          <span
                            className='w-8 text-right'
                            style={{
                              fontSize: '13px',
                              fontWeight: 400,
                              color: '#111',
                            }}
                          >
                            {editForm.lead_score}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            color: '#999',
                            marginBottom: 10,
                            marginTop: 0,
                          }}
                        >
                          Signals
                        </p>
                        <div className='space-y-2'>
                          {signalLabels.map((label) => (
                            <label
                              key={label}
                              className='flex items-center gap-2.5 cursor-pointer group select-none'
                              onClick={() => toggleEditCheck(label)}
                            >
                              <div
                                className={`w-[18px] h-[18px] rounded-[4px] flex items-center justify-center flex-shrink-0 transition-all border ${
                                  editForm.checks.includes(label)
                                    ? 'bg-[#7ab648] border-[#7ab648]'
                                    : 'bg-white border-[#dce8d0] group-hover:border-[#7ab648]'
                                }`}
                              >
                                {editForm.checks.includes(label) && (
                                  <svg
                                    width='10'
                                    height='10'
                                    fill='none'
                                    viewBox='0 0 24 24'
                                    stroke='white'
                                    strokeWidth='3'
                                  >
                                    <polyline points='20 6 9 17 4 12' />
                                  </svg>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 400,
                                  color: editForm.checks.includes(label)
                                    ? '#111'
                                    : '#999',
                                }}
                              >
                                {label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className='flex gap-2 pt-2'>
                        <button
                          type='button'
                          onClick={handleSaveContact}
                          className='flex-1 px-3 py-2 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] transition-colors hover:bg-[#f7faf4] hover:text-[#1a2e1a]'
                          style={{
                            color: '#1a2e1a',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          Save changes
                        </button>
                        <button
                          type='button'
                          onClick={cancelEditing}
                          className='px-3 py-2 rounded-full border border-[#dce8d0] bg-white hover:bg-[#f7faf4] transition-colors'
                          style={{
                            color: '#1a2e1a',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* EXPANDED_ROW_START */}
                      {/* spacing check: container gap=32px, avatar marginRight=0 */}
                      {/* expanded-row grid: gridTemplateColumns=isMobile ? '1fr' : '200px 1fr', gap=32 */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : '200px 1fr',
                          gap: 32,
                          columnGap: 32,
                          paddingTop: 24,
                          alignItems: 'start',
                        }}
                      >
                        <div style={{ width: '100%', marginBottom: 12 }}>
                          {contact.image ? (
                            <img
                              src={contact.image as string}
                              alt={contact.name || 'Contact'}
                              style={{
                                width: '100%',
                                borderRadius: 12,
                                objectFit: 'cover',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 160,
                                height: 160,
                                maxWidth: '100%',
                                borderRadius: '50%',
                                background: '#f0f0f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: isMobile ? '0 auto' : undefined,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 38,
                                  fontWeight: 600,
                                  color: '#999',
                                }}
                              >
                                {expandedDetailInitials}
                              </span>
                            </div>
                          )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ marginBottom: 16 }}>
                            <h3
                              style={{
                                fontSize: 20,
                                fontWeight: 700,
                                color: '#111',
                                margin: 0,
                                lineHeight: 1.2,
                              }}
                            >
                              {contact.name || '—'}
                            </h3>
                            {contact.title ? (
                              <p
                                style={{
                                  fontSize: 14,
                                  color: '#555',
                                  margin: '6px 0 0 0',
                                }}
                              >
                                {contact.title}
                              </p>
                            ) : null}
                            {contact.company ? (
                              <p
                                style={{
                                  fontSize: 14,
                                  color: '#666',
                                  margin: '4px 0 0 0',
                                }}
                              >
                                {contact.company}
                              </p>
                            ) : null}
                          </div>
                      {contact.synced_to_hubspot === true && (
                        <div style={{ marginBottom: 12 }}>
                          <span
                            style={{
                              background: '#fff3ee',
                              color: '#ff7a59',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '999px',
                              padding: '2px 8px',
                              letterSpacing: '0.02em',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>H</span>
                            <span>Synced</span>
                          </span>
                          {contact.hubspot_synced_at && (
                            <p
                              style={{
                                fontSize: 11,
                                color: '#999',
                                margin: '6px 0 0 0',
                              }}
                            >
                              Synced to HubSpot ·{' '}
                              {formatHubSpotSyncedAt(contact.hubspot_synced_at)}
                            </p>
                          )}
                        </div>
                      )}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                          gap: 12,
                        }}
                      >
                        {contact.email && (
                          <div>
                            <p
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#999',
                                marginBottom: 4,
                                marginTop: 0,
                              }}
                            >
                              Email
                            </p>
                            <p
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: '#111',
                                margin: 0,
                              }}
                            >
                              {contact.email}
                            </p>
                          </div>
                        )}
                        {contact.phone && (
                          <div>
                            <p
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#999',
                                marginBottom: 4,
                                marginTop: 0,
                              }}
                            >
                              Phone
                            </p>
                            <p
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: '#111',
                                margin: 0,
                              }}
                            >
                              {contact.phone}
                            </p>
                          </div>
                        )}
                        {contact.linkedin && (
                          <div>
                            <p
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#999',
                                marginBottom: 4,
                                marginTop: 0,
                              }}
                            >
                              LinkedIn
                            </p>
                            <p
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: '#111',
                                margin: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {contact.linkedin}
                            </p>
                          </div>
                        )}
                        {contact.company && (
                          <div>
                            <p
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#999',
                                marginBottom: 4,
                                marginTop: 0,
                              }}
                            >
                              Company
                            </p>
                            <p
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: '#111',
                                margin: 0,
                              }}
                            >
                              {contact.company}
                            </p>
                          </div>
                        )}
                        {contact.title && (
                          <div>
                            <p
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: '#999',
                                marginBottom: 4,
                                marginTop: 0,
                              }}
                            >
                              Title
                            </p>
                            <p
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: '#111',
                                margin: 0,
                              }}
                            >
                              {contact.title}
                            </p>
                          </div>
                        )}
                        <div>
                          <p
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: '#999',
                              marginBottom: 4,
                              marginTop: 0,
                            }}
                          >
                            Event
                          </p>
                          <p
                            style={{
                              fontSize: '13px',
                              fontWeight: 400,
                              color: '#111',
                              margin: 0,
                            }}
                          >
                            {contact.event ? eventsMap[contact.event] || '—' : '—'}
                          </p>
                        </div>
                        <div>
                          <p
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: '#999',
                              marginBottom: 4,
                              marginTop: 0,
                            }}
                          >
                            Lead Score
                          </p>
                          <p
                            style={{
                              fontSize: '13px',
                              fontWeight: 400,
                              color: '#111',
                              margin: 0,
                            }}
                          >
                            {rawScore ?? '—'}
                          </p>
                        </div>
                      </div>
                      {contact.checks && contact.checks.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <p
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: '#999',
                              marginBottom: 8,
                              marginTop: 0,
                            }}
                          >
                            Signals
                          </p>
                          <div className='space-y-1'>
                            {contact.checks.map((c, i) => (
                              <div
                                key={i}
                                className='flex items-center gap-2'
                                style={{
                                  fontSize: '13px',
                                  fontWeight: 400,
                                  color: '#111',
                                }}
                              >
                                <svg
                                  width='11'
                                  height='11'
                                  fill='none'
                                  viewBox='0 0 24 24'
                                  stroke='#10b981'
                                  strokeWidth='2.5'
                                >
                                  <polyline points='20 6 9 17 4 12' />
                                </svg>
                                {c}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {(contact.free_note || contact.freeNote) && (
                        <div style={{ marginTop: 12 }}>
                          <p
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: '#999',
                              marginBottom: 4,
                              marginTop: 0,
                            }}
                          >
                            Notes
                          </p>
                          <p
                            style={{
                              fontSize: '13px',
                              fontWeight: 400,
                              color: '#111',
                              background: '#f7f7f5',
                              borderRadius: 10,
                              padding: 12,
                              lineHeight: 1.5,
                              margin: 0,
                            }}
                          >
                            {(contact.free_note ?? contact.freeNote) as string}
                          </p>
                        </div>
                      )}
                      <div
                        style={{
                          marginTop: 16,
                          padding: '14px 16px',
                          background: '#fafafa',
                          border: '1px solid #f0f0f0',
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: '#999',
                              letterSpacing: '0.08em',
                            }}
                          >
                            AI INSIGHTS
                          </span>
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleReEnrich(contact);
                            }}
                            disabled={reEnrichingId === contact.id}
                            onMouseEnter={(e) => {
                              if (reEnrichingId !== contact.id) {
                                e.currentTarget.style.background = '#f0f7eb';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                            style={{
                              background: 'transparent',
                              border: '1px solid #e8e8e8',
                              borderRadius: 6,
                              padding: '3px 10px',
                              fontSize: 11,
                              color: '#7dde3c',
                              cursor: reEnrichingId === contact.id ? 'wait' : 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            {reEnrichingId === contact.id ? 'Enriching...' : 'Re-enrich'}
                          </button>
                        </div>
                        {contact.ai_enrichment &&
                        typeof contact.ai_enrichment === 'object' &&
                        !Array.isArray(contact.ai_enrichment) ? (
                          (() => {
                            const ai = contact.ai_enrichment as Record<string, unknown>;
                            const summary = typeof ai.summary === 'string' ? ai.summary : null;
                            const fitRaw = ai.icp_fit_score;
                            const fit =
                              typeof fitRaw === 'number'
                                ? fitRaw
                                : typeof fitRaw === 'string'
                                  ? Number(fitRaw)
                                  : null;
                            const fitNum =
                              fit != null && !Number.isNaN(Number(fit)) ? Number(fit) : null;
                            const fitColor =
                              fitNum == null
                                ? '#2d6a1f'
                                : fitNum >= 7
                                  ? '#2d6a1f'
                                  : fitNum >= 4
                                    ? '#b07020'
                                    : '#e55a5a';
                            const reason =
                              typeof ai.icp_fit_reason === 'string' ? ai.icp_fit_reason : null;
                            const points = Array.isArray(ai.talking_points)
                              ? (ai.talking_points as unknown[]).filter((x) => typeof x === 'string')
                              : [];
                            const redRaw = ai.red_flags;
                            const redFlags = Array.isArray(redRaw)
                              ? (redRaw as unknown[]).filter((x) => typeof x === 'string')
                              : [];
                            return (
                              <>
                                {fitNum != null || reason ? (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexWrap: 'wrap',
                                      alignItems: 'baseline',
                                    }}
                                  >
                                    {fitNum != null ? (
                                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                                        ICP fit:{' '}
                                        <span style={{ color: fitColor }}>
                                          {fitNum}/10
                                        </span>
                                      </span>
                                    ) : null}
                                    {reason ? (
                                      <span
                                        style={{
                                          fontSize: 12,
                                          color: '#999',
                                          marginLeft: fitNum != null ? 8 : 0,
                                        }}
                                      >
                                        {reason}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {summary ? (
                                  <p
                                    style={{
                                      fontSize: 13,
                                      color: '#444',
                                      marginTop: 8,
                                      lineHeight: 1.5,
                                      marginBottom: 0,
                                    }}
                                  >
                                    {summary}
                                  </p>
                                ) : null}
                                {points.length > 0 ? (
                                  <div>
                                    <p
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: '#999',
                                        marginTop: 12,
                                        marginBottom: 4,
                                        marginLeft: 0,
                                        marginRight: 0,
                                      }}
                                    >
                                      Talking points
                                    </p>
                                    {points.map((t, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: 0,
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: 99,
                                            background: '#7dde3c',
                                            marginRight: 8,
                                            marginTop: 6,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            fontSize: 13,
                                            color: '#444',
                                          }}
                                        >
                                          {t}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {redFlags.length > 0 ? (
                                  <div>
                                    <p
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: '#e55a5a',
                                        marginTop: 10,
                                        marginBottom: 4,
                                        marginLeft: 0,
                                        marginRight: 0,
                                      }}
                                    >
                                      Red flags
                                    </p>
                                    {redFlags.map((t, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: 99,
                                            background: '#e55a5a',
                                            marginRight: 8,
                                            marginTop: 6,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span
                                          style={{
                                            fontSize: 13,
                                            color: '#e55a5a',
                                          }}
                                        >
                                          {t}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            );
                          })()
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: 8,
                            }}
                          >
                            <span style={{ fontSize: 13, color: '#bbb' }}>No AI insights yet.</span>
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleReEnrich(contact);
                              }}
                              disabled={reEnrichingId === contact.id}
                              onMouseEnter={(e) => {
                                if (reEnrichingId !== contact.id) {
                                  e.currentTarget.style.background = '#f0f7eb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                              style={{
                                background: 'transparent',
                                border: '1px solid #e8e8e8',
                                borderRadius: 6,
                                padding: '3px 10px',
                                fontSize: 11,
                                color: '#7dde3c',
                                cursor: reEnrichingId === contact.id ? 'wait' : 'pointer',
                                fontWeight: 500,
                              }}
                            >
                              {reEnrichingId === contact.id ? 'Enriching...' : 'Enrich'}
                            </button>
                          </div>
                        )}
                        {reEnrichErrorForId === contact.id ? (
                          <p style={{ fontSize: 12, color: '#e55a5a', margin: '10px 0 0 0' }}>
                            Enrichment failed, try again
                          </p>
                        ) : null}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 16,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          flexDirection: isMobile ? 'column' : 'row',
                          width: isMobile ? '100%' : 'auto',
                        }}
                      >
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            setSequenceDrawerContact(contact);
                            setSequenceEmails(null);
                            setSequenceContext('');
                            setSequenceCadence([
                              { day: 1, tone: 'professional' },
                              { day: 4, tone: 'professional' },
                              { day: 14, tone: 'professional' },
                            ]);
                            setSequenceDrawerExpanded({});
                            setSequenceDrawerEditIdx(null);
                          }}
                          style={{
                            background: '#7dde3c',
                            color: '#0a1a0a',
                            border: 'none',
                            borderRadius: 10,
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 44 : undefined,
                          }}
                        >
                          Generate Sequence
                        </button>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            void syncSingleContact(contact.id);
                          }}
                          disabled={isSyncing === contact.id}
                          style={{
                            background: isSyncing === contact.id ? '#f5f5f5' : '#fff3ee',
                            border: '1px solid #ffd4c2',
                            color: '#ff7a59',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '999px',
                            padding: '8px 16px',
                            cursor: isSyncing === contact.id ? 'not-allowed' : 'pointer',
                            opacity: isSyncing === contact.id ? 0.6 : 1,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 44 : undefined,
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '12px' }}>H</span>
                          {isSyncing === contact.id
                            ? 'Syncing...'
                            : contact.synced_to_hubspot
                              ? 'Re-sync'
                              : 'Sync to HubSpot'}
                        </button>
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(contact);
                          }}
                          style={{
                            background: 'rgba(0,0,0,0.04)',
                            color: '#444',
                            border: 'none',
                            borderRadius: 10,
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            letterSpacing: '-0.01em',
                            cursor: 'pointer',
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 44 : undefined,
                          }}
                        >
                          Edit
                        </button>
                        {confirmDeleteId === contact.id ? (
                          <div className='flex items-center gap-2 flex-wrap' style={{ width: isMobile ? '100%' : 'auto' }}>
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: '#999',
                              }}
                            >
                              Delete this contact?
                            </span>
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContact(contact);
                              }}
                              style={{
                                background: 'rgba(229,90,90,0.08)',
                                color: '#e55a5a',
                                border: 'none',
                                borderRadius: 10,
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                letterSpacing: '-0.01em',
                                cursor: 'pointer',
                                width: isMobile ? '100%' : 'auto',
                                minHeight: isMobile ? 44 : undefined,
                                marginBottom: isMobile ? 8 : 0,
                              }}
                            >
                              Yes, delete
                            </button>
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              style={{
                                background: 'rgba(0,0,0,0.04)',
                                color: '#444',
                                border: 'none',
                                borderRadius: 10,
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                letterSpacing: '-0.01em',
                                cursor: 'pointer',
                                width: isMobile ? '100%' : 'auto',
                                minHeight: isMobile ? 44 : undefined,
                                marginBottom: isMobile ? 8 : 0,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type='button'
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(contact.id);
                            }}
                            style={{
                              background: 'rgba(229,90,90,0.08)',
                              color: '#e55a5a',
                              border: 'none',
                              borderRadius: 10,
                              padding: '8px 16px',
                              fontSize: '13px',
                              fontWeight: 600,
                              letterSpacing: '-0.01em',
                              cursor: 'pointer',
                              width: isMobile ? '100%' : 'auto',
                              minHeight: isMobile ? 44 : undefined,
                              marginBottom: isMobile ? 8 : 0,
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                        </div>
                      </div>
                      {/* EXPANDED_ROW_END */}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })
        )}
        </div>
      </div>
      )}

      {showDuplicateModal && duplicateGroups.length > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowDuplicateModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 28,
              width: 560,
              maxWidth: '90vw',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111', margin: 0 }}>Review Duplicates</h3>
                <p style={{ fontSize: 13, color: '#999', margin: '6px 0 0 0' }}>{duplicateGroups.length} groups found</p>
              </div>
              <button
                type='button'
                onClick={() => setShowDuplicateModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#999', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {(() => {
              const group = duplicateGroups[duplicateGroupIndex];
              if (!group) return null;
              return (
                <div
                  style={{
                    background: '#fafafa',
                    border: '1px solid #ebebeb',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#999', letterSpacing: '0.08em', marginBottom: 12 }}>
                    Group {duplicateGroupIndex + 1} of {duplicateGroups.length}
                  </div>

                  {group.map((c) => {
                    const score = c.lead_score ?? c.leadScore;
                    const created = c.created_at ? new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                    const initials = (c.name || '?').toString().trim().charAt(0).toUpperCase();
                    return (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                        {c.image ? (
                          <img src={c.image as string} alt={c.name || 'Contact'} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#f0f0f0', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                            {initials}
                          </div>
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{c.name || 'Unknown contact'}</div>
                          <div style={{ fontSize: 12, color: '#999' }}>{[c.title, c.company].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                        {c.enriched && (
                          <span style={{ background: '#f0f7eb', color: '#2d6a1f', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                            Enriched
                          </span>
                        )}
                        <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 8px', background: '#f5f5f5', color: '#555' }}>
                          {score == null ? '—' : score}
                        </span>
                        <span style={{ fontSize: 11, color: '#bbb' }}>{created}</span>
                      </div>
                    );
                  })}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                    <button
                      type='button'
                      onClick={() => void handleMergeDuplicateGroup(group, duplicateGroupIndex)}
                      style={{
                        background: '#1a3a2a',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 'none',
                      }}
                    >
                      Merge into one
                    </button>
                    <button
                      type='button'
                      onClick={() => handleKeepSeparate(duplicateGroupIndex)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #e8e8e8',
                        color: '#999',
                        borderRadius: 8,
                        padding: '8px 16px',
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Keep separate
                    </button>
                  </div>
                </div>
              );
            })()}

            {duplicateGroups.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <button
                  type='button'
                  onClick={() => setDuplicateGroupIndex((i) => Math.max(0, i - 1))}
                  disabled={duplicateGroupIndex === 0}
                  style={{
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    color: duplicateGroupIndex === 0 ? '#ccc' : '#666',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: duplicateGroupIndex === 0 ? 'default' : 'pointer',
                  }}
                >
                  Previous group
                </button>
                <button
                  type='button'
                  onClick={() => setDuplicateGroupIndex((i) => Math.min(duplicateGroups.length - 1, i + 1))}
                  disabled={duplicateGroupIndex >= duplicateGroups.length - 1}
                  style={{
                    background: '#fff',
                    border: '1px solid #e8e8e8',
                    color: duplicateGroupIndex >= duplicateGroups.length - 1 ? '#ccc' : '#666',
                    borderRadius: 8,
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: duplicateGroupIndex >= duplicateGroups.length - 1 ? 'default' : 'pointer',
                  }}
                >
                  Next group
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteWarning && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setShowDeleteWarning(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 420,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0, marginBottom: 8 }}>
              {isDeleteAllWarning ? 'Delete all contacts?' : `Delete ${pendingDeleteCount} contacts?`}
            </h3>
            <p style={{ fontSize: 14, color: '#666', margin: 0, marginBottom: 20, lineHeight: 1.5 }}>
              {isDeleteAllWarning
                ? `You're about to permanently delete all ${pendingDeleteCount} contacts. This cannot be undone.`
                : `Delete ${pendingDeleteCount} contacts? This cannot be undone.`}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type='button'
                onClick={() => setShowDeleteWarning(false)}
                style={{
                  background: '#fff',
                  border: '1px solid #e8e8e8',
                  color: '#111',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={() => void confirmBulkDelete()}
                style={{
                  background: '#fff',
                  border: '1px solid #fde8e8',
                  color: '#e55a5a',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {isDeleteAllWarning ? 'Yes, delete all' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div
          className={isMobile ? 'pills-scroll-mobile' : undefined}
          style={
            isMobile
              ? {
                  position: 'fixed',
                  bottom: 72,
                  left: '50%',
                  right: 'auto',
                  transform: 'translateX(-50%)',
                  width: 'auto',
                  maxWidth: 'calc(100vw - 24px)',
                  background: '#1a3a2a',
                  borderRadius: 99,
                  padding: '0 16px 0 6px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  WebkitOverflowScrolling: 'touch',
                  zIndex: 999,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                  height: 48,
                }
              : {
                  position: 'fixed',
                  bottom: 24,
                  left: '50%',
                  right: 'auto',
                  transform: 'translateX(-50%)',
                  background: 'rgba(20, 20, 20, 0.75)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 999,
                  padding: '10px 16px',
                  display: 'flex',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  gap: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  zIndex: 50,
                  overflow: 'hidden',
                }
          }
        >
          {isMobile && (
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 99,
                background: '#ffffff',
                color: '#1a3a2a',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginLeft: 6,
                marginRight: 2,
              }}
            >
              {selectedIds.length}
            </span>
          )}
          {isMobile && (
            <div
              style={{
                width: 1,
                height: 20,
                background: 'rgba(255,255,255,0.2)',
                flexShrink: 0,
              }}
            />
          )}
          {!isMobile && (
            <button
              type='button'
              onClick={() => {
                const visibleIds = sortedContacts.map((c) => c.id);
                const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
                if (allSelected) {
                  setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
                } else {
                  setSelectedIds(visibleIds);
                }
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                fontSize: 13,
                cursor: 'pointer',
                paddingRight: 6,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {(() => {
                const visibleIds = sortedContacts.map((c) => c.id);
                const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
                return allSelected ? 'Deselect all' : 'Select all';
              })()}
            </button>
          )}
          {!isMobile && (
            <span
              style={{
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                paddingRight: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {`${selectedIds.length} selected`}
            </span>
          )}
          <button
            type='button'
            onClick={() => {
              showToast('Opening sequences...', 'success');
              window.location.href = '/sequences';
            }}
            style={
              isMobile
                ? {
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '0 10px',
                    height: 48,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }
                : {
                    background: '#7dde3c',
                    color: '#0a1a0a',
                    borderRadius: 999,
                    padding: '8px 18px',
                    fontSize: 13,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
            }
          >
            {isMobile ? 'Sequences' : 'Generate Sequences'}
          </button>
          <button
            type='button'
            onClick={() => void syncToHubSpot()}
            disabled={isBulkSyncing}
            style={
              isMobile
                ? {
                    background: '#ff7a59',
                    border: 'none',
                    borderRadius: 99,
                    padding: '0 10px',
                    color: '#ffffff',
                    height: 'auto',
                    alignSelf: 'center',
                    margin: '0 4px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: isBulkSyncing ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: isBulkSyncing ? 0.7 : 1,
                  }
                : {
                    background: '#ff7a59',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: '999px',
                    padding: '8px 16px',
                    border: 'none',
                    cursor: isBulkSyncing ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    opacity: isBulkSyncing ? 0.7 : 1,
                  }
            }
          >
            {!isMobile && (
              <span style={{ fontWeight: 700, fontSize: 13 }}>H</span>
            )}
            {isBulkSyncing
              ? 'Syncing...'
              : isMobile
                ? 'HubSpot'
                : 'Sync to HubSpot'}
          </button>
          <button
            type='button'
            onClick={() => {
              const selectedContacts = contacts.filter((c) =>
                selectedIds.includes(c.id)
              );
              if (!selectedContacts.length) return;
              const header = [
                'name',
                'title',
                'company',
                'email',
                'phone',
                'event',
                'lead_score',
              ];
              const rows = selectedContacts.map((c) => [
                c.name ?? '',
                c.title ?? '',
                c.company ?? '',
                c.email ?? '',
                c.phone ?? '',
                c.event ?? '',
                (c.lead_score ?? c.leadScore ?? '') as string | number,
              ]);
              const csvContent = [header, ...rows]
                .map((row) =>
                  row
                    .map((value) => {
                      const str = String(value ?? '');
                      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                      }
                      return str;
                    })
                    .join(',')
                )
                .join('\n');
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.setAttribute('download', 'katch-export.csv');
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              showToast(`Exported ${selectedContacts.length} contacts`, 'success');
            }}
            style={
              isMobile
                ? {
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '0 10px',
                    height: 48,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }
                : {
                    background: 'rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 999,
                    padding: '8px 18px',
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
            }
          >
            {isMobile ? 'Export' : 'Export CSV'}
          </button>
          <button
            type='button'
            onClick={handleBulkDelete}
            style={
              isMobile
                ? {
                    background: 'transparent',
                    border: 'none',
                    color: '#ff6b6b',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    padding: '0 10px',
                    height: 48,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }
                : {
                    background: 'rgba(229,90,90,0.15)',
                    color: '#e55a5a',
                    border: '1px solid rgba(229,90,90,0.2)',
                    borderRadius: 999,
                    padding: '8px 18px',
                    fontSize: 13,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }
            }
          >
            Delete
          </button>
        </div>
      )}

      {sequenceDrawerContact && (
        <div
          role='presentation'
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            zIndex: 2400,
          }}
          onClick={() => setSequenceDrawerContact(null)}
        />
      )}
      {sequenceDrawerContact && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 'min(480px, 100vw)',
            background: '#fff',
            zIndex: 2401,
            boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #ebebeb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#111',
                margin: 0,
                paddingRight: 12,
              }}
            >
              Generate Sequence for {sequenceDrawerContact.name ?? 'Contact'}
            </h2>
            <button
              type='button'
              onClick={() => setSequenceDrawerContact(null)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 22,
                color: '#999',
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
              aria-label='Close'
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', margin: '0 0 8px' }}>
              Cadence
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {sequenceCadence.map((step, index) => (
                <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input
                    type='number'
                    min={0}
                    value={step.day}
                    onChange={(e) =>
                      setSequenceCadence((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, day: parseInt(e.target.value, 10) || 0 } : s))
                      )
                    }
                    style={{
                      width: 72,
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  />
                  <select
                    value={step.tone}
                    onChange={(e) =>
                      setSequenceCadence((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, tone: e.target.value as SeqTone } : s))
                      )
                    }
                    style={{
                      flex: 1,
                      minWidth: 140,
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 14,
                    }}
                  >
                    <option value='professional'>Professional</option>
                    <option value='friendly'>Friendly</option>
                    <option value='direct'>Direct</option>
                  </select>
                  {sequenceCadence.length > 1 && (
                    <button
                      type='button'
                      onClick={() =>
                        setSequenceCadence((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
                      }
                      style={{ background: 'none', border: 'none', color: '#e55a5a', cursor: 'pointer', fontSize: 13 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type='button'
              onClick={() =>
                setSequenceCadence((prev) => [
                  ...prev,
                  { day: (prev[prev.length - 1]?.day ?? 1) + 3, tone: 'professional' },
                ])
              }
              style={{
                background: 'none',
                border: 'none',
                color: '#2d6a1f',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                marginBottom: 16,
                padding: 0,
              }}
            >
              + Add another email
            </button>
            <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 6 }}>Context</label>
            <textarea
              value={sequenceContext}
              onChange={(e) => setSequenceContext(e.target.value)}
              placeholder='Notes about your conversation…'
              style={{
                width: '100%',
                minHeight: 88,
                border: '1px solid #e8e8e8',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 14,
                marginBottom: 16,
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
            <button
              type='button'
              disabled={sequenceLoading}
              onClick={async () => {
                if (!sequenceDrawerContact || !user?.id) return;
                setSequenceLoading(true);
                setSequenceEmails(null);
                try {
                  const res = await fetch('/api/sequence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contacts: [sequenceDrawerContact],
                      cadence: sequenceCadence.map((c) => ({ day: c.day, tone: c.tone })),
                      context: sequenceContext.trim() || undefined,
                    }),
                  });
                  const data = await res.json();
                  const row = (data.results as { contactId: string; emails: { day: number; subject: string; body: string }[] }[])?.find(
                    (r) => r.contactId === sequenceDrawerContact.id
                  );
                  setSequenceEmails(row?.emails ?? []);
                } catch (err) {
                  console.error(err);
                  showToast('Generation failed', 'error');
                } finally {
                  setSequenceLoading(false);
                }
              }}
              style={{
                width: '100%',
                background: sequenceLoading ? '#ccc' : '#1a3a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: sequenceLoading ? 'not-allowed' : 'pointer',
                marginBottom: 20,
              }}
            >
              {sequenceLoading ? 'Generating…' : 'Generate'}
            </button>

            {sequenceEmails && sequenceEmails.length > 0 && (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#999', textTransform: 'uppercase', margin: '0 0 10px' }}>
                  Generated emails
                </p>
                {sequenceEmails.map((em, i) => {
                  const exp = sequenceDrawerExpanded[i] ?? false;
                  const preview = em.body.length > 140 ? `${em.body.slice(0, 140)}…` : em.body;
                  const editing = sequenceDrawerEditIdx === i;
                  return (
                    <div
                      key={i}
                      style={{
                        border: '1px solid #ebebeb',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 10,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#2d6a1f' }}>Day {em.day}</div>
                      {!editing ? (
                        <>
                          <div style={{ fontSize: 14, fontWeight: 600, margin: '6px 0' }}>{em.subject}</div>
                          <pre
                            style={{
                              fontSize: 13,
                              color: '#444',
                              whiteSpace: 'pre-wrap',
                              fontFamily: 'inherit',
                              margin: 0,
                            }}
                          >
                            {exp ? em.body : preview}
                          </pre>
                          {em.body.length > 140 && (
                            <button
                              type='button'
                              onClick={() => setSequenceDrawerExpanded((p) => ({ ...p, [i]: !exp }))}
                              style={{
                                marginTop: 6,
                                background: 'none',
                                border: 'none',
                                color: '#2d6a1f',
                                cursor: 'pointer',
                                fontSize: 12,
                              }}
                            >
                              {exp ? 'Show less' : 'Show full body'}
                            </button>
                          )}
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              type='button'
                              onClick={() =>
                                void navigator.clipboard.writeText(`Subject: ${em.subject}\n\n${em.body}`)
                              }
                              style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                background: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              Copy
                            </button>
                            <button
                              type='button'
                              onClick={() => setSequenceDrawerEditIdx(i)}
                              style={{
                                border: '1px solid #e8e8e8',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                background: '#fff',
                                cursor: 'pointer',
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <input
                            value={em.subject}
                            onChange={(e) =>
                              setSequenceEmails((prev) =>
                                prev
                                  ? prev.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x))
                                  : prev
                              )
                            }
                            style={{
                              width: '100%',
                              marginBottom: 8,
                              border: '1px solid #e8e8e8',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 14,
                              boxSizing: 'border-box',
                            }}
                          />
                          <textarea
                            value={em.body}
                            onChange={(e) =>
                              setSequenceEmails((prev) =>
                                prev ? prev.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) : prev
                              )
                            }
                            style={{
                              width: '100%',
                              minHeight: 120,
                              border: '1px solid #e8e8e8',
                              borderRadius: 8,
                              padding: '8px 10px',
                              fontSize: 14,
                              boxSizing: 'border-box',
                            }}
                          />
                          <button
                            type='button'
                            onClick={() => setSequenceDrawerEditIdx(null)}
                            style={{
                              marginTop: 8,
                              background: '#1a3a2a',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              padding: '8px 14px',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            Done
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type='button'
                  disabled={sequenceSaving}
                  onClick={async () => {
                    if (!sequenceDrawerContact || !user?.id || !sequenceEmails?.length) return;
                    setSequenceSaving(true);
                    try {
                      const payload = {
                        generatedAt: new Date().toISOString(),
                        cadence: sequenceCadence.map((c) => ({ day: c.day, tone: c.tone })),
                        emails: sequenceEmails,
                        context: sequenceContext.trim() || undefined,
                      };
                      const { error } = await supabase
                        .from('contacts')
                        .update({ sequences: payload })
                        .eq('id', sequenceDrawerContact.id)
                        .eq('user_id', user.id);
                      if (error) {
                        console.error(error);
                        showToast('Could not save sequence', 'error');
                        return;
                      }
                      showToast('Sequence saved to contact', 'success');
                      await fetchContacts();
                      setSequenceDrawerContact(null);
                    } finally {
                      setSequenceSaving(false);
                    }
                  }}
                  style={{
                    width: '100%',
                    background: sequenceSaving ? '#ccc' : '#7dde3c',
                    color: '#0a1a0a',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: sequenceSaving ? 'not-allowed' : 'pointer',
                    marginTop: 8,
                  }}
                >
                  {sequenceSaving ? 'Saving…' : 'Save to contact'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

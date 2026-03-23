'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function ContactsPage() {
  const searchParams = useSearchParams();
  const eventFromUrl = searchParams.get('event');

  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterEvent, setFilterEvent] = useState<string>('all');

  const [selected, setSelected] = useState<Contact | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error' | 'warning'>('success');

  const [signalLabels, setSignalLabels] = useState<string[]>(DEFAULT_SIGNAL_LABELS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ succeeded: number; failed: number } | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; name: string }>>([]);
  const [isMobile, setIsMobile] = useState(false);

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

    const fetch = async () => {
      setLoading(true);
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
        setLoading(false);
        return;
      }

      setContacts(((data as unknown) as Contact[]) || []);
      setEvents(eventsData || []);
      setLoading(false);
    };

    fetch();
  }, [user?.id]);

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
            setContacts(((data as unknown) as Contact[]) || []);
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
    return events.find((e) => e.id === eventId)?.name || null;
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

  const syncToHubSpot = async () => {
    if (selectedIds.length === 0) return;
    setIsSyncing(true);

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

      const data = await res.json();

      if (res.status === 401) {
        showToast('HubSpot not connected. Go to Settings → Integrations.', 'error');
        return;
      }

      if (!res.ok) throw new Error('Sync failed');

      setSyncResult({ succeeded: data.succeeded, failed: data.failed });

      if (data.failed === 0) {
        showToast(
          `${data.succeeded} contact${data.succeeded !== 1 ? 's' : ''} synced to HubSpot!`,
          'success'
        );
      } else {
        showToast(`${data.succeeded} synced, ${data.failed} failed.`, 'warning');
      }
    } catch (err) {
      console.error('HubSpot sync error:', err);
      showToast('Sync failed. Please try again.', 'error');
    } finally {
      setIsSyncing(false);
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

  const allEventNames = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.event).filter(Boolean))) as string[],
    [contacts]
  );

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

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    const idsToDelete = [...selectedIds];
    const { error } = await supabase.from('contacts').delete().in('id', idsToDelete);
    if (error) {
      console.error('Bulk delete error:', error);
      return;
    }
    setContacts((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
    setSelectedIds([]);
    showToast(`${idsToDelete.length} contacts deleted`, 'success');
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

  if (!user) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f0' }} />;
  }

  return (
    <div
      className='max-w-2xl mx-auto'
      style={{
        overflowX: 'hidden',
        maxWidth: '100vw',
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
                const visibleIds = filteredContacts.map((c) => c.id);
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
                const visibleIds = filteredContacts.map((c) => c.id);
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

      <div style={{ marginBottom: 16 }}>
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

      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? 4 : 0,
            WebkitOverflowScrolling: isMobile ? 'touch' : undefined,
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
              {getEventName(eventId) || eventId}
            </button>
          ))}
        </div>
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
            className='px-4 py-2 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors inline-block'
            style={{
              color: '#1a2e1a',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            Scan first contact
          </Link>
        </div>
      )}

      {!loading && (
      <div
        style={{
          marginTop: 16,
          background: 'transparent',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {filteredContacts.map((contact) => {
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

          const isSelected = selectedIds.includes(contact.id);
          const initials = (contact.name || '?')
            .toString()
            .trim()
            .charAt(0)
            .toUpperCase();

          const eventLabel = getEventName(contact.event);

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
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
                borderRadius: 16,
                borderBottomLeftRadius: 16,
                borderBottomRightRadius: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                borderLeft: leftBorder,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '14px 18px',
                }}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIds((prev) =>
                      prev.includes(contact.id)
                        ? prev.filter((id) => id !== contact.id)
                        : [...prev, contact.id]
                    );
                  }}
                  style={{
                    width: isMobile ? 22 : 20,
                    height: isMobile ? 22 : 20,
                    borderRadius: 4,
                    border: '1.5px solid #dddddd',
                    background: isSelected ? '#7dde3c' : '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isSelected && (
                    <svg
                      width='12'
                      height='12'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='white'
                      strokeWidth='3'
                    >
                      <polyline points='20 6 9 17 4 12' />
                    </svg>
                  )}
                </div>
                {contact.image ? (
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
                ) : (
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
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      letterSpacing: '-0.01em',
                      color: '#111',
                    }}
                  >
                    {contact.name}
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: 400,
                      color: '#555',
                      marginTop: 1,
                      marginBottom: 0,
                    }}
                  >
                    {contact.title} · {contact.company}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginTop: 6,
                    }}
                  >
                    {eventLabel ? (
                      <span
                        style={{
                          background: 'rgba(0,0,0,0.05)',
                          color: '#666',
                          fontSize: '11px',
                          padding: '3px 9px',
                          borderRadius: 999,
                        }}
                      >
                        {eventLabel}
                      </span>
                    ) : null}
                    {contact.synced_to_hubspot === true && (
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
                    )}
                    {contact.enriched && (
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 400,
                          color: '#7ab648',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <svg
                          width='9'
                          height='9'
                          fill='currentColor'
                          viewBox='0 0 20 20'
                        >
                          <circle cx='10' cy='10' r='4' fill='#7ab648' />
                        </svg>
                        Enriched
                      </span>
                    )}
                    {contact.checks && contact.checks.length > 0 && (
                      <span
                        style={{
                          background: '#f0f7eb',
                          color: '#2d6a1f',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 9px',
                          borderRadius: 999,
                        }}
                      >
                        {contact.checks.length} signal
                        {contact.checks.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: badgeBg,
                    color: badgeColor,
                    flexShrink: 0,
                  }}
                >
                  {scoreNum == null ? '—' : scoreNum}
                </span>
              </div>

              {selected?.id === contact.id && (
                <div
                  style={{
                    padding: '0 18px 18px',
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                    marginTop: 8,
                    paddingTop: 16,
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
                      {contact.image && (
                        <img
                          src={contact.image as string}
                          alt={contact.name || 'Contact'}
                          style={{
                            width: '100%',
                            maxHeight: 300,
                            objectFit: 'contain',
                            objectPosition: 'center center',
                            borderRadius: 12,
                            marginBottom: 16,
                            display: 'block',
                            background: '#f7f7f5',
                          }}
                        />
                      )}
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
                            {getEventName(contact.event) || '—'}
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
                          display: 'flex',
                          gap: 8,
                          marginTop: 16,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          flexDirection: isMobile ? 'column' : 'row',
                          width: isMobile ? '100%' : 'auto',
                        }}
                      >
                        <Link
                          href={`/sequences?contactId=${contact.id}`}
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
                            textDecoration: 'none',
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 44 : undefined,
                          }}
                        >
                          Generate Sequence
                        </Link>
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
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {selectedIds.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? 80 : 24,
            left: isMobile ? 12 : '50%',
            right: isMobile ? 12 : 'auto',
            transform: isMobile ? 'none' : 'translateX(-50%)',
            background: 'rgba(20, 20, 20, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 999,
            padding: isMobile ? '8px 10px' : '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 6 : 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <button
            type='button'
            onClick={() => {
              const visibleIds = filteredContacts.map((c) => c.id);
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
              fontSize: isMobile ? 11 : 13,
              cursor: 'pointer',
              paddingRight: 6,
              minHeight: isMobile ? 44 : undefined,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {(() => {
              const visibleIds = filteredContacts.map((c) => c.id);
              const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
              return isMobile ? (allSelected ? 'None' : 'All') : allSelected ? 'Deselect all' : 'Select all';
            })()}
          </button>
          <span
            style={{
              color: '#ffffff',
              fontSize: isMobile ? 11 : 13,
              fontWeight: 600,
              paddingRight: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isMobile ? `${selectedIds.length} sel` : `${selectedIds.length} selected`}
          </span>
          <button
            type='button'
            onClick={() => {
              showToast('Opening sequences...', 'success');
              window.location.href = '/sequences';
            }}
            style={{
              background: '#7dde3c',
              color: '#0a1a0a',
              borderRadius: 999,
              padding: isMobile ? '6px 10px' : '8px 18px',
              fontSize: isMobile ? 11 : 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              minHeight: isMobile ? 44 : undefined,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isMobile ? 'Sequences' : 'Generate Sequences'}
          </button>
          <button
            type='button'
            onClick={() => void syncToHubSpot()}
            disabled={isSyncing}
            style={{
              background: '#ff7a59',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              borderRadius: '999px',
              padding: '8px 16px',
              border: 'none',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: isMobile ? 44 : undefined,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: isSyncing ? 0.7 : 1,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '13px' }}>H</span>
            {isSyncing ? 'Syncing...' : 'Sync to HubSpot'}
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
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 999,
              padding: isMobile ? '6px 10px' : '8px 18px',
              fontSize: isMobile ? 11 : 13,
              cursor: 'pointer',
              minHeight: isMobile ? 44 : undefined,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {isMobile ? 'Export' : 'Export CSV'}
          </button>
          <button
            type='button'
            onClick={handleBulkDelete}
            style={{
              background: 'rgba(229,90,90,0.15)',
              color: '#e55a5a',
              border: '1px solid rgba(229,90,90,0.2)',
              borderRadius: 999,
              padding: isMobile ? '6px 10px' : '8px 18px',
              fontSize: isMobile ? 11 : 13,
              cursor: 'pointer',
              minHeight: isMobile ? 44 : undefined,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

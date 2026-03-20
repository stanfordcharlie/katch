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

const getLeadBorderColor = (score: number | null | undefined): string => {
  if (score == null || Number.isNaN(score) || score === 0) return '#e8e8e8';
  if (score >= 7) return '#7ab648';
  if (score >= 4) return '#f59e3f';
  return '#e55a5a';
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

  const [signalLabels, setSignalLabels] = useState<string[]>(DEFAULT_SIGNAL_LABELS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [events, setEvents] = useState<any[]>([]);
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
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Contacts fetch error:', error);
        setLoading(false);
        return;
      }

      setContacts(((data as unknown) as Contact[]) || []);
      setLoading(false);
    };

    fetch();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('events')
      .select('id, name')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .then(({ data }) => {
        if (data) setEvents(data as any[]);
      });
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

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
    setToast('Contact updated');
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
    setToast(`${idsToDelete.length} contacts deleted`);
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
    return <div style={{ minHeight: '100vh', backgroundColor: '#f7f7f5' }} />;
  }

  return (
    <div
      className='max-w-2xl mx-auto'
      style={{
        overflowX: 'hidden',
        maxWidth: '100vw',
        padding: isMobile ? '20px 16px 100px' : '32px 36px',
        fontFamily: 'Inter, -apple-system, sans-serif',
        backgroundColor: '#f7f7f5',
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
            background: '#7dde3c',
            color: '#0a1a0a',
            borderRadius: '10px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 600,
            zIndex: 1000,
          }}
        >
          {toast}
        </div>
      )}

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
              fontFamily: 'Inter, sans-serif',
              fontSize: isMobile ? 22 : 28,
              fontWeight: 700,
              letterSpacing: '-0.5px',
              color: '#111111',
              margin: 0,
            }}
          >
            Contacts
          </h1>
          <p
            style={{
              fontSize: 13,
              color: '#999999',
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
                fontSize: 13,
                color: '#7dde3c',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                fontWeight: 500,
                padding: '0 12px',
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
              fontSize: 14,
              fontWeight: 600,
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
        <div style={{ position: 'relative' }}>
          <svg
            width='12'
            height='12'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
            strokeWidth='2'
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#c0c0c0',
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
              paddingLeft: 32,
              paddingRight: 12,
              height: isMobile ? 44 : 42,
              fontSize: isMobile ? 15 : 14,
              borderRadius: 10,
              border: '1px solid #ebebeb',
              backgroundColor: '#ffffff',
              outline: 'none',
              color: '#111111',
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
              background: filterEvent === 'all' ? '#1a3a2a' : '#ffffff',
              color: filterEvent === 'all' ? '#7ab648' : '#666666',
              border:
                filterEvent === 'all'
                  ? '1px solid #1a3a2a'
                  : '1px solid #e8e8e8',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13,
              cursor: 'pointer',
              minHeight: isMobile ? 44 : undefined,
              flexShrink: isMobile ? 0 : 1,
            }}
          >
            All
          </button>
          {allEventNames.map((name) => (
            <button
              key={name}
              type='button'
              onClick={() => setFilterEvent(name)}
              style={{
                background: filterEvent === name ? '#1a3a2a' : '#ffffff',
                color: filterEvent === name ? '#7ab648' : '#666666',
                border:
                  filterEvent === name
                    ? '1px solid #1a3a2a'
                    : '1px solid #e8e8e8',
                borderRadius: 999,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
                minHeight: isMobile ? 44 : undefined,
                flexShrink: isMobile ? 0 : 1,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className='text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50'>
          <div className='animate-pulse flex flex-col items-center gap-3'>
            <div className='w-12 h-12 bg-slate-200 rounded-full' />
            <div className='h-4 w-32 bg-slate-200 rounded' />
            <div className='h-3 w-48 bg-slate-100 rounded' />
          </div>
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
          <p className='text-slate-500 text-sm font-medium mb-1'>No contacts yet</p>
          <p className='text-slate-400 text-xs mb-4'>
            Scan your first badge or card to get started
          </p>
          <Link
            href='/scan'
            className='px-4 py-2 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] text-xs font-medium hover:bg-[#f7faf4] hover:text-[#1a2e1a] transition-colors inline-block'
            style={{ color: '#1a2e1a' }}
          >
            Scan first contact
          </Link>
        </div>
      )}

      <div style={{ marginTop: 8 }}>
        {filteredContacts.map((contact) => {
          const rawScore =
            (contact.lead_score ??
              contact.leadScore ??
              null) as number | null | undefined;
          const borderColor = getLeadBorderColor(
            rawScore == null ? null : Number(rawScore)
          );

          const isSelected = selectedIds.includes(contact.id);
          const initials = (contact.name || '?')
            .toString()
            .trim()
            .charAt(0)
            .toUpperCase();

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
                backgroundColor: '#ffffff',
                borderRadius: 12,
                marginBottom: 8,
                padding: isMobile ? '14px 16px' : '16px 20px',
                border: '1px solid #f0f0f0',
                borderLeft: `4px solid ${borderColor}`,
              }}
            >
              <div className='flex items-center gap-3'>
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
                      width: isMobile ? 48 : 56,
                      height: isMobile ? 48 : 56,
                      borderRadius: 8,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: isMobile ? 48 : 56,
                      height: isMobile ? 48 : 56,
                      borderRadius: 8,
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        color: '#999',
                        fontWeight: 500,
                      }}
                    >
                      {initials}
                    </span>
                  </div>
                )}
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: '#111111',
                      }}
                    >
                      {contact.name}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: '#888888',
                      marginTop: 2,
                    }}
                  >
                    {contact.title} · {contact.company}
                  </p>
                  <div className='flex items-center gap-2 mt-1 flex-wrap'>
                    {contact.event && contact.event !== 'Untagged' && (
                      <span
                        style={{
                          background: '#f5f5f5',
                          color: '#888888',
                          borderRadius: 6,
                          fontSize: 11,
                          padding: '2px 8px',
                        }}
                      >
                        {contact.event}
                      </span>
                    )}
                    {contact.enriched && (
                      <span
                        style={{
                          fontSize: isMobile ? 11 : 12,
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
                          fontSize: isMobile ? 11 : 12,
                          backgroundColor: '#f0f7eb',
                          color: '#2d6a1f',
                          borderRadius: 999,
                          padding: '2px 8px',
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
                    fontSize: 12,
                    color: '#aaaaaa',
                    flexShrink: 0,
                  }}
                >
                  {contact.date}
                </span>
              </div>

              {selected?.id === contact.id && (
                <div
                  className='px-4 pb-4 border-t border-slate-100 pt-4 space-y-3 cursor-pointer'
                  onClick={(e) => e.stopPropagation()}
                >
                  {editingContactId === contact.id && editForm ? (
                    <div className='space-y-4 rounded-2xl border border-[#dce8d0] bg-[#f0f0ec] p-4'>
                      <p className='text-xs font-semibold text-slate-500 uppercase tracking-wider'>
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
                            <label className='mb-0.5 block text-xs text-slate-500'>
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
                                  fontSize: 14,
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
                                className='w-full rounded-lg border border-[#dce8d0] bg-white px-3 py-2 text-sm outline-none focus:border-[#7ab648]'
                                style={{ color: '#1a2e1a' }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className='mb-0.5 block text-xs text-slate-500'>
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
                          className='w-full rounded-lg border border-[#dce8d0] bg-white p-3 text-sm outline-none resize-none focus:border-[#7ab648]'
                          style={{ color: '#1a2e1a' }}
                        />
                      </div>
                      <div>
                        <p className='text-xs text-slate-500 mb-2 font-medium'>
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
                          <span className='text-xs text-slate-600 w-8 text-right'>
                            {editForm.lead_score}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className='text-xs text-slate-500 mb-2.5 font-medium'>
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
                                className={`text-sm ${
                                  editForm.checks.includes(label)
                                    ? 'text-slate-800 font-medium'
                                    : 'text-slate-500'
                                }`}
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
                          className='flex-1 px-3 py-2 rounded-full border border-[#1a3a2a] bg-[#f0f0ec] text-xs font-medium transition-colors hover:bg-[#f7faf4] hover:text-[#1a2e1a]'
                          style={{ color: '#1a2e1a' }}
                        >
                          Save changes
                        </button>
                        <button
                          type='button'
                          onClick={cancelEditing}
                          className='px-3 py-2 rounded-full border border-[#dce8d0] bg-white text-xs font-medium text-slate-600 hover:bg-[#f7faf4] transition-colors'
                          style={{ color: '#1a2e1a' }}
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
                      <div className='grid grid-cols-2 gap-3' style={{ gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}>
                        {contact.email && (
                          <div>
                            <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                              Email
                            </p>
                            <p className='text-sm text-slate-700' style={{ fontSize: 14, color: '#111' }}>
                              {contact.email}
                            </p>
                          </div>
                        )}
                        {contact.phone && (
                          <div>
                            <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                              Phone
                            </p>
                            <p className='text-sm text-slate-700' style={{ fontSize: 14, color: '#111' }}>
                              {contact.phone}
                            </p>
                          </div>
                        )}
                        {contact.linkedin && (
                          <div>
                            <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                              LinkedIn
                            </p>
                            <p className='text-sm text-slate-700 truncate' style={{ fontSize: 14, color: '#111' }}>
                              {contact.linkedin}
                            </p>
                          </div>
                        )}
                        {contact.company && (
                          <div>
                            <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                              Company
                            </p>
                            <p className='text-sm text-slate-700' style={{ fontSize: 14, color: '#111' }}>
                              {contact.company}
                            </p>
                          </div>
                        )}
                        {contact.title && (
                          <div>
                            <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                              Title
                            </p>
                            <p className='text-sm text-slate-700' style={{ fontSize: 14, color: '#111' }}>
                              {contact.title}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                            Event
                          </p>
                          <p className='text-sm text-slate-700' style={{ fontSize: 14, color: '#111' }}>
                            {contact.event ?? '—'}
                          </p>
                        </div>
                        <div>
                          <p className='text-xs text-slate-400 mb-0.5' style={{ fontSize: 12, color: '#999' }}>
                            Lead Score
                          </p>
                          <p className='text-sm text-slate-700' style={{ fontSize: 14, color: '#111' }}>
                            {rawScore ?? '—'}
                          </p>
                        </div>
                      </div>
                      {contact.checks && contact.checks.length > 0 && (
                        <div>
                          <p className='text-xs text-slate-400 mb-2'>
                            Signals
                          </p>
                          <div className='space-y-1'>
                            {contact.checks.map((c, i) => (
                              <div
                                key={i}
                                className='flex items-center gap-2 text-xs text-slate-700'
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
                        <div>
                          <p className='text-xs text-slate-400 mb-1'>Notes</p>
                          <p className='text-sm text-slate-700 bg-slate-50 rounded-lg p-3 leading-relaxed'>
                            {(contact.free_note ?? contact.freeNote) as string}
                          </p>
                        </div>
                      )}
                      <div className='flex gap-2 pt-1 flex-wrap items-center' style={{ flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center' }}>
                        <Link
                          href={`/sequences?contactId=${contact.id}`}
                          style={{
                            background: '#7dde3c',
                            color: '#0a1a0a',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            textDecoration: 'none',
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 44 : undefined,
                            marginBottom: isMobile ? 8 : 0,
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
                            background: '#ffffff',
                            color: '#111111',
                            border: '1px solid #e8e8e8',
                            borderRadius: '10px',
                            padding: '9px 16px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            width: isMobile ? '100%' : 'auto',
                            minHeight: isMobile ? 44 : undefined,
                            marginBottom: isMobile ? 8 : 0,
                          }}
                        >
                          Edit
                        </button>
                        {confirmDeleteId === contact.id ? (
                          <div className='flex items-center gap-2 flex-wrap' style={{ width: isMobile ? '100%' : 'auto' }}>
                            <span className='text-xs text-slate-500'>
                              Delete this contact?
                            </span>
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteContact(contact);
                              }}
                              style={{
                                background: '#ffffff',
                                color: '#e55a5a',
                                border: '1px solid #fde8e8',
                                borderRadius: '10px',
                                padding: '9px 16px',
                                fontSize: '13px',
                                fontWeight: 500,
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
                                background: '#ffffff',
                                color: '#111111',
                                border: '1px solid #e8e8e8',
                                borderRadius: '10px',
                                padding: '9px 16px',
                                fontSize: '13px',
                                fontWeight: 500,
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
                              background: '#ffffff',
                              color: '#e55a5a',
                              border: '1px solid #fde8e8',
                              borderRadius: '10px',
                              padding: '9px 16px',
                              fontSize: '13px',
                              fontWeight: 500,
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
              setToast('Opening sequences...');
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
              setToast(`Exported ${selectedContacts.length} contacts`);
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

// App state. Plain React context + reducer: one session (the request being
// built right now) and the list of bookings. No persistence by design.

import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';
import seed from '../data/seedBookings.json';
import type { Booking, DraftRequest, ParseResult } from '../lib/types';

export interface Session {
  parse: ParseResult;
  /** Index into parse.drafts of the draft being reviewed. */
  index: number;
  /** Owner confirmed the "cancel my last request" part of the message. */
  cancelLatest: boolean;
  /** Booking ids created in this session, in order. */
  created: string[];
}

interface State {
  bookings: Booking[];
  session: Session | null;
  toast: { id: number; message: string } | null;
}

type Action =
  | { type: 'start'; parse: ParseResult }
  | { type: 'updateDraft'; draft: DraftRequest }
  | { type: 'setCancelLatest'; value: boolean }
  | { type: 'confirm'; booking: Booking; cancelLatestId: string | null }
  | { type: 'advance' }
  | { type: 'end' }
  | { type: 'cancel'; id: string }
  | { type: 'toast'; message: string }
  | { type: 'clearToast' };

const initial: State = {
  bookings: (seed as Booking[]).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  session: null,
  toast: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'start':
      return { ...state, session: { parse: action.parse, index: 0, cancelLatest: action.parse.intent === 'cancel_and_book', created: [] } };
    case 'updateDraft': {
      if (!state.session) return state;
      const drafts = state.session.parse.drafts.map((d) => (d.id === action.draft.id ? action.draft : d));
      return { ...state, session: { ...state.session, parse: { ...state.session.parse, drafts } } };
    }
    case 'setCancelLatest':
      return state.session ? { ...state, session: { ...state.session, cancelLatest: action.value } } : state;
    case 'confirm': {
      const bookings = state.bookings.map((b) => (b.id === action.cancelLatestId ? { ...b, status: 'cancelled' as const } : b));
      return {
        ...state,
        bookings: [action.booking, ...bookings],
        session: state.session ? { ...state.session, created: [...state.session.created, action.booking.id], cancelLatest: false } : null,
      };
    }
    case 'advance':
      return state.session ? { ...state, session: { ...state.session, index: state.session.index + 1 } } : state;
    case 'end':
      return { ...state, session: null };
    case 'cancel':
      return { ...state, bookings: state.bookings.map((b) => (b.id === action.id ? { ...b, status: 'cancelled' } : b)) };
    case 'toast':
      return { ...state, toast: { id: Date.now(), message: action.message } };
    case 'clearToast':
      return { ...state, toast: null };
    default:
      return state;
  }
}

interface Ctx extends State {
  startSession: (parse: ParseResult) => void;
  updateDraft: (draft: DraftRequest) => void;
  setCancelLatest: (value: boolean) => void;
  confirmBooking: (draft: DraftRequest, partnerIds: string[], summary: string) => Booking;
  advance: () => void;
  endSession: () => void;
  cancelBooking: (id: string) => void;
  notify: (message: string) => void;
  clearToast: () => void;
  /** The most recent booking that is still confirmed, used by "cancel my last request". */
  latestActive: Booking | null;
  currentDraft: DraftRequest | null;
}

const BookingsContext = createContext<Ctx | null>(null);

export function BookingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  const latestActive = useMemo(
    () => state.bookings.find((b) => b.status === 'confirmed' && !(state.session?.created ?? []).includes(b.id)) ?? null,
    [state.bookings, state.session?.created],
  );

  const notify = useCallback((message: string) => {
    // Push notifications are out of scope: a log line plus an in-app toast.
    console.log(`[notification] ${message}`);
    dispatch({ type: 'toast', message });
  }, []);

  const confirmBooking = useCallback(
    (draft: DraftRequest, partnerIds: string[], summary: string): Booking => {
      const booking: Booking = {
        id: `b-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        status: 'confirmed',
        draft,
        partnerIds,
        summary,
      };
      const cancelId = state.session?.cancelLatest ? latestActive?.id ?? null : null;
      dispatch({ type: 'confirm', booking, cancelLatestId: cancelId });
      return booking;
    },
    [latestActive, state.session?.cancelLatest],
  );

  const value: Ctx = {
    ...state,
    startSession: (parse) => dispatch({ type: 'start', parse }),
    updateDraft: (draft) => dispatch({ type: 'updateDraft', draft }),
    setCancelLatest: (v) => dispatch({ type: 'setCancelLatest', value: v }),
    confirmBooking,
    advance: () => dispatch({ type: 'advance' }),
    endSession: () => dispatch({ type: 'end' }),
    cancelBooking: (id) => dispatch({ type: 'cancel', id }),
    notify,
    clearToast: () => dispatch({ type: 'clearToast' }),
    latestActive,
    currentDraft: state.session ? state.session.parse.drafts[state.session.index] ?? null : null,
  };

  return <BookingsContext.Provider value={value}>{children}</BookingsContext.Provider>;
}

export function useBookings(): Ctx {
  const ctx = useContext(BookingsContext);
  if (!ctx) throw new Error('useBookings must be used inside BookingsProvider');
  return ctx;
}

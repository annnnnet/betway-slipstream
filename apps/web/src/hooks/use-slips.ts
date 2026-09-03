'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ConvertResponse,
  CreateSlipRequest,
  CreateSlipResponse,
  EventMarketsResponse,
  CatalogueEvent,
  Region,
  ResolveResponse,
  Sport,
} from '@slipstream/shared';
import { api } from '@/lib/api';

export interface HistoryEntry {
  id: string;
  kind: 'RESOLVE' | 'CREATE' | 'CONVERT';
  code: string;
  sourceCode: string | null;
  selectionCount: number;
  combinedOdds: number;
  verified: boolean | null;
  createdAt: string;
}

export function useSlip(code: string | null) {
  return useQuery({
    queryKey: ['slip', code],
    queryFn: () => api.get<ResolveResponse>(`/api/slips/${encodeURIComponent(code!)}`),
    enabled: Boolean(code),
    // A booking code is immutable in its legs; only the prices move. One
    // retry covers the transient upstream blips we saw while building, and
    // no more than that — a genuinely invalid code should say so at once
    // rather than after three rounds of spinner.
    retry: 1,
    staleTime: 30_000,
  });
}

export function useCreateSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSlipRequest) => api.post<CreateSlipResponse>('/api/slips', body),
    onSuccess: (res) => {
      // Seed the cache so navigating to the new code's page is instant and
      // does not spend another upstream call on something we just resolved.
      qc.setQueryData(['slip', res.slip.code], { slip: res.slip });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useConvertSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      api.post<ConvertResponse>(`/api/slips/${encodeURIComponent(code)}/convert`),
    onSuccess: (res) => {
      qc.setQueryData(['slip', res.converted.code], { slip: res.converted });
      qc.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useHistory(enabled: boolean) {
  return useQuery({
    queryKey: ['history'],
    queryFn: () => api.get<HistoryEntry[]>('/api/slips/history'),
    enabled,
  });
}

// --- catalogue (the builder) ------------------------------------------------

export function useSports() {
  return useQuery({
    queryKey: ['sports'],
    queryFn: () => api.get<{ sports: Sport[] }>('/api/catalogue/sports'),
    staleTime: Infinity, // a fixed list on our side, not Betway's
  });
}

export function useRegions(sportId: string | null) {
  return useQuery({
    queryKey: ['regions', sportId],
    queryFn: () => api.get<{ regions: Region[] }>(`/api/catalogue/sports/${sportId}/regions`),
    enabled: Boolean(sportId),
    staleTime: 10 * 60_000, // leagues change on the scale of seasons
  });
}

export function useEvents(params: { sportId: string; regionId: string; leagueId: string } | null) {
  return useQuery({
    queryKey: ['events', params],
    queryFn: () => {
      const q = new URLSearchParams(params as Record<string, string>);
      return api.get<{ events: CatalogueEvent[] }>(`/api/catalogue/events?${q}`);
    },
    enabled: Boolean(params),
    staleTime: 60_000,
  });
}

export function useEventMarkets(eventId: number | null) {
  return useQuery({
    queryKey: ['markets', eventId],
    queryFn: () => api.get<EventMarketsResponse>(`/api/catalogue/events/${eventId}/markets`),
    enabled: Boolean(eventId),
    // Prices move continuously, and a stale price here becomes a booking code
    // whose odds do not match what the user thought they picked.
    staleTime: 15_000,
  });
}

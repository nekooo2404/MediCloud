'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {
  type AppointmentItem,
  type AuditEventItem,
  type EncounterItem,
  fetchWorkspaceSlice,
  type ObservationItem,
  postWorkspaceMutation,
  type QueueTicketItem,
  type SliceFilterOptions,
  WorkspaceClientError,
  type WorkspaceListSlice,
  type WorkspaceOverviewData,
  type WorkspaceResource,
} from '@/lib/api/workspace-client';

export interface WorkspaceSlicesState {
  overview: WorkspaceOverviewData | null;
  appointments: WorkspaceListSlice<AppointmentItem> | null;
  queue: WorkspaceListSlice<QueueTicketItem> | null;
  records: WorkspaceListSlice<EncounterItem> | null;
  vitals: WorkspaceListSlice<ObservationItem> | null;
  audit: WorkspaceListSlice<AuditEventItem> | null;
}

const MUTATION_INVALIDATION: Record<string, WorkspaceResource[]> = {
  book_appointment: ['overview', 'appointments', 'queue'],
  cancel_appointment: ['overview', 'appointments', 'queue'],
  reschedule_appointment: ['overview', 'appointments', 'queue'],
  mark_no_show: ['overview', 'appointments', 'queue'],
  check_in: ['overview', 'appointments', 'queue'],
  queue_transition: ['overview', 'queue', 'appointments'],
  publish_schedule: ['overview'],
  create_encounter: ['overview', 'queue', 'records', 'appointments'],
  record_observation: ['overview', 'queue', 'records', 'vitals'],
  amend_observation: ['overview', 'queue', 'records', 'vitals'],
  complete_encounter: ['overview', 'queue', 'records', 'vitals', 'appointments'],
  cancel_encounter: ['overview', 'queue', 'records', 'appointments'],
};

export function useWorkspaceData(role: 'patient' | 'staff', activeResource: WorkspaceResource) {
  const [tenantCode, setTenantCode] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<Partial<Record<WorkspaceResource, SliceFilterOptions>>>({});
  const [slices, setSlices] = useState<WorkspaceSlicesState>({
    overview: null,
    appointments: null,
    queue: null,
    records: null,
    vitals: null,
    audit: null,
  });
  const [loadingMap, setLoadingMap] = useState<Partial<Record<WorkspaceResource, boolean>>>({overview: true});
  const [error, setError] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const abortControllers = useRef<Partial<Record<WorkspaceResource, AbortController>>>({});
  const inFlightMutation = useRef<string | null>(null);
  const loadedResources = useRef<Set<WorkspaceResource>>(new Set());

  const loadSlice = useCallback(
    async (resource: WorkspaceResource, overrideFilters?: SliceFilterOptions, appendCursor = false) => {
      abortControllers.current[resource]?.abort();
      const controller = new AbortController();
      abortControllers.current[resource] = controller;

      setLoadingMap((prev) => ({...prev, [resource]: true}));
      try {
        const mergedFilters: SliceFilterOptions = {
          ...(filters[resource] ?? {}),
          ...(overrideFilters ?? {}),
          tenantCode: overrideFilters?.tenantCode ?? tenantCode,
        };
        if (resource === 'overview') {
          const data = await fetchWorkspaceSlice<WorkspaceOverviewData>('overview', mergedFilters, controller.signal);
          setSlices((prev) => ({...prev, overview: data}));
        } else {
          const data = await fetchWorkspaceSlice<WorkspaceListSlice<never>>(resource, mergedFilters, controller.signal);
          setSlices((prev) => {
            const existing = prev[resource] as WorkspaceListSlice<never> | null;
            const mergedData = appendCursor && existing ? [...existing.data, ...data.data] : data.data;
            return {...prev, [resource]: {...data, data: mergedData}};
          });
        }
        loadedResources.current.add(resource);
        setError(null);
      } catch (err) {
        if ((err as {name?: string})?.name === 'AbortError') return;
        const msg =
          err instanceof WorkspaceClientError
            ? err.message
            : 'Không thể tải dữ liệu phân hệ. Vui lòng thử lại.';
        setError(msg);
      } finally {
        setLoadingMap((prev) => ({...prev, [resource]: false}));
      }
    },
    [filters, tenantCode],
  );

  // Initial load for overview
  useEffect(() => {
    void loadSlice('overview');
  }, [loadSlice, tenantCode]);

  // Load currently active tab resource cleanly when switched
  useEffect(() => {
    if (activeResource === 'overview') return;
    if (activeResource === 'queue' && role !== 'staff') return;
    void loadSlice(activeResource);
  }, [activeResource, loadSlice, role, tenantCode]);

  const updateFilter = useCallback(
    (resource: WorkspaceResource, patch: SliceFilterOptions) => {
      setFilters((prev) => {
        const next = {...(prev[resource] ?? {}), ...patch, cursor: undefined};
        void loadSlice(resource, next, false);
        return {...prev, [resource]: next};
      });
    },
    [loadSlice],
  );

  const loadMore = useCallback(
    (resource: Exclude<WorkspaceResource, 'overview'>) => {
      const slice = slices[resource];
      if (!slice?.nextCursor) return;
      void loadSlice(resource, {cursor: slice.nextCursor}, true);
    },
    [loadSlice, slices],
  );

  const switchTenant = useCallback((nextTenantCode: string) => {
    loadedResources.current.clear();
    setSlices({overview: null, appointments: null, queue: null, records: null, vitals: null, audit: null});
    setTenantCode(nextTenantCode);
  }, []);

  const runMutation = useCallback(
    async <T = Record<string, unknown>>(key: string, body: Record<string, unknown>): Promise<T> => {
      if (inFlightMutation.current) {
        throw new WorkspaceClientError(409, 'duplicate_submission', 'Yêu cầu đang được xử lý, vui lòng đợi.');
      }
      inFlightMutation.current = key;
      setMutatingKey(key);
      try {
        const res = await postWorkspaceMutation<T>(body, tenantCode);
        const actionName = String(body.action ?? '');
        const targets = MUTATION_INVALIDATION[actionName] ?? ['overview', activeResource];
        const toRefresh = targets.filter(
          (resName) => resName === 'overview' || resName === activeResource || loadedResources.current.has(resName),
        );
        await Promise.all(
          toRefresh
            .filter((resName) => resName !== 'queue' || role === 'staff')
            .map((resName) => loadSlice(resName)),
        );
        return res;
      } finally {
        inFlightMutation.current = null;
        setMutatingKey(null);
      }
    },
    [activeResource, loadSlice, role, tenantCode],
  );

  return {
    tenantCode,
    switchTenant,
    slices,
    filters,
    updateFilter,
    loadMore,
    reloadSlice: loadSlice,
    loadingMap,
    error,
    setError,
    mutatingKey,
    runMutation,
  };
}

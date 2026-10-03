export type HealthResponse = {
  ok: true;
};

export type Units = 'metric' | 'imperial';

export type MeUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  units: Units;
};

export type MeResponse = {
  user: MeUser;
};

export type Integration = {
  id: string;
  provider: 'strava';
  status: 'active' | 'expired' | 'error' | 'revoked';
  externalUserId: string;
  lastSyncAt: string | null;
};

export type IntegrationsResponse = {
  integrations: Integration[];
};

export type ConnectStravaResponse = {
  url: string;
};

export type ResyncResponse = {
  imported: number;
};

export type Activity = {
  id: string;
  sport: string;
  title: string;
  startedAt: string;
  endedAt: string;
  distanceM: number | null;
  movingTimeS: number | null;
  elapsedTimeS: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  mapPolyline: string | null;
  description: string | null;
  visibility: 'private' | 'public';
  sources: Array<{ provider: 'strava' }>;
};

export type ActivityStreams = {
  latlng: number[][] | null;
  timeS: number[] | null;
  altitudeM: number[] | null;
  heartrate: number[] | null;
};

export type ActivityDetail = Activity & {
  timezone: string | null;
  maxHr: number | null;
  avgSpeedMps: number | null;
  calories: number | null;
  titleOverridden: boolean;
  hydrated: boolean;
  streams: ActivityStreams | null;
};

export type ActivitiesResponse = {
  activities: Activity[];
};

export type Project = {
  id: string;
  name: string;
  sport: string;
  visibility: 'private' | 'public';
  totalDistanceM: number;
  note: string | null;
};

export type ProjectDetail = Project & {
  activities: Activity[];
};

export type PublicProjectShare = ProjectDetail & {
  owner: { name: string; image: string | null };
  units: 'metric' | 'imperial';
};

export type ProjectsResponse = {
  projects: Project[];
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const fetchFn = options.fetch ?? globalThis.fetch;
    const response = await fetchFn(`${baseUrl}${path}`, {
      credentials: 'include',
      ...init,
    });
    if (!response.ok) {
      throw new ApiError(response.status, `Request failed: ${response.status} ${path}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  return {
    health(): Promise<HealthResponse> {
      return request<HealthResponse>('/health');
    },
    me(): Promise<MeResponse> {
      return request<MeResponse>('/v1/me');
    },
    integrations(): Promise<IntegrationsResponse> {
      return request<IntegrationsResponse>('/v1/integrations');
    },
    connectStrava(): Promise<ConnectStravaResponse> {
      return request<ConnectStravaResponse>('/v1/integrations/strava/connect', { method: 'POST' });
    },
    resyncIntegration(id: string): Promise<ResyncResponse> {
      return request<ResyncResponse>(`/v1/integrations/${id}/resync`, { method: 'POST' });
    },
    activities(): Promise<ActivitiesResponse> {
      return request<ActivitiesResponse>('/v1/activities');
    },
    activity(id: string): Promise<ActivityDetail> {
      return request<ActivityDetail>(`/v1/activities/${id}`);
    },
    resyncActivity(id: string): Promise<ActivityDetail> {
      return request<ActivityDetail>(`/v1/activities/${id}/resync`, { method: 'POST' });
    },
    projects(): Promise<ProjectsResponse> {
      return request<ProjectsResponse>('/v1/projects');
    },
    project(id: string): Promise<ProjectDetail> {
      return request<ProjectDetail>(`/v1/projects/${id}`);
    },
    createProject(input: { name: string; sport: string }): Promise<ProjectDetail> {
      return request<ProjectDetail>('/v1/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
    updateProject(id: string, input: { visibility: 'private' | 'public' }): Promise<ProjectDetail> {
      return request<ProjectDetail>(`/v1/projects/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
    publicProject(id: string): Promise<PublicProjectShare> {
      return request<PublicProjectShare>(`/v1/public/projects/${id}`);
    },
    updateActivity(
      id: string,
      input: {
        description?: string | null;
        title?: string | null;
        visibility?: 'private' | 'public';
      },
    ): Promise<ActivityDetail> {
      return request<ActivityDetail>(`/v1/activities/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

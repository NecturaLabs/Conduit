export interface ConfigEntry {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
}

export interface ConfigListResponse {
  configs: ConfigEntry[];
}

export interface ConfigUpdateRequest {
  key: string;
  value: unknown;
}

export interface ConfigUpdateResponse {
  config: ConfigEntry;
  updatedAt: string;
}

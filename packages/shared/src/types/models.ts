export interface ModelInfo {
  providerId: string;
  modelId: string;
  modelName: string;
}

export interface ModelsSyncPayload {
  models: ModelInfo[];
}

export interface ModelsResponse {
  models: ModelInfo[];
}

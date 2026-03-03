export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

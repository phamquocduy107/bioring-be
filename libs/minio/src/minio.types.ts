export interface MinioListObjectsOptions {
  bucket?: string;
  prefix?: string;
  recursive?: boolean;
  maxKeys?: number;
}

export interface MinioObjectSummary {
  name: string;
  size: number;
  etag?: string;
  lastModified?: Date;
}

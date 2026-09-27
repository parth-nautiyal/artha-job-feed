export interface JobPayload {
  title: string;
  company: string;
  location: string;
  experienceMin: number;
  experienceMax: number;
  applyUrl: string;
  skills: string[];
}

export type JobStatus = "active" | "archived";

export interface JobDocument {
  tenantId: string;
  sourceId: string;
  externalJobId: string;
  version: number;
  status: JobStatus;
  payload?: JobPayload;
  createdAt: Date;
  updatedAt: Date;
}
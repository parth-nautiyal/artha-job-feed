import { JOB_STATUS } from "./constants.js";

export interface JobPayload {
  title: string;
  company: string;
  location: string;
  experienceMin: number;
  experienceMax: number;
  applyUrl: string;
  skills: string[];
}

export type JobStatus = typeof JOB_STATUS.ACTIVE | typeof JOB_STATUS.ARCHIVED;

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
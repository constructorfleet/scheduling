/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PolicyCitation } from './PolicyCitation';
export type AuditEvent = {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    policyCitation: PolicyCitation;
    notes?: string;
};


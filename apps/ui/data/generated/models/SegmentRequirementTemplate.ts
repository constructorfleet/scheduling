/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { RatioProfile } from './RatioProfile';
export type SegmentRequirementTemplate = {
    id: string;
    ratioProfile: RatioProfile;
    minStaff: number;
    requiresCpr: boolean;
    requiresMedicalDelegation: boolean;
    requiresLeader: boolean;
    policyCitationId: string;
    notes?: string;
};


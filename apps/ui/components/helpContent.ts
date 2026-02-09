import helpTopicsJson from "./helpTopics.json";

export type HelpTopicId =
    | "overview"
    | "schedule-grid"
    | "coverage-visualizer"
    | "auto-schedule"
    | "violations"
    | "audit"
    | "guided-tracker"
    | "publish"
    | "settings-overview"
    | "settings-school"
    | "settings-schedule-types"
    | "settings-operating-hours"
    | "settings-field-trips"
    | "settings-job-titles"
    | "settings-employees";

export interface HelpTopic {
    id: HelpTopicId;
    title: string;
    summary: string;
    howTo: string[];
    examples: string[];
    related?: HelpTopicId[];
}

export const HELP_TOPICS: HelpTopic[] = helpTopicsJson as HelpTopic[];

export const HELP_TOPICS_BY_ID = new Map(HELP_TOPICS.map((topic) => [ topic.id, topic ]));

// export interface DevelopmentPlan {
//   name: string;           // e.g. 'Balanced', 'Routing'
//   potentialOverall: number; // e.g. 79 — the potential OVR if the plan is followed
// }

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  overall: number;
  strength: string;
  performance: string;
  engagement: number;
  plan: DevelopmentPlan; // <-- Added field
  attendance?: number;
  assessments?: number;
  attributes?: StudentAttributes;
  results?: StudentResults;
}


export interface StudentAttributes {
  problemSolving: number;
  criticalThinking: number;
  analyticalThinking: number;
  creativity: number;
  routing: number;
  switching: number;
  datacomBasics: number;
  ipv6: number;
  networkSecurity: number;
  vpn: number;
  wan: number;
  currentGrowth: number;
  potentialGrowth: number;
}

export interface StudentResults {
  assessments: Assessment[];
  overall: {
    expected: number;
    actual: number;
    grade: string;
  };
}

export interface Assessment {
  name: string;
  expectedMark: number;
  actualMark: number;
  grade: string;
  difference: number;
}

export interface Message {
  id: string;
  sender: string;
  title: string;
  preview: string;
  time: string;
  read: boolean;
  fullContent?: string;
  isReminder?: boolean;
}

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  isTeacher?: boolean;
}

export interface UpcomingActivity {
  id: string;
  course: string;
  title: string;
  time: string;
  link: string;
}

export interface NavLink {
  name: string;
  path: string;
  active: boolean;
  icon: string;
}

export interface DevelopmentPlan {
  name: string;
  progress: number;
  potentialOverall: number;
  eta: number;
  performance: string;
  description: string;
  skills: {
    name: string;
    score: number;
    subskills: {
      name: string;
      score: number;
    }[];
  }[];
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  size: string;
  lastModified: Date;
  tags: string[];
  classes: string[];
  downloads: number;
}

export type ResourceType = 'document' | 'image' | 'video' | 'other';

// src/components/resources/types.ts

export interface ClassResource {
  id: string;
  name: string;
  documents: number;
  images: number;
  videos: number;
  others: number;
}

export interface QuickAccessItem {
  id: string;
  name: string;
  class: string;
}

export interface AnalyticsData {
  totalResources: number;
  averageDownloads: number;
  mostPopularResource: string;
  topClassEngagement: string;
}

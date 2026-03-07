export const RESOURCE_CONTENT_TYPES = [
  'lesson_plan',
  'notes',
  'practice',
  'assessment_material',
] as const;

export type ResourceContentType = (typeof RESOURCE_CONTENT_TYPES)[number];

export const RESOURCE_CONTENT_TYPE_LABELS: Record<ResourceContentType, string> = {
  lesson_plan: 'Lesson Plan',
  notes: 'Notes',
  practice: 'Practice',
  assessment_material: 'Assessment Material',
};

const CONTENT_TYPE_ALIASES: Record<string, ResourceContentType> = {
  lesson_plan: 'lesson_plan',
  'lesson plan': 'lesson_plan',
  lessonsummary: 'lesson_plan',
  'lesson summary': 'lesson_plan',
  notes: 'notes',
  note: 'notes',
  worksheet: 'notes',
  slides: 'notes',
  'revision pack': 'notes',
  practice: 'practice',
  practices: 'practice',
  assessment: 'assessment_material',
  assessment_material: 'assessment_material',
  'assessment material': 'assessment_material',
};

export function normalizeResourceContentType(value?: string | null): ResourceContentType {
  const normalized = (value || '').trim().toLowerCase();
  return CONTENT_TYPE_ALIASES[normalized] || 'notes';
}

export function getResourceContentTypeLabel(value?: string | null): string {
  return RESOURCE_CONTENT_TYPE_LABELS[normalizeResourceContentType(value)];
}

-- Converted for PostgreSQL (Amazon RDS compatible)
-- Conversion date: 2026-01-26
-- Notes:
-- 1) This file keeps your custom util.uuid_generate_v4() implementation.
--    If you prefer the built-in generator, you can enable pgcrypto and replace defaults with gen_random_uuid().
-- 2) Triggers use 'EXECUTE FUNCTION' (PostgreSQL 11+).

-- =============================================================================
-- ZivAI / Hybrid Cloud–Edge LMS (MVP+) – GaussDB for openGauss FULL DDL (COMMENTED)
-- =============================================================================
-- Key design outcomes incorporated:
-- 1) Edge-safe UUID primary keys (prevents offline ID collisions).
-- 2) Multi-school tenancy via lms.schools + lms.school_users.
-- 3) Canonical curriculum backbone for DKT: curriculum_versions + topic hierarchy + canonical skills.
-- 4) Unambiguous question→skill mapping (primary + weight) for KT + analytics.
-- 5) Unified assessment pipeline (quiz/test/assignment all use lms.assessments).
-- 6) OCR-ready answers + teacher override governance + traceability hooks.
-- 7) Hybrid edge sync primitives (edge nodes + outbox/inbox idempotency).
-- 8) RAG governance structures (KB versioning + approvals + chunks + embeddings metadata).
-- 9) AI auditability (model registry + model versions + inference runs + retrieval traces).
-- 10) Consistent soft-delete + sync metadata (deleted_at, origin_node_id, sync_version).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SCHEMAS
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS util;
CREATE SCHEMA IF NOT EXISTS lookups;
CREATE SCHEMA IF NOT EXISTS lms;
CREATE SCHEMA IF NOT EXISTS kb;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS edge;
CREATE SCHEMA IF NOT EXISTS audit;

-- -----------------------------------------------------------------------------
-- UUID GENERATION (NO EXTENSIONS REQUIRED)
-- Generates UUIDv4-like ids using md5 + RFC4122 bit fixes.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION util.gen_uuid_v4()
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  v text;
  variant text;
BEGIN
  v := md5(random()::text || clock_timestamp()::text || pg_backend_pid()::text);

  -- version nibble = 4
  v := substr(v, 1, 12) || '4' || substr(v, 14);

  -- variant nibble = 8/9/a/b
  variant := substr('89ab', floor(random() * 4)::int + 1, 1);
  v := substr(v, 1, 16) || variant || substr(v, 18);

  RETURN (substr(v,1,8) || '-' ||
          substr(v,9,4) || '-' ||
          substr(v,13,4) || '-' ||
          substr(v,17,4) || '-' ||
          substr(v,21,12))::uuid;
END;
$$;

COMMENT ON FUNCTION util.gen_uuid_v4() IS
'UUIDv4-like generator without extensions. Safe for offline edge inserts (no ID collisions on sync).';

-- -----------------------------------------------------------------------------
-- TRIGGER HELPER: updated_at + sync_version increment
-- sync_version provides a monotonic counter for conflict resolution (app can also use it).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION util.tg_touch_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  IF TG_OP = 'UPDATE' THEN
    NEW.sync_version := COALESCE(OLD.sync_version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION util.tg_touch_row() IS
'Trigger helper to update updated_at and increment sync_version on UPDATE.';

-- =============================================================================
-- LOOKUPS (keep minimal; prefer CHECK for small closed enums to avoid join cost)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lookups.roles (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  code varchar(50) UNIQUE NOT NULL,           -- student, teacher, admin, parent
  name varchar(100) NOT NULL
);
COMMENT ON TABLE lookups.roles IS 'Coarse roles for access control.';

CREATE TABLE IF NOT EXISTS lookups.enrolment_status (
  code varchar(50) PRIMARY KEY,               -- active, dropped, completed
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.question_type (
  code varchar(50) PRIMARY KEY,               -- short_answer, structured, mcq, true_false, essay
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.exam_style (
  code varchar(50) PRIMARY KEY,               -- past_paper, teacher_created
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.grading_status (
  code varchar(50) PRIMARY KEY,               -- pending, auto_graded, reviewed
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.risk_level (
  code varchar(20) PRIMARY KEY,               -- low, medium, high
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.exam_board (
  code varchar(50) PRIMARY KEY,               -- zimsec, cambridge
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.contact_channel (
  code varchar(50) PRIMARY KEY,               -- mobile, email, whatsapp, telegram, landline
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.address_type (
  code varchar(50) PRIMARY KEY,               -- home, postal, school, work
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.document_type (
  code varchar(50) PRIMARY KEY,               -- student_id, birth_cert, report, script, other
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.parent_relationship (
  code varchar(50) PRIMARY KEY,               -- mother, father, guardian, other
  name varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS lookups.assessment_enrollment_status (
  code varchar(50) PRIMARY KEY,               -- assigned, completed, late
  name varchar(100) NOT NULL
);

-- =============================================================================
-- LMS CORE: TENANCY + USERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.schools (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  code varchar(64) UNIQUE NOT NULL,           -- tenant code
  name varchar(255) NOT NULL,
  country_code varchar(10) NOT NULL DEFAULT 'ZW',
  is_active boolean NOT NULL DEFAULT TRUE,

  -- sync metadata
  origin_node_id uuid,                        -- where it was created (edge node id)
  sync_version bigint NOT NULL DEFAULT 0,     -- bumped by trigger on UPDATE
  deleted_at timestamptz,                     -- soft delete for sync-safe removals

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.schools IS 'Tenant boundary for multi-school cloud deployment and edge sync.';

CREATE TRIGGER trg_schools_touch
BEFORE UPDATE ON lms.schools
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.users (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  external_id varchar(100),                   -- optional IdP reference (Keycloak etc.)

  email varchar(255) UNIQUE NOT NULL,
  first_name varchar(50) NOT NULL,
  last_name varchar(50) NOT NULL,
  username varchar(100) UNIQUE,

  is_active boolean NOT NULL DEFAULT TRUE,

  -- sync metadata
  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.users IS 'All identities (students/teachers/admins). UUID PK avoids offline collisions.';

CREATE TRIGGER trg_users_touch
BEFORE UPDATE ON lms.users
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.user_roles (
  user_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES lookups.roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON lms.user_roles(role_id);

-- school membership (multi-school support)
CREATE TABLE IF NOT EXISTS lms.school_users (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,

  is_active boolean NOT NULL DEFAULT TRUE,
  joined_at timestamptz NOT NULL DEFAULT NOW(),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  UNIQUE (school_id, user_id),

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.school_users IS 'Associates users to a school (tenant isolation + permissions scoping).';

CREATE INDEX IF NOT EXISTS idx_school_users_school ON lms.school_users(school_id);
CREATE INDEX IF NOT EXISTS idx_school_users_user   ON lms.school_users(user_id);

CREATE TRIGGER trg_school_users_touch
BEFORE UPDATE ON lms.school_users
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- SUBJECTS + CURRICULUM BACKBONE (DKT source of truth)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.subjects (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  code varchar(50) UNIQUE NOT NULL,           -- e.g. olev_maths
  name varchar(200) NOT NULL,
  exam_board_code varchar(50) REFERENCES lookups.exam_board(code),
  description text,
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.subjects IS 'Top-level academic subjects (anchor for curriculum, DKT, analytics).';

CREATE TRIGGER trg_subjects_touch
BEFORE UPDATE ON lms.subjects
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Curriculum versioning: do NOT mutate skills/topics in place; publish new versions.
CREATE TABLE IF NOT EXISTS lms.curriculum_versions (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,

  version_code varchar(120) NOT NULL,         -- e.g. v1, zimsec_2026_term1
  name varchar(200) NOT NULL,
  description text,

  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','retired')),
  effective_from date,
  effective_to date,

  school_id uuid REFERENCES lms.schools(id) ON DELETE SET NULL,  -- NULL = global, non-NULL = school-custom

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (subject_id, version_code)
);

COMMENT ON TABLE lms.curriculum_versions IS 'Versioned curriculum taxonomy per subject; required for reproducible mastery + recommendations.';

CREATE INDEX IF NOT EXISTS idx_curriculum_subject_status ON lms.curriculum_versions(subject_id, status);
CREATE INDEX IF NOT EXISTS idx_curriculum_school         ON lms.curriculum_versions(school_id);

CREATE TRIGGER trg_curriculum_versions_touch
BEFORE UPDATE ON lms.curriculum_versions
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Topics with hierarchy (parent_topic_id) and tied to curriculum_version
CREATE TABLE IF NOT EXISTS lms.topics (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,
  curriculum_version_id uuid NOT NULL REFERENCES lms.curriculum_versions(id) ON DELETE CASCADE,

  parent_topic_id uuid REFERENCES lms.topics(id) ON DELETE SET NULL, -- topic tree

  code varchar(100) NOT NULL,
  name varchar(200) NOT NULL,
  description text,
  sequence_index int,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (curriculum_version_id, code),
  CONSTRAINT ck_topics_parent_not_self CHECK (parent_topic_id IS NULL OR parent_topic_id <> id)
);

COMMENT ON TABLE lms.topics IS 'Curriculum topic hierarchy (strand/topic/subtopic) per curriculum version.';

CREATE INDEX IF NOT EXISTS idx_topics_subject_id    ON lms.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_topics_curriculum_id ON lms.topics(curriculum_version_id);
CREATE INDEX IF NOT EXISTS idx_topics_parent_id     ON lms.topics(parent_topic_id);

CREATE TRIGGER trg_topics_touch
BEFORE UPDATE ON lms.topics
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Skills with canonical_code + curriculum_version_id
CREATE TABLE IF NOT EXISTS lms.skills (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,
  curriculum_version_id uuid NOT NULL REFERENCES lms.curriculum_versions(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES lms.topics(id) ON DELETE SET NULL,

  code varchar(100) NOT NULL,                 -- local code within curriculum version
  canonical_code varchar(150) NOT NULL,       -- stable identifier within curriculum version
  name varchar(200) NOT NULL,
  description text,
  difficulty smallint,
  sequence_index int,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (curriculum_version_id, code),
  UNIQUE (curriculum_version_id, canonical_code)
);

COMMENT ON TABLE lms.skills IS 'Atomic skills; core label-space for DKT + mastery + recommendations.';
COMMENT ON COLUMN lms.skills.canonical_code IS 'Stable skill identifier used across imports/mappings and reproducible analytics.';

CREATE INDEX IF NOT EXISTS idx_skills_subject_id    ON lms.skills(subject_id);
CREATE INDEX IF NOT EXISTS idx_skills_curriculum_id ON lms.skills(curriculum_version_id);
CREATE INDEX IF NOT EXISTS idx_skills_topic_id      ON lms.skills(topic_id);

CREATE TRIGGER trg_skills_touch
BEFORE UPDATE ON lms.skills
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.skill_prerequisites (
  skill_id uuid NOT NULL REFERENCES lms.skills(id) ON DELETE CASCADE,
  prerequisite_skill_id uuid NOT NULL REFERENCES lms.skills(id) ON DELETE CASCADE,
  PRIMARY KEY (skill_id, prerequisite_skill_id)
);

COMMENT ON TABLE lms.skill_prerequisites IS 'Prerequisite graph (DAG) used by recommendation sequencing.';

-- =============================================================================
-- CLASSES & ENROLMENTS (school-scoped)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.classes (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,

  code varchar(100) NOT NULL,                 -- unique within school
  name varchar(200) NOT NULL,
  grade_level varchar(50),
  academic_year varchar(16),                  -- supports e.g. "2025-2026"
  homeroom_teacher_id uuid REFERENCES lms.users(id),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (school_id, code)
);

COMMENT ON TABLE lms.classes IS 'School-scoped classes. academic_year supports split academic years.';

CREATE INDEX IF NOT EXISTS idx_classes_school_id  ON lms.classes(school_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON lms.classes(homeroom_teacher_id);

CREATE TRIGGER trg_classes_touch
BEFORE UPDATE ON lms.classes
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.enrolments (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  class_id uuid NOT NULL REFERENCES lms.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  enrolment_status_code varchar(50) NOT NULL REFERENCES lookups.enrolment_status(code),
  enrolled_at timestamptz NOT NULL DEFAULT NOW(),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (class_id, student_id)
);

COMMENT ON TABLE lms.enrolments IS 'Student membership in a class.';

CREATE INDEX IF NOT EXISTS idx_enrolments_class_id   ON lms.enrolments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_student_id ON lms.enrolments(student_id);

CREATE TRIGGER trg_enrolments_touch
BEFORE UPDATE ON lms.enrolments
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Minimal permission link: teacher↔class (+ optional subject)
CREATE TABLE IF NOT EXISTS lms.class_teachers (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  class_id uuid NOT NULL REFERENCES lms.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES lms.subjects(id) ON DELETE SET NULL,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (class_id, teacher_id, subject_id)
);

COMMENT ON TABLE lms.class_teachers IS 'Teacher assignment to classes (optionally subject-specific).';

CREATE INDEX IF NOT EXISTS idx_class_teachers_class   ON lms.class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_class_teachers_teacher ON lms.class_teachers(teacher_id);

CREATE TRIGGER trg_class_teachers_touch
BEFORE UPDATE ON lms.class_teachers
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- RESOURCES (uploads; can be used for content AND optionally promoted into KB)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.resources (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES lms.subjects(id) ON DELETE SET NULL,

  uploaded_by uuid NOT NULL REFERENCES lms.users(id),
  name varchar(255) NOT NULL,                 -- internal display name
  original_name varchar(255) NOT NULL,        -- original filename
  mime_type varchar(128) NOT NULL,
  res_type varchar(16) NOT NULL CHECK (res_type IN ('document','image','video','other')),
  size_bytes bigint NOT NULL,
  url varchar(1024) NOT NULL,
  storage_key varchar(512),
  storage_path varchar(1024),
  tags text[],
  downloads int NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,

  -- lifecycle (not KB approval; KB has its own approval tables)
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','draft','archived')),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.resources IS 'Files uploaded by users (teachers/students). Some may be curated into KB for RAG.';

CREATE INDEX IF NOT EXISTS idx_resources_school   ON lms.resources(school_id);
CREATE INDEX IF NOT EXISTS idx_resources_subject  ON lms.resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_downloads ON lms.resources(downloads DESC);

CREATE TRIGGER trg_resources_touch
BEFORE UPDATE ON lms.resources
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- QUESTION BANK + RUBRICS + QUESTION→SKILL MAP
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.questions (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),

  -- optional content ownership: NULL = global/shared bank; non-NULL = school-owned content
  school_id uuid REFERENCES lms.schools(id) ON DELETE SET NULL,

  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,
  curriculum_version_id uuid REFERENCES lms.curriculum_versions(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES lms.topics(id) ON DELETE SET NULL,
  author_id uuid REFERENCES lms.users(id),

  code varchar(100),
  stem text NOT NULL,
  question_type_code varchar(50) NOT NULL REFERENCES lookups.question_type(code),
  max_mark numeric(10,2) NOT NULL CHECK (max_mark >= 0),
  difficulty smallint,
  exam_style_code varchar(50) REFERENCES lookups.exam_style(code),
  source_year smallint,

  -- rubric-aware marking for AI/human scoring provenance
  rubric_json jsonb,

  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.questions IS 'Question bank. Mapping to skills enables DKT, mastery analytics, and recommendations.';
COMMENT ON COLUMN lms.questions.rubric_json IS 'Structured rubric (criteria/weights) for AI parsing and reproducible marking.';

CREATE INDEX IF NOT EXISTS idx_questions_subject_id    ON lms.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id      ON lms.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_curriculum_id ON lms.questions(curriculum_version_id);
CREATE INDEX IF NOT EXISTS idx_questions_school_id     ON lms.questions(school_id);

CREATE TRIGGER trg_questions_touch
BEFORE UPDATE ON lms.questions
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Question→Skill mapping (primary + weight to remove ambiguity)
CREATE TABLE IF NOT EXISTS lms.question_skills (
  question_id uuid NOT NULL REFERENCES lms.questions(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES lms.skills(id) ON DELETE CASCADE,

  is_primary boolean NOT NULL DEFAULT FALSE,   -- primary KT label (most models assume 1 skill per step)
  weight numeric(6,3) NOT NULL DEFAULT 1.000 CHECK (weight > 0),

  source varchar(16) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai')),
  linked_trace_id varchar(64),                 -- if AI suggested this mapping (audit link)

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  PRIMARY KEY (question_id, skill_id)
);

COMMENT ON TABLE lms.question_skills IS 'Backbone mapping for DKT + analytics: questions label one primary skill (optionally weighted).';

CREATE INDEX IF NOT EXISTS idx_question_skills_skill_id ON lms.question_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_question_skills_primary  ON lms.question_skills(question_id, is_primary);

-- only one primary skill per question
CREATE UNIQUE INDEX IF NOT EXISTS uq_question_one_primary
ON lms.question_skills(question_id)
WHERE is_primary = TRUE;

CREATE TRIGGER trg_question_skills_touch
BEFORE UPDATE ON lms.question_skills
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Rubric versions per question
CREATE TABLE IF NOT EXISTS lms.marking_schemes (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  question_id uuid NOT NULL REFERENCES lms.questions(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  total_mark numeric(10,2) NOT NULL CHECK (total_mark >= 0),
  scheme_source varchar(100),
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (question_id, version)
);

COMMENT ON TABLE lms.marking_schemes IS 'Versioned marking schemes for reproducible grading (AI + human).';

CREATE TRIGGER trg_marking_schemes_touch
BEFORE UPDATE ON lms.marking_schemes
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.marking_scheme_items (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  marking_scheme_id uuid NOT NULL REFERENCES lms.marking_schemes(id) ON DELETE CASCADE,
  step_index int NOT NULL,
  description text NOT NULL,
  mark_value numeric(10,2) NOT NULL CHECK (mark_value >= 0),
  rubric_code varchar(100),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (marking_scheme_id, step_index)
);

COMMENT ON TABLE lms.marking_scheme_items IS 'Atomic rubric steps; supports stepwise ASAG scoring and audit.';

CREATE INDEX IF NOT EXISTS idx_marking_items_scheme_id ON lms.marking_scheme_items(marking_scheme_id);

CREATE TRIGGER trg_marking_scheme_items_touch
BEFORE UPDATE ON lms.marking_scheme_items
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- UNIFIED ASSESSMENTS PIPELINE (quiz/test/assignment/project/exam)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.assessments (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,

  name varchar(255) NOT NULL,
  description text,

  assessment_type varchar(16) NOT NULL CHECK (assessment_type IN ('quiz','test','assignment','project','exam')),
  visibility varchar(16) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','shared','school')),

  time_limit_min int,
  attempts_allowed int,

  max_score numeric(10,2) NOT NULL CHECK (max_score >= 0),
  weight_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (weight_pct BETWEEN 0 AND 100),

  resource_id uuid REFERENCES lms.resources(id) ON DELETE SET NULL, -- paper/brief

  is_ai_enhanced boolean NOT NULL DEFAULT FALSE,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),

  created_by uuid NOT NULL REFERENCES lms.users(id),
  last_modified_by uuid NOT NULL REFERENCES lms.users(id),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.assessments IS 'Single assessment model for all types. Avoids split pipelines and AI duplication.';

CREATE INDEX IF NOT EXISTS idx_assessments_school_subject ON lms.assessments(school_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status         ON lms.assessments(school_id, status, created_at DESC);

CREATE TRIGGER trg_assessments_touch
BEFORE UPDATE ON lms.assessments
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.assessment_questions (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  assessment_id uuid NOT NULL REFERENCES lms.assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES lms.questions(id),
  sequence_index int NOT NULL,
  points numeric(10,2) NOT NULL CHECK (points >= 0),

  -- rubric pinning (provenance): which scheme/version was used for grading
  rubric_scheme_id uuid REFERENCES lms.marking_schemes(id) ON DELETE SET NULL,
  rubric_scheme_version int,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (assessment_id, question_id),
  UNIQUE (assessment_id, sequence_index)
);

COMMENT ON TABLE lms.assessment_questions IS 'Assessment composition (ordered questions) + pinned rubric provenance.';

CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment ON lms.assessment_questions(assessment_id);

CREATE TRIGGER trg_assessment_questions_touch
BEFORE UPDATE ON lms.assessment_questions
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.assessment_assignments (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  assessment_id uuid NOT NULL REFERENCES lms.assessments(id) ON DELETE CASCADE,
  class_id uuid REFERENCES lms.classes(id) ON DELETE SET NULL,

  assigned_by uuid NOT NULL REFERENCES lms.users(id),
  title varchar(200),
  instructions text,
  start_time timestamptz,
  due_time timestamptz,

  is_published boolean NOT NULL DEFAULT FALSE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.assessment_assignments IS 'Assign an assessment to a class (or later to individuals).';

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment ON lms.assessment_assignments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_class      ON lms.assessment_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assignedby ON lms.assessment_assignments(assigned_by);

CREATE TRIGGER trg_assessment_assignments_touch
BEFORE UPDATE ON lms.assessment_assignments
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.assessment_enrollments (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  assessment_assignment_id uuid NOT NULL REFERENCES lms.assessment_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  status_code varchar(50) NOT NULL REFERENCES lookups.assessment_enrollment_status(code),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (assessment_assignment_id, student_id)
);

COMMENT ON TABLE lms.assessment_enrollments IS 'Per-student assignment enrollment (status tracking).';

CREATE INDEX IF NOT EXISTS idx_assessment_enrollments_assignment ON lms.assessment_enrollments(assessment_assignment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_enrollments_student    ON lms.assessment_enrollments(student_id);

CREATE TRIGGER trg_assessment_enrollments_touch
BEFORE UPDATE ON lms.assessment_enrollments
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  assessment_enrollment_id uuid NOT NULL REFERENCES lms.assessment_enrollments(id) ON DELETE CASCADE,
  attempt_number int NOT NULL DEFAULT 1,

  started_at timestamptz NOT NULL DEFAULT NOW(),
  submitted_at timestamptz,

  total_score numeric(10,2),
  max_score numeric(10,2),

  grading_status_code varchar(50) NOT NULL REFERENCES lookups.grading_status(code),
  ai_confidence numeric(6,4),

  -- trace for attempt-level grading pipeline (optional)
  attempt_trace_id varchar(64),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (assessment_enrollment_id, attempt_number)
);

COMMENT ON TABLE lms.assessment_attempts IS 'Attempt instances; attempt_trace_id links to AI run provenance when applicable.';

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_enrollment ON lms.assessment_attempts(assessment_enrollment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_latest     ON lms.assessment_attempts(assessment_enrollment_id, attempt_number DESC);

CREATE TRIGGER trg_assessment_attempts_touch
BEFORE UPDATE ON lms.assessment_attempts
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Answers: link ONLY to assessment_question_id to avoid redundancy drift
CREATE TABLE IF NOT EXISTS lms.attempt_answers (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  assessment_attempt_id uuid NOT NULL REFERENCES lms.assessment_attempts(id) ON DELETE CASCADE,
  assessment_question_id uuid NOT NULL REFERENCES lms.assessment_questions(id),

  -- student answer content
  student_answer_text text,
  student_answer_blob jsonb,

  -- OCR capture (BYTEA + extracted)
  handwriting_resource_id uuid REFERENCES lms.resources(id) ON DELETE SET NULL, -- scan/photo resource
  ocr_text text,                              -- extracted text from OCR
  ocr_confidence numeric(6,4),                -- OCR quality/confidence (engine-specific)
  ocr_engine varchar(64),                     -- e.g. tesseract, paddleocr
  ocr_language varchar(32),                   -- e.g. en
  ocr_metadata jsonb,                         -- bbox/lines/pages if needed

  -- scoring
  ai_score numeric(10,2),
  human_score numeric(10,2),
  max_score numeric(10,2) NOT NULL,

  ai_confidence numeric(6,4),
  requires_review boolean NOT NULL DEFAULT FALSE,
  feedback_text text,
  graded_at timestamptz,

  -- answer-level AI run trace (reproducibility)
  answer_trace_id varchar(64),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (assessment_attempt_id, assessment_question_id)
);

COMMENT ON TABLE lms.attempt_answers IS 'Per-question answer record (supports OCR + AI grading + human overrides).';
COMMENT ON COLUMN lms.attempt_answers.answer_trace_id IS 'Links this answer to an AI inference trace for auditability.';

CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt ON lms.attempt_answers(assessment_attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_trace   ON lms.attempt_answers(answer_trace_id);

CREATE TRIGGER trg_attempt_answers_touch
BEFORE UPDATE ON lms.attempt_answers
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Attachments per answer (extra scans/files)
CREATE TABLE IF NOT EXISTS lms.answer_attachments (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  attempt_answer_id uuid NOT NULL REFERENCES lms.attempt_answers(id) ON DELETE CASCADE,
  resource_id uuid REFERENCES lms.resources(id) ON DELETE SET NULL,

  file_name varchar(255),
  storage_path varchar(1024),
  mime_type varchar(128),
  size_bytes bigint,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.answer_attachments IS 'Optional extra files for a specific answer (scans, supporting work).';

CREATE INDEX IF NOT EXISTS idx_answer_attachments_answer ON lms.answer_attachments(attempt_answer_id);

CREATE TRIGGER trg_answer_attachments_touch
BEFORE UPDATE ON lms.answer_attachments
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Teacher override governance: before/after + reason + trace link
CREATE TABLE IF NOT EXISTS lms.grading_overrides (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  attempt_answer_id uuid NOT NULL REFERENCES lms.attempt_answers(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES lms.users(id),

  old_score numeric(10,2),
  new_score numeric(10,2) NOT NULL,
  reason text,
  overridden_at timestamptz NOT NULL DEFAULT NOW(),
  linked_trace_id varchar(64),                -- ties override to AI trace or review trace

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.grading_overrides IS 'Audit record for teacher overrides (before/after + reason) for governance.';

CREATE INDEX IF NOT EXISTS idx_grading_overrides_answer  ON lms.grading_overrides(attempt_answer_id);
CREATE INDEX IF NOT EXISTS idx_grading_overrides_teacher ON lms.grading_overrides(teacher_id, overridden_at DESC);

CREATE TRIGGER trg_grading_overrides_touch
BEFORE UPDATE ON lms.grading_overrides
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- DKT SUPPORT: FLATTENED INTERACTION EVENTS (model-friendly; minimal joins)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lms.interaction_events (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,

  edge_node_id uuid,                          -- FK added later after edge.edge_nodes exists

  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES lms.subjects(id) ON DELETE SET NULL,
  curriculum_version_id uuid REFERENCES lms.curriculum_versions(id) ON DELETE SET NULL,

  skill_id uuid NOT NULL REFERENCES lms.skills(id) ON DELETE CASCADE,
  question_id uuid REFERENCES lms.questions(id) ON DELETE SET NULL,

  assessment_attempt_id uuid REFERENCES lms.assessment_attempts(id) ON DELETE SET NULL,
  attempt_answer_id uuid REFERENCES lms.attempt_answers(id) ON DELETE SET NULL,

  -- KT labels
  is_correct smallint NOT NULL CHECK (is_correct IN (0,1)), -- classic DKT/BKT
  score numeric(10,2),                                      -- supports partial credit
  max_score numeric(10,2),

  -- Behavioral features (optional but valuable; mirrors ASSISTments-like data)
  attempt_count int,                        -- NUMERIC of tries on the item
  response_time_ms int,                     -- time to first meaningful response
  hint_count int,                           -- hint usage
  opportunity int,                          -- cumulative practice count for this skill (optional)

  event_time timestamptz NOT NULL DEFAULT NOW(),

  trace_id varchar(64),                     -- links to ai.ai_inference_runs.trace_id (optional)
  raw_event jsonb,                          -- optional BYTEA payload for debugging/ETL parity

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.interaction_events IS 'DKT training/inference feed: one row per student-skill interaction, ordered by event_time.';
COMMENT ON COLUMN lms.interaction_events.opportunity IS 'Optional ASSISTments-like practice count per skill; can be derived if not stored.';

CREATE INDEX IF NOT EXISTS idx_interactions_student_time
ON lms.interaction_events(student_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_student_skill_time
ON lms.interaction_events(student_id, skill_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_skill_time
ON lms.interaction_events(skill_id, event_time DESC);

CREATE INDEX IF NOT EXISTS idx_interactions_school_time
ON lms.interaction_events(school_id, event_time DESC);

CREATE TRIGGER trg_interaction_events_touch
BEFORE UPDATE ON lms.interaction_events
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- MASTERY SNAPSHOTS (display + analytics; keep "latest" index)
-- =============================================================================
CREATE TABLE IF NOT EXISTS lms.mastery_snapshots (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES lms.subjects(id),
  snapshot_time timestamptz NOT NULL DEFAULT NOW(),
  source varchar(50) NOT NULL CHECK (source IN ('dkt_update','batch_recalc')),
  average_mastery numeric(6,4),
  risk_level_code varchar(20) REFERENCES lookups.risk_level(code),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, subject_id, snapshot_time)
);

COMMENT ON TABLE lms.mastery_snapshots IS 'Aggregated mastery snapshots for UI and analytics (not the BYTEA DKT event stream).';

CREATE INDEX IF NOT EXISTS idx_mastery_latest
ON lms.mastery_snapshots(student_id, subject_id, snapshot_time DESC);

CREATE TRIGGER trg_mastery_snapshots_touch
BEFORE UPDATE ON lms.mastery_snapshots
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.mastery_snapshot_skills (
  mastery_snapshot_id uuid NOT NULL REFERENCES lms.mastery_snapshots(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES lms.skills(id),
  mastery_prob numeric(6,4) NOT NULL,
  PRIMARY KEY (mastery_snapshot_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_snapshot_skills_skill
ON lms.mastery_snapshot_skills(skill_id);

-- =============================================================================
-- KB / RAG GOVERNANCE (approved docs, chunk metadata, embeddings metadata)
-- =============================================================================

CREATE TABLE IF NOT EXISTS kb.kb_versions (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES lms.subjects(id) ON DELETE SET NULL,

  name varchar(255) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),

  created_by uuid NOT NULL REFERENCES lms.users(id),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE kb.kb_versions IS 'Version of a curated knowledge base (KB) used by RAG at a point in time.';

CREATE INDEX IF NOT EXISTS idx_kb_versions_school_subject
ON kb.kb_versions(school_id, subject_id);

CREATE TRIGGER trg_kb_versions_touch
BEFORE UPDATE ON kb.kb_versions
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS kb.kb_documents (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  kb_version_id uuid NOT NULL REFERENCES kb.kb_versions(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES lms.resources(id) ON DELETE CASCADE,

  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','archived')),
  approved_by uuid REFERENCES lms.users(id),
  approved_at timestamptz,

  metadata jsonb,                             -- doc-level extraction metadata (pages, source, etc.)

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE kb.kb_documents IS 'KB documents (resources) with approval status; only approved docs should be used for RAG grounding.';

CREATE INDEX IF NOT EXISTS idx_kb_documents_version_status
ON kb.kb_documents(kb_version_id, status);

CREATE TRIGGER trg_kb_documents_touch
BEFORE UPDATE ON kb.kb_documents
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS kb.kb_chunks (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  document_id uuid NOT NULL REFERENCES kb.kb_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL,
  text text NOT NULL,
  token_count int,
  metadata jsonb,                             -- chunk offsets, page refs, etc.

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, chunk_index)
);

COMMENT ON TABLE kb.kb_chunks IS 'Chunked text units used by retrieval; chunk_index preserves deterministic chunk ordering.';

CREATE INDEX IF NOT EXISTS idx_kb_chunks_document
ON kb.kb_chunks(document_id);

CREATE TRIGGER trg_kb_chunks_touch
BEFORE UPDATE ON kb.kb_chunks
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Embeddings metadata (portable): store float4[] or external vector_id depending on infra
CREATE TABLE IF NOT EXISTS kb.kb_embeddings (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  chunk_id uuid NOT NULL REFERENCES kb.kb_chunks(id) ON DELETE CASCADE,

  embedding_dim int NOT NULL,
  embedding float4[],                         -- optional: can be NULL if embeddings in external store
  vector_store varchar(64),                   -- e.g. milvus, faiss, weaviate, pgvector
  vector_id varchar(255),                     -- external identifier
  index_name varchar(255),                    -- which index/collection

  embedding_model_version_id uuid,            -- FK added later to ai.ai_model_versions

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (chunk_id, vector_store, vector_id)
);

COMMENT ON TABLE kb.kb_embeddings IS 'Embedding metadata linking KB chunks to a vector index; required for governance and traceability.';

CREATE INDEX IF NOT EXISTS idx_kb_embeddings_chunk
ON kb.kb_embeddings(chunk_id);

CREATE TRIGGER trg_kb_embeddings_touch
BEFORE UPDATE ON kb.kb_embeddings
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- AI AUDITABILITY / TRACEABILITY (models, versions, inference, retrieval traces)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai.ai_models (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  name varchar(255) NOT NULL,
  model_type varchar(16) NOT NULL CHECK (model_type IN ('dkt','asag','rag','slm')),
  description text,
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (name, model_type)
);

COMMENT ON TABLE ai.ai_models IS 'Registry of logical models (DKT, ASAG, RAG, SLM).';

CREATE TRIGGER trg_ai_models_touch
BEFORE UPDATE ON ai.ai_models
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS ai.ai_model_versions (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  model_id uuid NOT NULL REFERENCES ai.ai_models(id) ON DELETE CASCADE,
  version varchar(64) NOT NULL,               -- semantic version or artifact tag
  artifact_uri varchar(1024),                 -- where the model weights are stored
  metrics jsonb,                              -- evaluation metrics
  config jsonb,                               -- training/inference config
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (model_id, version)
);

COMMENT ON TABLE ai.ai_model_versions IS 'Concrete model artifacts (weights/config/metrics) used in production and at edge.';

CREATE INDEX IF NOT EXISTS idx_ai_model_versions_model_time
ON ai.ai_model_versions(model_id, created_at DESC);

CREATE TRIGGER trg_ai_model_versions_touch
BEFORE UPDATE ON ai.ai_model_versions
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Inference runs: trace_id is the reproducibility handle
CREATE TABLE IF NOT EXISTS ai.ai_inference_runs (
  trace_id varchar(64) PRIMARY KEY,           -- caller-generated or service-generated id

  model_version_id uuid NOT NULL REFERENCES ai.ai_model_versions(id),

  school_id uuid REFERENCES lms.schools(id) ON DELETE SET NULL,
  student_id uuid REFERENCES lms.users(id) ON DELETE SET NULL,
  assessment_attempt_id uuid REFERENCES lms.assessment_attempts(id) ON DELETE SET NULL,
  attempt_answer_id uuid REFERENCES lms.attempt_answers(id) ON DELETE SET NULL,

  prompt_text text,                           -- BYTEA prompt (if applicable)
  context_json jsonb,                         -- structured context (variables, constraints, etc.)

  rubric_scheme_id uuid REFERENCES lms.marking_schemes(id) ON DELETE SET NULL,
  rubric_scheme_version int,

  request_json jsonb NOT NULL,                -- full request payload to model service
  response_json jsonb NOT NULL,               -- full model output
  latency_ms int,

  edge_node_id uuid,                          -- which edge node served it (optional)
  created_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai.ai_inference_runs IS 'Model provenance: which model/version, what inputs, what outputs, and when (supports audit and reproducibility).';

CREATE INDEX IF NOT EXISTS idx_ai_inference_model_time
ON ai.ai_inference_runs(model_version_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_inference_school_time
ON ai.ai_inference_runs(school_id, created_at DESC);

-- Retrieval traces: which KB version + chunks were used to ground a response (RAG)
CREATE TABLE IF NOT EXISTS ai.ai_retrieval_traces (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  trace_id varchar(64) NOT NULL REFERENCES ai.ai_inference_runs(trace_id) ON DELETE CASCADE,
  kb_version_id uuid REFERENCES kb.kb_versions(id) ON DELETE SET NULL,

  chunk_ids uuid[],                           -- retrieved chunk ids
  scores numeric(12,6)[],                     -- similarity scores aligned to chunk_ids
  metadata jsonb,                             -- retriever params, filters, etc.

  created_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai.ai_retrieval_traces IS 'RAG grounding evidence: which chunks were retrieved for a given inference trace.';

CREATE INDEX IF NOT EXISTS idx_ai_retrieval_trace_id
ON ai.ai_retrieval_traces(trace_id);

-- =============================================================================
-- EDGE OFFLINE CONTINUITY: nodes, deployments, outbox/inbox
-- =============================================================================

CREATE TABLE IF NOT EXISTS edge.edge_nodes (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  device_id varchar(128) NOT NULL,            -- physical identifier / serial / hostname
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','retired')),
  last_seen_at timestamptz,
  software_version varchar(64),
  metadata jsonb,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (school_id, device_id)
);

COMMENT ON TABLE edge.edge_nodes IS 'Registered edge devices per school; supports offline sync and edge model deployments.';

CREATE INDEX IF NOT EXISTS idx_edge_nodes_school
ON edge.edge_nodes(school_id);

CREATE TRIGGER trg_edge_nodes_touch
BEFORE UPDATE ON edge.edge_nodes
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS edge.edge_model_deployments (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  edge_node_id uuid NOT NULL REFERENCES edge.edge_nodes(id) ON DELETE CASCADE,
  model_version_id uuid NOT NULL REFERENCES ai.ai_model_versions(id),
  installed_at timestamptz NOT NULL DEFAULT NOW(),
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (edge_node_id, model_version_id)
);

COMMENT ON TABLE edge.edge_model_deployments IS 'Tracks which model versions are installed/active on each edge node.';

CREATE INDEX IF NOT EXISTS idx_edge_deployments_node
ON edge.edge_model_deployments(edge_node_id);

CREATE TRIGGER trg_edge_model_deployments_touch
BEFORE UPDATE ON edge.edge_model_deployments
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- Outbox: edge→cloud events (store-and-forward pattern)
CREATE TABLE IF NOT EXISTS edge.sync_outbox (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  edge_node_id uuid NOT NULL REFERENCES edge.edge_nodes(id) ON DELETE CASCADE,

  event_id uuid NOT NULL DEFAULT util.gen_uuid_v4(), -- idempotency key
  event_type varchar(64) NOT NULL,
  payload jsonb NOT NULL,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  sent_at timestamptz,
  retry_count int NOT NULL DEFAULT 0,
  last_error text,

  UNIQUE (edge_node_id, event_id)
);

COMMENT ON TABLE edge.sync_outbox IS 'Durable outbox for edge sync; prevents data loss during intermittent connectivity.';

CREATE INDEX IF NOT EXISTS idx_sync_outbox_unsent
ON edge.sync_outbox(edge_node_id, sent_at, created_at);

-- Inbox: receiver records processed events (idempotency)
CREATE TABLE IF NOT EXISTS edge.sync_inbox (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  receiver_edge_node_id uuid REFERENCES edge.edge_nodes(id) ON DELETE CASCADE,

  event_id uuid NOT NULL,
  event_type varchar(64) NOT NULL,
  payload jsonb NOT NULL,

  received_at timestamptz NOT NULL DEFAULT NOW(),
  processed_at timestamptz,
  status varchar(16) NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','failed')),

  UNIQUE (receiver_edge_node_id, event_id)
);

COMMENT ON TABLE edge.sync_inbox IS 'Processed-event ledger for idempotency (prevents double-apply on retries).';

CREATE INDEX IF NOT EXISTS idx_sync_inbox_status
ON edge.sync_inbox(receiver_edge_node_id, status, received_at DESC);

-- Now that edge nodes exist, add FK to interaction_events.edge_node_id
ALTER TABLE lms.interaction_events
  ADD CONSTRAINT fk_interactions_edge_node
  FOREIGN KEY (edge_node_id) REFERENCES edge.edge_nodes(id) ON DELETE SET NULL;

-- Now that ai model versions exist, add FK to kb embeddings
ALTER TABLE kb.kb_embeddings
  ADD CONSTRAINT fk_kb_embeddings_model_version
  FOREIGN KEY (embedding_model_version_id) REFERENCES ai.ai_model_versions(id) ON DELETE SET NULL;

-- Optional: tie inference_runs.edge_node_id to edge nodes (helps debugging)
ALTER TABLE ai.ai_inference_runs
  ADD CONSTRAINT fk_ai_inference_edge_node
  FOREIGN KEY (edge_node_id) REFERENCES edge.edge_nodes(id) ON DELETE SET NULL;

-- =============================================================================
-- PARENTS / ADDRESSES / CONTACTS / STUDENT DOCUMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.parents (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  first_name varchar(50) NOT NULL,
  last_name varchar(50) NOT NULL,
  email varchar(255),
  mobile varchar(50),
  alt_mobile varchar(50),
  occupation varchar(150),
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.parents IS 'Parent/guardian records (optional for MVP but useful for school deployment).';

CREATE INDEX IF NOT EXISTS idx_parents_email  ON lms.parents(email);
CREATE INDEX IF NOT EXISTS idx_parents_mobile ON lms.parents(mobile);

CREATE TRIGGER trg_parents_touch
BEFORE UPDATE ON lms.parents
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.student_parents (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES lms.parents(id) ON DELETE CASCADE,
  relationship_code varchar(50) NOT NULL REFERENCES lookups.parent_relationship(code),
  is_primary_guardian boolean NOT NULL DEFAULT FALSE,
  notes text,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, parent_id, relationship_code)
);

COMMENT ON TABLE lms.student_parents IS 'Associates students to parents/guardians with relationship type.';

CREATE INDEX IF NOT EXISTS idx_student_parents_student_id ON lms.student_parents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_parents_parent_id  ON lms.student_parents(parent_id);

CREATE TRIGGER trg_student_parents_touch
BEFORE UPDATE ON lms.student_parents
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.addresses (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  line1 varchar(200) NOT NULL,
  line2 varchar(200),
  suburb varchar(100),
  city varchar(100),
  district varchar(100),
  province varchar(100),
  country_code varchar(10) DEFAULT 'ZW',
  postal_code varchar(20),
  latitude numeric(9,6),
  longitude numeric(9,6),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.addresses IS 'Reusable address records (users/parents).';

CREATE TRIGGER trg_addresses_touch
BEFORE UPDATE ON lms.addresses
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.user_addresses (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  user_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  address_id uuid NOT NULL REFERENCES lms.addresses(id) ON DELETE CASCADE,
  address_type_code varchar(50) NOT NULL REFERENCES lookups.address_type(code),
  is_primary boolean NOT NULL DEFAULT FALSE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, address_id, address_type_code)
);

COMMENT ON TABLE lms.user_addresses IS 'Links users to addresses with type (home/school/etc.).';

CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id    ON lms.user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_address_id ON lms.user_addresses(address_id);

CREATE TRIGGER trg_user_addresses_touch
BEFORE UPDATE ON lms.user_addresses
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.user_contacts (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  user_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  contact_channel_code varchar(50) NOT NULL REFERENCES lookups.contact_channel(code),
  value varchar(255) NOT NULL,
  is_primary boolean NOT NULL DEFAULT FALSE,
  notes text,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, contact_channel_code, value)
);

COMMENT ON TABLE lms.user_contacts IS 'Extra contact channels per user (e.g., WhatsApp, email).';

CREATE INDEX IF NOT EXISTS idx_user_contacts_user_id ON lms.user_contacts(user_id);

CREATE TRIGGER trg_user_contacts_touch
BEFORE UPDATE ON lms.user_contacts
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.student_documents (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  document_type_code varchar(50) NOT NULL REFERENCES lookups.document_type(code),
  file_name varchar(255) NOT NULL,
  storage_path varchar(500) NOT NULL,
  mime_type varchar(100),
  uploaded_at timestamptz NOT NULL DEFAULT NOW(),
  uploaded_by uuid REFERENCES lms.users(id),
  metadata jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz
);

COMMENT ON TABLE lms.student_documents IS 'Student identity/supporting documents (not assessment submissions).';

CREATE INDEX IF NOT EXISTS idx_student_documents_student_id ON lms.student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_documents_type       ON lms.student_documents(document_type_code);

-- =============================================================================
-- CHAT (proper chats + members; avoids fragile string chat_id construction)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.chats (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  chat_type varchar(16) NOT NULL DEFAULT 'direct' CHECK (chat_type IN ('direct','group')),
  title varchar(255),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.chats IS 'Chat rooms (direct or group) per school.';

CREATE INDEX IF NOT EXISTS idx_chats_school ON lms.chats(school_id);

CREATE TRIGGER trg_chats_touch
BEFORE UPDATE ON lms.chats
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.chat_members (
  chat_id uuid NOT NULL REFERENCES lms.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  role varchar(16) NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

COMMENT ON TABLE lms.chat_members IS 'Membership of users in chats.';

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON lms.chat_members(user_id);

CREATE TABLE IF NOT EXISTS lms.messages (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES lms.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES lms.users(id),

  content text NOT NULL,
  ts timestamptz NOT NULL DEFAULT NOW(),
  is_read boolean NOT NULL DEFAULT FALSE,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.messages IS 'Chat messages; indexed by (chat_id, ts) for efficient conversation retrieval.';

CREATE INDEX IF NOT EXISTS idx_messages_chat_ts ON lms.messages(chat_id, ts);

CREATE TRIGGER trg_messages_touch
BEFORE UPDATE ON lms.messages
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- NOTIFICATIONS (small CHECK enum to avoid lookup join)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.notifications (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,

  notif_type varchar(32) NOT NULL
    CHECK (notif_type IN ('assignment_graded','assignment_submitted','plan_assigned','message_received')),

  title varchar(255) NOT NULL,
  message text NOT NULL,
  data jsonb,

  is_read boolean NOT NULL DEFAULT FALSE,
  read_at timestamptz,

  priority varchar(8) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  expires_at timestamptz,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.notifications IS 'User notifications; can be polled or pushed by realtime mechanism.';

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
ON lms.notifications(school_id, recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_ttl
ON lms.notifications(expires_at);

CREATE TRIGGER trg_notifications_touch
BEFORE UPDATE ON lms.notifications
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- CALENDAR EVENTS (small CHECK enum)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.calendar_events (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid NOT NULL REFERENCES lms.schools(id) ON DELETE CASCADE,

  title varchar(255) NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  all_day boolean NOT NULL DEFAULT FALSE,

  event_type varchar(32) NOT NULL CHECK
    (event_type IN ('lecture','lab','assignment_due','exam','meeting','office_hours','holiday','workshop','seminar','presentation','project_due','quiz')),

  class_id uuid REFERENCES lms.classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES lms.subjects(id) ON DELETE SET NULL,

  location varchar(255),
  attendees text[],
  recurring jsonb,
  reminders jsonb,

  created_by uuid NOT NULL REFERENCES lms.users(id),
  is_public boolean NOT NULL DEFAULT FALSE,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.calendar_events IS 'Calendar entries per school (classes, exams, due dates).';

CREATE INDEX IF NOT EXISTS idx_calendar_start
ON lms.calendar_events(school_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_calendar_class
ON lms.calendar_events(class_id, start_time);

CREATE TRIGGER trg_calendar_events_touch
BEFORE UPDATE ON lms.calendar_events
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- DEVELOPMENT PLANS (MVP; consistent enum casing; avoids spaces)
-- =============================================================================

CREATE TABLE IF NOT EXISTS lms.plans (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  description text NOT NULL,

  progress numeric(5,2) NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  potential_overall numeric(5,2) NOT NULL CHECK (potential_overall BETWEEN 0 AND 100),
  eta_days int NOT NULL CHECK (eta_days > 0),
  performance varchar(128) NOT NULL,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.plans IS 'Template learning plans aligned to subject (assigned to students).';

CREATE TRIGGER trg_plans_touch
BEFORE UPDATE ON lms.plans
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.plan_steps (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  plan_id uuid NOT NULL REFERENCES lms.plans(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  step_type varchar(32) NOT NULL CHECK (step_type IN ('video','document','assessment','discussion')),
  link varchar(1024),
  step_order int NOT NULL,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (plan_id, step_order)
);

COMMENT ON TABLE lms.plan_steps IS 'Ordered steps for a plan (resources, assessments, discussions).';

CREATE TRIGGER trg_plan_steps_touch
BEFORE UPDATE ON lms.plan_steps
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.student_plans (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES lms.plans(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES lms.subjects(id) ON DELETE CASCADE,

  start_date timestamptz NOT NULL DEFAULT NOW(),
  current_progress numeric(5,2) NOT NULL DEFAULT 0 CHECK (current_progress BETWEEN 0 AND 100),

  status varchar(16) NOT NULL DEFAULT 'on_hold' CHECK (status IN ('active','completed','on_hold','cancelled')),
  is_current boolean NOT NULL DEFAULT FALSE,
  completion_date timestamptz,

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE lms.student_plans IS 'Plan assignment per student; is_current supports current active plan selection.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_student_plans_current
ON lms.student_plans(student_id, subject_id, is_current);

CREATE TRIGGER trg_student_plans_touch
BEFORE UPDATE ON lms.student_plans
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

CREATE TABLE IF NOT EXISTS lms.student_attributes (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  student_id uuid NOT NULL REFERENCES lms.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES lms.skills(id) ON DELETE CASCADE,

  current_score numeric(5,2) NOT NULL CHECK (current_score BETWEEN 0 AND 100),
  potential_score numeric(5,2) NOT NULL CHECK (potential_score BETWEEN 0 AND 100),
  last_assessed timestamptz NOT NULL DEFAULT NOW(),

  origin_node_id uuid,
  sync_version bigint NOT NULL DEFAULT 0,
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),

  UNIQUE (student_id, skill_id)
);

COMMENT ON TABLE lms.student_attributes IS 'Per-skill student attributes used by recommendation/UI (derived from model outputs).';

CREATE INDEX IF NOT EXISTS idx_student_attributes_student
ON lms.student_attributes(student_id);

CREATE TRIGGER trg_student_attributes_touch
BEFORE UPDATE ON lms.student_attributes
FOR EACH ROW EXECUTE FUNCTION util.tg_touch_row();

-- =============================================================================
-- AUDIT EVENT LOG (append-only; analytics + governance)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit.event_log (
  id uuid PRIMARY KEY DEFAULT util.gen_uuid_v4(),
  school_id uuid REFERENCES lms.schools(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES lms.users(id) ON DELETE SET NULL,

  event_type varchar(64) NOT NULL,            -- e.g. assessment_published, ai_grade_run
  entity_type varchar(64),                    -- e.g. assessments, questions
  entity_id varchar(64),                      -- store UUID as text for loose coupling
  payload jsonb,

  created_at timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit.event_log IS 'Immutable event stream for analytics, ML training, and governance audits.';

CREATE INDEX IF NOT EXISTS idx_event_log_school_time
ON audit.event_log(school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_log_actor_time
ON audit.event_log(actor_id, created_at DESC);


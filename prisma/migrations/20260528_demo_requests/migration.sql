CREATE TYPE demo_request_status_t AS ENUM (
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'CONVERTED',
  'REJECTED'
);

CREATE TABLE public.demo_requests (
  id             UUID                  NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name      TEXT                  NOT NULL,
  email          TEXT                  NOT NULL,
  phone          TEXT                  NOT NULL,
  garage_name    TEXT                  NOT NULL,
  city           TEXT,
  message        TEXT,
  status         demo_request_status_t NOT NULL DEFAULT 'NEW',
  admin_notes    TEXT,
  handled_by_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ           NOT NULL DEFAULT now()
);

CREATE INDEX idx_demo_requests_status ON public.demo_requests (status);
CREATE INDEX idx_demo_requests_created_at ON public.demo_requests (created_at);

/*
# Create app_config table for storing API keys

1. New Tables
- `app_config`: Stores application-level configuration like API keys.
  - key (text, primary key) - the config name
  - value (text, not null) - the config value
  - created_at (timestamptz)
  - updated_at (timestamptz)

2. Security
- RLS enabled with NO policies, meaning only the service role can access this table.
- The edge function uses the service role key to read the GEMINI_API_KEY.
- No anon or authenticated role can read or write to this table.

3. Initial Data
- Inserts GEMINI_API_KEY with the user's provided key.
*/

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- No policies = no access for anon/authenticated roles.
-- Only the service role (which bypasses RLS) can read/write.

-- Insert the Gemini API key
INSERT INTO app_config (key, value)
VALUES ('GEMINI_API_KEY', 'AQ.Ab8RN6Ie8aY6fIatsEfGXAIMLleAxWgJuyziU3HQVpzSqovzNw')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

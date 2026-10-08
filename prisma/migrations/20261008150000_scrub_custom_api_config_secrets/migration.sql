-- Custom API connections used to keep their raw connect config (API key,
-- bearer token, basic-auth password) in plain text in "configJson", which was
-- also returned to clients. Execution only ever read the encrypted copies in
-- "metadata", so the plain-text copy is simply dropped.
UPDATE "external_integrations"
SET "configJson" = '{}'
WHERE "configJson" IS NOT NULL
  AND "configJson" <> '{}'
  AND "configJson" ~* '(apikey|token|password|secret|authorization)';

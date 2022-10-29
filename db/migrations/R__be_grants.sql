-- Clean up any too allowing permissions from DB
REVOKE ALL ON DATABASE tyras_db FROM public;
REVOKE ALL ON DATABASE tyras_db FROM tyras_be_login;

-- Allow BE *user* to connect
GRANT CONNECT ON DATABASE tyras_db TO tyras_be_login;

-- Allow BE *role* to use ("see") tables in schema
GRANT USAGE ON SCHEMA public TO tyras_be;

-- Remember to never grant DELETE to any soft-delete table
GRANT SELECT, INSERT, UPDATE ON things TO tyras_be;

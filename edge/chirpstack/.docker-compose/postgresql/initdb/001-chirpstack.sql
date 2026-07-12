CREATE ROLE chirpstack WITH LOGIN PASSWORD 'chirpstack';
CREATE DATABASE chirpstack WITH OWNER chirpstack;

\connect chirpstack

CREATE EXTENSION IF NOT EXISTS pg_trgm;

GRANT ALL PRIVILEGES ON DATABASE chirpstack TO chirpstack;
GRANT ALL ON SCHEMA public TO chirpstack;
ALTER SCHEMA public OWNER TO chirpstack;

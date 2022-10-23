-- We will need pgcrypto to generate UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create common triggers used in soft-delete tables
CREATE OR REPLACE FUNCTION on_soft_delete_table_insert() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.created_at := NOW() AT TIME ZONE 'utc';
  NEW.updated_at := NOW() AT TIME ZONE 'utc';
  NEW.is_deleted := FALSE;
  NEW.deleted_at := NULL;
  RETURN NEW;
END;
$$
;

CREATE OR REPLACE FUNCTION on_soft_delete_table_update() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Don't allow modification of other timestamp columns
  IF OLD.created_at <> NEW.created_at THEN
    NEW.created_at = OLD.created_at;
  END IF;
  IF OLD.deleted_at <> NEW.deleted_at THEN
    NEW.deleted_at = OLD.deleted_at;
  END IF;

  NEW.updated_at := NOW() AT TIME ZONE 'utc';
  RETURN NEW;
END;
$$
;

CREATE OR REPLACE FUNCTION on_soft_delete_table_delete() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Don't allow modification of other timestamp columns
  IF OLD.created_at <> NEW.created_at THEN
    NEW.created_at = OLD.created_at;
  END IF;
  IF OLD.updated_at <> NEW.updated_at THEN
    NEW.updated_at = OLD.updated_at;
  END IF;

  IF NEW.is_deleted IS TRUE THEN
    NEW.deleted_at := NOW() AT TIME ZONE 'utc';
  ELSE
    NEW.updated_at := NOW() AT TIME ZONE 'utc';
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$
;

CREATE OR REPLACE FUNCTION on_soft_delete_table_prevent() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'Do not DELETE rows directly!';
END;
$$
;
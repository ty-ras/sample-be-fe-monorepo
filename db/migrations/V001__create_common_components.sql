-- We will need pgcrypto to generate UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create triggers used in tracking which user modified rows
CREATE OR REPLACE FUNCTION on_user_tracking_table_insert() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Initial state is updated_by being same as created_by, and deleted_by being NULL.
  NEW.updated_by = NEW.created_by;
  NEW.deleted_by = NULL;

  RETURN NEW;
END;
$$
;

CREATE OR REPLACE FUNCTION on_user_tracking_table_update() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Don't allow modification of created_by or deleted_by columns.
  IF OLD.created_by <> NEW.created_by THEN
    NEW.created_by = OLD.created_by;
  END IF;
  IF NEW.deleted_by IS NOT NULL THEN
    NEW.deleted_by = NULL;
  END IF;

  RETURN NEW;
END;
$$
;

CREATE OR REPLACE FUNCTION on_user_tracking_table_delete() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Don't allow modification of created_by column.
  IF OLD.created_by <> NEW.created_by THEN
    NEW.created_by = OLD.created_by;
  END IF;
  IF NEW.is_deleted IS TRUE THEN
    -- Don't allow modification of updated_by column in this case.
    IF OLD.updated_by <> NEW.updated_by THEN
      NEW.updated_by = OLD.updated_by;
    END IF;
  ELSE
    NEW.deleted_by = NULL;
  END IF;

  RETURN NEW;
END;
$$
;

-- Create common triggers used in soft-delete tables
CREATE OR REPLACE FUNCTION on_soft_delete_table_insert() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  NEW.created_at = NOW() AT TIME ZONE 'utc';
  NEW.updated_at = NOW() AT TIME ZONE 'utc';
  NEW.updated_by = NEW.created_by;
  NEW.is_deleted = FALSE;
  NEW.deleted_at = NULL;
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
  -- Don't allow modification of created_at column.
  IF OLD.created_at <> NEW.created_at THEN
    NEW.created_at = OLD.created_at;
  END IF;

  IF NEW.is_deleted IS TRUE THEN
    NEW.deleted_at := NOW() AT TIME ZONE 'utc';
    -- Don't allow modification of updated_at column in this case.
    IF OLD.updated_at <> NEW.updated_at THEN
      NEW.updated_at = OLD.updated_at;
    END IF;
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
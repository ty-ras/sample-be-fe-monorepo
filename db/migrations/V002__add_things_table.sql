-- Add "domain-specific" table 'things', just for purpose of this being a sample.
CREATE TABLE IF NOT EXISTS things(
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  payload TEXT NOT NULL,
  created_by TEXT NOT NULL CHECK (char_length(created_by) > 0), -- Username
  updated_by TEXT NOT NULL CHECK (char_length(updated_by) > 0), -- Username
  deleted_by TEXT NULL CHECK (deleted_by IS NULL OR char_length(deleted_by) > 0), -- Username
  -- The remaining 4 columns are related to soft deleting
  is_deleted BOOLEAN NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, -- UTC
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, -- UTC
  deleted_at TIMESTAMP WITHOUT TIME ZONE NULL, -- UTC
  PRIMARY KEY (id)
);

-- Add necessary triggers to enable soft deletion feature
CREATE TRIGGER things_soft_delete_insert
  BEFORE INSERT ON things
  FOR EACH ROW
  EXECUTE PROCEDURE on_soft_delete_table_insert();

CREATE TRIGGER things_soft_delete_update
  BEFORE UPDATE ON things
  FOR EACH ROW
  WHEN (OLD.is_deleted = NEW.is_deleted)
  EXECUTE PROCEDURE on_soft_delete_table_update();

CREATE TRIGGER things_soft_delete_delete
  BEFORE UPDATE ON things
  FOR EACH ROW
  WHEN (OLD.is_deleted <> NEW.is_deleted)
  EXECUTE PROCEDURE on_soft_delete_table_delete();

CREATE TRIGGER things_soft_delete_prevent
  BEFORE DELETE ON things
  EXECUTE PROCEDURE on_soft_delete_table_prevent();

-- Add necessary triggers to enable user action tracking
CREATE TRIGGER things_user_tracking_insert
  BEFORE INSERT ON things
  FOR EACH ROW
  EXECUTE PROCEDURE on_user_tracking_table_insert();

CREATE TRIGGER things_user_tracking_update
  BEFORE UPDATE ON things
  FOR EACH ROW
  WHEN (OLD.is_deleted = NEW.is_deleted)
  EXECUTE PROCEDURE on_user_tracking_table_update();

CREATE TRIGGER things_user_tracking_delete
  BEFORE UPDATE ON things
  FOR EACH ROW
  WHEN (OLD.is_deleted <> NEW.is_deleted)
  EXECUTE PROCEDURE on_user_tracking_table_delete();

-- Notice that SELECT COUNT(*) is expensive operation in Postgres, as it tries to retrieve *exact* count of rows.
-- But we are not really interested in that - so just pass estimate
-- More info: https://stackoverflow.com/questions/7943233/fast-way-to-discover-the-row-count-of-a-table-in-postgresql
-- Notice that estimation will be 0 on small row counts -> fallback to COUNT(*) then, as table size won't be a problem in that case
-- This is non-generic version which avoids doing query for regclass -> table name conversion.
CREATE FUNCTION things_quick_count()
RETURNS BIGINT
LANGUAGE plpgsql
STRICT
AS
$$
DECLARE
  seen_row_count BIGINT;
BEGIN
  SELECT 100 * COUNT(*) INTO STRICT seen_row_count FROM things TABLESAMPLE SYSTEM (1);
  IF seen_row_count = 0 THEN
    SELECT COUNT(*) INTO STRICT seen_row_count FROM things;
  END IF;
  RETURN seen_row_count;
END
$$;

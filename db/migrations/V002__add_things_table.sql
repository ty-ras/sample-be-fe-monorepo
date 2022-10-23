-- Add "domain-specific" table 'things', just for purpose of this being a sample.
CREATE TABLE IF NOT EXISTS things(
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  payload TEXT NOT NULL,
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

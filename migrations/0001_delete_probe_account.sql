-- Remove the __probe__ test account created during migration testing
DELETE FROM "accounts" WHERE "name" = '__probe__';

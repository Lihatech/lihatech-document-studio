"""Run migration and access checks in one rollback-only DB transaction.

Set LMS_DB_URL and LMS_DB_PASSWORD (or LMS_DB_PASSWORD_FILE). Install psycopg[binary].
--existing tests an already migrated database without applying the migration again.
"""
import os
import sys
from pathlib import Path
import psycopg

password = os.getenv('LMS_DB_PASSWORD')
if not password and os.getenv('LMS_DB_PASSWORD_FILE'):
    password = Path(os.environ['LMS_DB_PASSWORD_FILE']).read_text().strip()
connection = psycopg.connect(os.environ['LMS_DB_URL'], password=password, connect_timeout=20)
try:
    if '--existing' not in sys.argv:
        connection.execute(Path('supabase/migrations/20261014000000_lms_version_one.sql').read_text())
    if '--next' in sys.argv:
        connection.execute(Path('supabase/migrations/20261015000000_batch_end_access.sql').read_text())
    if '--material-next' in sys.argv:
        connection.execute(Path('supabase/migrations/20261016000000_material_publish.sql').read_text())
    connection.execute(Path('supabase/tests/lms_version_one.sql').read_text())
    # Regression checks share the outer rollback transaction.
    studio_checks = Path('supabase/tests/document_studio.sql').read_text().replace('begin;', '').replace('rollback;', '')
    connection.execute(studio_checks)
    print('LMS schema, role isolation, time windows, private materials and booking checks passed. All changes rolled back.')
finally:
    connection.rollback()
    connection.close()

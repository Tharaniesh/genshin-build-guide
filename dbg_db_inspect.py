# # dbg_db_inspect.py
# import os
# from sqlalchemy import create_engine, inspect
# from importlib import import_module

# # Try to load config the same way your app does
# try:
#     cfg = import_module('conf.config')
#     Config = getattr(cfg, 'Config')
#     tmp = Config()
#     uri = getattr(tmp, 'DATABASE_URI', None)
# except Exception:
#     # fallback: read env or common defaults
#     uri = os.environ.get('DATABASE_URI', 'sqlite:///dev.db')

# print("Using DATABASE_URI:", uri)

# engine = create_engine(uri, pool_pre_ping=True, pool_recycle=3600)

# print("Engine:", engine)
# inspector = inspect(engine)

# try:
#     tables = inspector.get_table_names()
#     print("Tables visible to SQLAlchemy inspector:", tables)
# except Exception as e:
#     print("Error listing tables:", e)

# # # Show sqlite file path if sqlite
# # if uri.startswith('sqlite'):
# #     # sqlite:///relative.db  -> relative path; sqlite:////absolute.db -> absolute
# #     path = uri.replace('sqlite:///', '')
# #     print("SQLite file path (from URI):", path)
# #     print("Exists on filesystem?", os.path.exists(path))


import os

# 🔁 CHANGE THIS to your image folder path
FOLDER_PATH = r"D:\project\Genshin impact Build Guide\Build Guid\app\static\portraits"

for filename in os.listdir(FOLDER_PATH):
    old_path = os.path.join(FOLDER_PATH, filename)

    # Skip folders
    if not os.path.isfile(old_path):
        continue

    name, ext = os.path.splitext(filename)

    # Remove '_Icon' (case-insensitive) and lowercase
    new_name = name.replace("_Icon", "").replace("_icon", "").lower()
    new_filename = new_name + ext.lower()

    new_path = os.path.join(FOLDER_PATH, new_filename)

    # Skip if no change
    if old_path == new_path:
        continue

    # Prevent overwrite
    if os.path.exists(new_path):
        print(f"⚠ Skipped (already exists): {new_filename}")
        continue

    os.rename(old_path, new_path)
    print(f"✅ Renamed: {filename} → {new_filename}")

print("🎉 Done renaming images.")

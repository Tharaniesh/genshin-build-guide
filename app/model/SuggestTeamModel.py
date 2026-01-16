# Add this to app/model/BuildModel.py

import json
import re
from sqlalchemy import create_engine, text
from flask import current_app

def get_db_engine():
    """
    Existing engine getter used elsewhere in this module.
    Returns SQLAlchemy engine stored in current_app.extensions['sql_engine']
    or creates one using current_app.config['DATABASE_URI'].
    """
    engine = current_app.extensions.get("sql_engine")
    if engine:
        return engine

    db_uri = current_app.config.get("DATABASE_URI")
    if not db_uri:
        raise RuntimeError("DATABASE_URI is not configured")

    engine = create_engine(db_uri, pool_pre_ping=True, pool_recycle=3600)
    current_app.extensions['sql_engine'] = engine
    return engine

# --- BACKWARDS COMPATIBILITY WRAPPER ---
def get_engine():
    """
    Backwards-compatible alias for get_db_engine() — some modules import get_engine.
    """
    return get_db_engine()

class suggestTeamModel:
    def __init__(self):
        self.engine = get_db_engine()

    def MainDps(self,selectedcharacter):
        # Example method to suggest a team with a main DPS character using pyton and get the required data from the database so its in Model
        try:
            with self.engine.connect() as conn:
                print("Suggesting team with main DPS:", selectedcharacter)
                sql = text("SELECT * FROM characters c INNER JOIN team_entries te ON c.c_id = te.c_id WHERE c.c_id = :selectedcharacter;")
                rows = conn.execute(sql).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            print(f"[SuggestTeamModel.MainDps] {e}")

    def SubDps(self,selectedcharacter):
        try:
            print("Suggesting team with sub DPS:", selectedcharacter)
        except Exception as e:
            print(f"[SuggestTeamModel.SubDps] {e}")

    def Support(self,selectedcharacter):
        try:
            print("Suggesting team with support character:", selectedcharacter)
        except Exception as e:
            print(f"[SuggestTeamModel.Support] {e}")

    def Healer(self,selectedcharacter):
        try:
            print("Suggesting team with healer character:", selectedcharacter)
        except Exception as e:
            print(f"[SuggestTeamModel.Healer] {e}")

    def team_suggestions(self,c_id):
        try:
            with self.engine.connect() as conn:
                sql1 = text("SELECT * FROM team_entries WHERE c_id = :c_id;")
                sql2 = text("SELECT * FROM weapons;")
                sql3 = text("SELECT * FROM artifact_sets;")
                rows1 = conn.execute(sql1, {"c_id": c_id}).mappings().all()
                rows2 = conn.execute(sql2).mappings().all()
                rows3 = conn.execute(sql3).mappings().all()
                compadable_char = [dict(r) for r in rows1]
                wepons = [dict(r) for r in rows2]
                artifacts = [dict(r) for r in rows3]
                return {
                    "team_entries": compadable_char,
                    "weapons": wepons,
                    "artifact_sets": artifacts
                }
        except Exception as e:
            print(f"[SuggestTeamModel.team_suggestions] {e}")
            return {}
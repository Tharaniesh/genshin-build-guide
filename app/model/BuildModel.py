# Add this to app/model/BuildModel.py

import json
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

class buildModel:
    def __init__(self):
        self.engine = get_db_engine()

    # ------------------------
    # Simple table readers
    # ------------------------
    def characters(self):
        sql = text("""select c_id,c_name,c_slug,wt_id,wt_name,e_id,e_name from characters c
	        inner join elements e on e.e_id = c.c_element
            inner join weapon_types wt on wt_id = c.c_weapon_type 
            ORDER BY c_id ASC;""")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            current_app.logger.error(f"[BuildModel.characters] {e}")
            return []

    def weapons(self):
        sql = text("SELECT * FROM weapons ORDER BY w_id ASC;")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            current_app.logger.error(f"[BuildModel.weapons] {e}")
            return []

    def artifact_sets(self):
        sql = text("SELECT * FROM artifact_sets ORDER BY as_id ASC;")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            current_app.logger.error(f"[BuildModel.artifact_sets] {e}")
            return []

    def artifacts(self):
        sql = text("SELECT a.*, s.as_slug, s.as_name FROM artifacts a LEFT JOIN artifact_sets s ON a.as_id = s.as_id ORDER BY a.a_id ASC;")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            current_app.logger.error(f"[BuildModel.artifacts] {e}")
            return []

    def user_characters(self, user_id):
        sql = text("SELECT * FROM user_characters WHERE u_id = :uid ORDER BY uc_id ASC;")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql, {"uid": user_id}).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            current_app.logger.error(f"[BuildModel.user_characters] {e}")
            return []

    def build_slots(self, build_id):
        sql = text("SELECT * FROM build_slots WHERE b_id = :bid ORDER BY bs_index ASC;")
        try:
            with self.engine.connect() as conn:
                rows = conn.execute(sql, {"bid": build_id}).mappings().all()
                return [dict(r) for r in rows]
        except Exception as e:
            current_app.logger.error(f"[BuildModel.build_slots] {e}")
            return []

    # ------------------------
    # Call stored procedure (if you want DB-side scoring)
    # Returns tuple: (team_summary, suggestions_list, rotation_notes_list, recent_actions_list)
    # ------------------------
    def call_compute_suggestions_sp(self, slots_json):
        """
        Calls stored procedure compute_suggestions(slots_json)
        and returns parsed result sets.
        Uses raw_connection so we can iterate multiple result sets.
        """
        raw_conn = self.engine.raw_connection()
        try:
            cursor = raw_conn.cursor(dictionary=True)  # mysql-connector style; if using pymysql, adapt
            cursor.execute("CALL compute_suggestions(%s)", (slots_json,))
            # 1) team_summary
            team_summary = cursor.fetchone() or {}
            # advance
            has_next = cursor.nextset()

            # 2) suggestions
            suggestions = []
            if has_next:
                suggestions = cursor.fetchall() or []
                has_next = cursor.nextset()

            # 3) rotation_notes
            rotation_notes = []
            if has_next:
                rotation_notes = cursor.fetchall() or []
                has_next = cursor.nextset()

            # 4) recent_actions
            recent_actions = []
            if has_next:
                recent_actions = cursor.fetchall() or []

            # commit if SP modifies state
            raw_conn.commit()
            return (team_summary, suggestions, rotation_notes, recent_actions)
        finally:
            try:
                cursor.close()
            except Exception:
                pass
            raw_conn.close()

    # ------------------------
    # Helpers to insert logs/evaluations (optional)
    # ------------------------
    def insert_build_evaluation(self, b_id, overall_score, damage_score=None, energy_score=None, survivability_score=None, synergy_score=None, reaction_paths=None, raw_obj=None):
        sql = text("""
            INSERT INTO build_evaluations (b_id, overall_score, damage_score, energy_score, survivability_score, synergy_score, reaction_paths, raw)
            VALUES (:b_id, :overall_score, :damage_score, :energy_score, :survivability_score, :synergy_score, :reaction_paths, :raw)
        """)
        params = {
            "b_id": b_id,
            "overall_score": overall_score,
            "damage_score": damage_score,
            "energy_score": energy_score,
            "survivability_score": survivability_score,
            "synergy_score": synergy_score,
            "reaction_paths": json.dumps(reaction_paths) if reaction_paths is not None else None,
            "raw": json.dumps(raw_obj) if raw_obj is not None else None
        }
        try:
            with self.engine.connect() as conn:
                conn.execute(sql, params)
            return True
        except Exception as e:
            current_app.logger.error(f"[BuildModel.insert_build_evaluation] {e}")
            return False

    def insert_activity_log(self, b_id, u_id, event, payload=None):
        sql = text("INSERT INTO activity_logs (b_id, u_id, al_event, al_payload) VALUES (:b, :u, :e, :p)")
        try:
            with self.engine.connect() as conn:
                conn.execute(sql, {"b": b_id, "u": u_id, "e": event, "p": json.dumps(payload) if payload else None})
            return True
        except Exception as e:
            current_app.logger.error(f"[BuildModel.insert_activity_log] {e}")
            return False

    def get_user_library_slugs(self, user_id):
        sql = text("SELECT char_slug FROM user_library WHERE user_id = :uid;")
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"uid": user_id}).mappings().all()
                return {row['char_slug'] for row in result}
        except Exception as e:
            current_app.logger.error(f"[BuildModel.get_user_library_slugs] {e}")
            return set()

    def get_user_library_slugs(self, user_id):
        sql = text("SELECT char_slug FROM user_library WHERE user_id = :uid;")
        try:
            with self.engine.connect() as conn:
                result = conn.execute(sql, {"uid": user_id}).mappings().all()
                return {row['char_slug'] for row in result}
        except Exception as e:
            current_app.logger.error(f"[BuildModel.get_user_library_slugs] {e}")
            return set()
    
    def add_user_library_entries(self, user_id, slugs):
        sql = text("INSERT IGNORE INTO user_library (user_id, char_slug) VALUES (:uid, :slug);")
        try:
            with self.engine.connect() as conn:
                conn.execute(sql, [{"uid": user_id, "slug": slug} for slug in slugs])
            return True
        except Exception as e:
            current_app.logger.error(f"[BuildModel.add_user_library_entries] {e}")
            return False
        
    def remove_user_library_entries(self, user_id, slugs):
        sql = text("DELETE FROM user_library WHERE user_id = :uid AND char_slug = :slug;")
        try:
            with self.engine.connect() as conn:
                conn.execute(sql, [{"uid": user_id, "slug": slug} for slug in slugs])
            return True
        except Exception as e:
            current_app.logger.error(f"[BuildModel.remove_user_library_entries] {e}")
            return False
        
            
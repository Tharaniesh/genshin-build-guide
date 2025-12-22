# app/Controller/BuildController.py
import os
from datetime import datetime
import json
from math import e
from time import time
from xml.dom.minidom import CharacterData
from app.model import BuildModel
from flask import Blueprint, render_template, request, jsonify, current_app
from app.model.BuildModel import buildModel, get_engine

build_bp = Blueprint('build', __name__, url_prefix='')

@build_bp.route('/api/check_login')
def check_login():
    login_status = request.cookies.get('login_status', 'false').lower() == 'true'
    if login_status:
        return jsonify({'logged_in': True})
    else:
        return jsonify({'logged_in': False})

@build_bp.route('/')
@build_bp.route('/home')
def home():
    return render_template('home.html')

@build_bp.route('/build_guide')
def build_guide():
    db_chars = buildModel().characters()
    characters = [character_with_image(c) for c in db_chars]
    return render_template('build_guide.html', characters=characters)

@build_bp.route('/slot_card', methods=['GET'])
def slot_card():
    # This should return the fragment template used by the frontend
    return render_template('slot_card.html')

@build_bp.route('/api/result_section', methods=['POST'])
def result_section():
    data = render_template('result_section.html')
    if not data:
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400
    return jsonify({"status": "success", "data": data})

@build_bp.route('/api/action_options', methods=['POST'])
def action_options():
    data = render_template('action_options.html')
    if not data:
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400
    return jsonify({"status": "success", "data": data})


@build_bp.route('/api/result_character_suggestion', methods=['POST'])
def result_character_suggestion():
    try:
        html = render_template('result_character_suggestion.html')
        return jsonify({"status": "success","html": html})
    except Exception as e:
        current_app.logger.error(f"[result_character_suggestion] Failed: {e}",exc_info=True)
        return jsonify({"status": "error","message": str(e)}), 500

@build_bp.route('/api/team_evaluation', methods=['POST'])
def team_evaluation():
    data = render_template('team_eval.html')
    if not data:
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400
    return jsonify({"status": "success", "data": data})

@build_bp.route('/api/apply_library_selection', methods=['POST'])
def apply_library_selection():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"status": "error", "message": "Invalid JSON"}), 400

    user_id = data.get('user_id')
    selected = data.get('selected_characters', [])

    if not user_id or not isinstance(selected, list):
        return jsonify({"status": "error", "message": "Invalid payload"}), 400

    # Normalize slugs
    selected = {
        str(c).strip().lower()
        for c in selected
        if c
    }

    # Existing library (ensure set)
    existing = set(BuildModel.get_user_library_slugs(user_id))

    # Diff
    to_add = selected - existing
    to_remove = existing - selected

    # DB ops
    if to_add:
        BuildModel.add_user_library_entries(user_id, to_add)

    if to_remove:
        BuildModel.remove_user_library_entries(user_id, to_remove)

    return jsonify({
        "status": "success",
        "added": sorted(to_add),
        "removed": sorted(to_remove),
        "final_count": len(selected)
    })


@build_bp.route('/api/search')
def search():
    """
    Robust search endpoint:
    - q: query string
    - type: char|wep|art
    - limit: integer limit (default 12)
    - full: if '1'|'true'|'yes' returns full objects, otherwise returns name-only strings
    """
    try:
        model = buildModel()
        CharacterData = model.characters() or []
        weapons = model.weapons() or []
        artifacts = model.artifacts() or []
    except Exception as e:
        current_app.logger.error(f"[search] Failed to load model data: {e}")
        CharacterData, weapons, artifacts = [], [], []

    q = (request.args.get('q') or '').strip().lower()
    t = (request.args.get('type') or 'char').lower()
    try:
        limit = int(request.args.get('limit') or 12)
    except ValueError:
        limit = 12

    return_full = request.args.get('full') in ('1', 'true', 'yes')

    def to_searchable_string(item):
        """Turn a dict or string into a searchable lowercase string."""
        if isinstance(item, str):
            return item.lower()
        if isinstance(item, dict):
            # Prefer the fields actually present in your rows
            for key in ('c_name', 'c_slug', 'name', 'title', 'display_name', 'key'):
                val = item.get(key)
                if isinstance(val, str) and val:
                    return val.lower()
            # Fallback: join string/number values
            parts = [str(v) for v in item.values() if isinstance(v, (str, int, float))]
            return " ".join(parts).lower()
        return str(item).lower()

    def extract_name(item):
        """Return the human name to display (prefer c_name then c_slug)."""
        if isinstance(item, dict):
            return item.get('c_name') or item.get('name') or item.get('title') or item.get('c_slug') or ""
        return str(item)

    def match_list(lst):
        """Return up to `limit` items from lst that match q. Keeps original item structure."""
        if not q:
            return lst[:limit]
        out = []
        for x in lst:
            try:
                if q in to_searchable_string(x):
                    out.append(x)
            except Exception as e:
                current_app.logger.debug(f"[match_list] skipping item due to: {e}")
            if len(out) >= limit:
                break
        return out

    if t == 'char':
        found = match_list(CharacterData)
    elif t in ('wep', 'weapon', 'weapons'):
        found = match_list(weapons)
    elif t in ('art', 'artifact', 'artifacts'):
        found = match_list(artifacts)
    else:
        found = []

    if return_full:
        current_app.logger.debug(f"[search] returning {len(found)} full objects")
        return jsonify(found)

    # default: return name-only list (strings)
    names = [extract_name(x) for x in found]
    current_app.logger.debug(f"[search] returning {len(names)} names")
    return jsonify(names)

def character_with_image(char):
    slug = char['c_slug']  # dict-based
    img_path = os.path.join(current_app.root_path,'static','portraits',f'{slug}.png')
    char['has_image'] = os.path.exists(img_path)
    return char


# app/Controller/BuildController.py
import os
from datetime import datetime
import json
from math import e
from time import time
from xml.dom.minidom import CharacterData
from app.model import BuildModel
from flask import Blueprint, render_template, request, jsonify, current_app, redirect as redirect_url
from app.model.BuildModel import buildModel, get_engine

dmgcal = Blueprint('dmgcal', __name__, url_prefix='')

@dmgcal.route('/damage_calculator')
def damage_calculator():
    return render_template('damage_calculator.html')

@dmgcal.route('/api/calculate_damage', methods=['POST'])
def calculate_damage():
    data = request.json
    # Placeholder logic for damage calculation
    base_attack = data.get('base_attack', 100)
    multiplier = data.get('multiplier', 1.0)
    damage = base_attack * multiplier
    
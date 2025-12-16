# app/__init__.py
import os
from flask import Flask
# import the DB helper from conf.config (ensure conf is a package)
from conf.config import get_db_connection

def create_app(config_object=None):
    app = Flask(__name__, instance_relative_config=False)
    print("🚀 Initializing Flask application")
    if config_object:
        print(f"🔧 Loading config from {config_object}")
        app.config.from_object(config_object)
    else:
        try:
            print("🔧 Loading default config from 'conf.config.Config'")
            app.config.from_object('conf.config.Config')
        except Exception as e:
            print(f"⚠ Failed to load default config, using empty config : {e}")
            app.config.setdefault('DATABASE_URI', 'sqlite:///:memory:')
    try:
        conn = get_db_connection()
        if conn is not None and getattr(conn, "is_connected", lambda: True)():
            app.logger.info("✅ Database connection established")
        else:
            app.logger.warning("❌ Database connection failed: Connection object is None")
    except Exception as e:
        app.logger.warning(f"❌ Database connection error: {e}")
    finally:
        try:
            if 'conn' in locals() and conn:
                conn.close()
        except Exception:
            pass
    try:
        from .Controller.BuildController import build_bp
        app.register_blueprint(build_bp)
        app.logger.info("📌 BuildController loaded and blueprint registered")
    except Exception as e:
        app.logger.warning(f"⚠ Controller load failed during registration: {e}")
        app.logger.warning("⚠ Only root routes are active")

    return app
try:
    app = create_app()
except Exception:
    app = None

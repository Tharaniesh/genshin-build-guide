import mysql.connector

class Config(object):
	DEBUG = False
	TESTING = False
	DATABASE_URI = 'mysql+mysqlconnector://root:1234@127.0.0.1/genshin_team_optimizer'

def get_db_connection():
    try:
        config = {
            "user": "root",
            "password": "1234",      # <-- correct password if this is your actual MySQL password
            "host": "127.0.0.1",
            "database": "genshin_team_optimizer",
            "raise_on_warnings": True,
        }

        conn = mysql.connector.connect(**config)
        print("Database connection successful.")
        return conn

    except mysql.connector.Error as err:
        print(f"[DB ERROR] {err}")
        return None


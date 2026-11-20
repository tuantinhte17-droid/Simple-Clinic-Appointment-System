from dotenv import load_dotenv
load_dotenv()

from app.database import init_db, seed_db, is_postgres, get_db_url

print(f"Connecting to: {get_db_url()}")
print(f"Is PostgreSQL: {is_postgres()}")

print("Initializing Schema...")
init_db()
print("✓ Schema initialized.")

print("Seeding Initial Data...")
seed_db()
print("✓ Data seeded successfully.")
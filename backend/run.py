import os
from dotenv import load_dotenv
from app import create_app
from app.extensions import socket_io

load_dotenv()

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5005))
    debug = os.environ.get('FLASK_DEBUG', 'True').lower() == 'true'
    print("==================================================")
    print(" Clinic Appointment System - Flask Server")
    print(f" Server running at: http://localhost:{port}")
    print(f" API Health check: http://localhost:{port}/api/health")
    print("==================================================")
    socket_io.run(app, host='127.0.0.1', port=port, debug=debug, use_reloader = False)

from flask_socketio import SocketIO

socket_io = SocketIO(cors_allowed_origins=[
        "http://localhost:3000",
        "http://localhost:5173"
    ], async_mode="threading")

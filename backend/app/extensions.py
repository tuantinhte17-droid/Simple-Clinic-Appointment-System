from flask_socketio import SocketIO

socket_io = SocketIO(cors_allowed_origins="*", async_mode="threading")

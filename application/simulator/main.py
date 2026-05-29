import threading
from flask import Flask, jsonify, request
from acoustics import generate_signals
from streaming import UDPStreamer
from telemetry import TelemetrySimulator
from config import PORT

app = Flask(__name__)
streamer = None
simulation_thread = None
telemetry_sim = None
telemetry_thread = None

@app.route('/start', methods=['POST'])
def start_sim():
    global streamer, simulation_thread, telemetry_sim, telemetry_thread
    if streamer and streamer.running:
        return jsonify({"status": "already running"})
    
    signals = generate_signals()
    
    streamer = UDPStreamer()
    simulation_thread = threading.Thread(target=streamer.stream_loop, args=(signals,))
    simulation_thread.daemon = True
    simulation_thread.start()
    
    telemetry_sim = TelemetrySimulator()
    telemetry_thread = threading.Thread(target=telemetry_sim.loop)
    telemetry_thread.daemon = True
    telemetry_thread.start()
    
    return jsonify({"status": "started"})

@app.route('/stop', methods=['POST'])
def stop_sim():
    global streamer, simulation_thread, telemetry_sim, telemetry_thread
    if not (streamer and streamer.running):
        return jsonify({"status": "not running"})
        
    streamer.stop()
    simulation_thread.join()
    
    if telemetry_sim:
        telemetry_sim.stop()
        telemetry_thread.join()
        
    return jsonify({"status": "stopped"})

@app.route('/toggle', methods=['POST'])
def toggle_sim():
    data = request.get_json() or {}
    active = data.get("active", False)
    if active:
        return start_sim()
    else:
        return stop_sim()

@app.route('/status', methods=['GET'])
def status_sim():
    is_running = streamer is not None and streamer.running
    return jsonify({"status": "running" if is_running else "stopped"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT)

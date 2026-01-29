import numpy as np
import json
import os
from scipy.optimize import least_squares
try:
    from .visualization import Visualizer
except ImportError:
    from visualization import Visualizer

# --- PATH CONFIGURATION ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAMPLES_FOLDER = os.path.join(BASE_DIR, "..", "files", "samples", "generated")
METADATA_FILE = os.path.join(SAMPLES_FOLDER, 'activity_metadata.json')

# --- PHYSICAL CONSTANTS ---
C = 343.0  # Speed of Sound (m/s)

MIC_COORDS = np.array([
    [0.0, 0.0],  # Mic 0 (Reference)
    [5.0, 0.0],  # Mic 1
    [5.0, 5.0],  # Mic 2
    [0.0, 5.0]   # Mic 3
])


def load_system_metadata(filepath):
    """Loads enriched metadata containing sample rate and GCC-PHAT delays."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Metadata file missing: {filepath}")

    with open(filepath, 'r') as f:
        return json.load(f)


def tdoa_residuals(position, mic_coords, measured_tdoas):
    """Calculates the residual error between measured and theoretical TDOAs."""
    x, y = position
    # Euclidean distances from hypothesized (x,y) to each mic
    distances = np.sqrt(np.sum((mic_coords - [x, y])**2, axis=1))

    # Travel times in seconds
    times = distances / C

    # Theoretical TDOAs relative to Mic 0
    theoretical_tdoas = times[1:] - times[0]

    return theoretical_tdoas - measured_tdoas


def triangulate_xy(sample_delays, sample_rate):
    """
    Solves for (x, y) coordinates using the enriched 'delays' list from JSON.
    """
    # Convert sample delays to time (seconds)
    measured_tdoas = np.array(sample_delays) / sample_rate

    # Initial guess: Center of the defined microphone area
    center_guess = np.mean(MIC_COORDS, axis=0)

    # Nonlinear Least Squares Optimization
    res = least_squares(
        tdoa_residuals,
        center_guess,
        args=(MIC_COORDS, measured_tdoas),
        # Constraints: Keeping the solver inside the room boundaries
        bounds=([0, 0], [np.max(MIC_COORDS[:, 0]), np.max(MIC_COORDS[:, 1])])
    )

    return res.x, res.cost


if __name__ == "__main__":
    try:
        metadata = load_system_metadata(METADATA_FILE)
        fs = metadata['sample_rate']
        segments = metadata['active_segments']

        print(
            f"[*] System Config: {fs} Hz | Room: {np.max(MIC_COORDS[:,0])}x{np.max(MIC_COORDS[:,1])}m")
        print(
            f"[*] Found {len(segments)} active segments with pre-calculated delays.")
        print("-" * 60)

        viz_dir = os.path.join(SAMPLES_FOLDER, 'visualizations')
        viz = Visualizer(viz_dir)
        room_dims = [np.max(MIC_COORDS[:, 0]), np.max(MIC_COORDS[:, 1])]

        #  through each segment and solve its position
        for i, seg in enumerate(segments):
            # Check if 'delays' key exists (to ensure solve_tdoa.py was run)
            if 'delays' not in seg:
                print(
                    f"[!] Segment {i} has no delay data. Run solve_tdoa.py first.")
                continue

            sample_delays = seg['delays']

            # Perform Triangulation
            pos, cost = triangulate_xy(sample_delays, fs)
            
            # Visualize Location
            if i < 5:
                viz.plot_location(MIC_COORDS, pos, room_dims, i)

            print(
                f"Segment {i} | Samples: {seg['start_sample']}:{seg['end_sample']}")
            print(f"  -> Input Delays: {sample_delays} samples")
            print(
                f"  -> Result: X = {pos[0]:.3f}m, Y = {pos[1]:.3f}m (Residual Error: {cost:.6f})")
            print("-" * 60)

    except Exception as e:
        print(f"[!] Error: {e}")

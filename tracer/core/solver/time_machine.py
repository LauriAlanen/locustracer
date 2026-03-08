import os
import librosa
import numpy as np
import json
from .feature_extractor import extract_active_segments
from .gcc_phat_solver import compute_delays
from .location_solver import compute_locations, MIC_COORDS
from .visualization import Visualizer

class TimeMachine:
    def __init__(self, input_file: str, output_dir: str, visualize: bool = True):
        """
        Initializes the TimeMachine.

        Args:
            input_file: Path to the input 4-channel WAV file.
            output_dir: Directory where results and visualizations will be saved.
            visualize: Whether to generate plots.
        """
        self.input_file = input_file
        self.output_dir = output_dir
        self.visualize = visualize
        self.visualizer = None
        
        if self.visualize:
            self.visualizer = Visualizer(self.output_dir)
            
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def run(self):
        """
        Executes the full pipeline:
        1. Feature Extraction (Active Segment Detection)
        2. Delay Estimation (GCC-PHAT)
        3. Location Solving (Triangulation)
        """
        print(f"[*] Starting TimeMachine Pipeline")
        print(f"[*] Input File: {self.input_file}")
        
        # 1. Feature Extraction
        print("\n[Step 1] Feature Extraction...")
        segments = extract_active_segments(self.input_file)
        if not segments:
            print("[!] No active segments found. Aborting.")
            return

        # 2. Load Data for Processing
        print("\n[Step 2] Loading Audio Data...")
        data, sr = librosa.load(self.input_file, sr=None, mono=False)
        
        # 3. Compute Delays
        print("\n[Step 3] Computing Delays (GCC-PHAT)...")
        # Note: compute_delays modifies segments in-place but we pass it anyway
        enriched_segments = compute_delays(data, segments, self.visualizer)
        
        # 4. Solve Locations
        print("\n[Step 4] Solving Locations...")
        room_dims = [np.max(MIC_COORDS[:, 0]), np.max(MIC_COORDS[:, 1])]
        locations = compute_locations(enriched_segments, sr, MIC_COORDS, room_dims, self.visualizer)
        
        # 5. Save Results
        self._save_results(enriched_segments, locations, sr)
        print("\n[*] TimeMachine Pipeline Completed Successfully.")

    def _save_results(self, segments, locations, sr):
        """Saves the final results to a JSON file."""
        output_file = os.path.join(self.output_dir, "timemachine_results.json")
        
        data = {
            "source_file": self.input_file,
            "sample_rate": sr,
            "processed_segments": segments,
            "locations": locations
        }
        
        with open(output_file, 'w') as f:
            json.dump(data, f, indent=4)
            
        print(f"[*] Results saved to: {output_file}")

import os
import sys

# Ensure we can import from core
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from core.solver.time_machine import TimeMachine

def test_pipeline():
    # Define paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    samples_dir = os.path.join(base_dir, "..", "files", "samples", "generated")
    input_file = os.path.join(samples_dir, 'simulation_4ch_room.wav')
    output_dir = os.path.join(samples_dir, 'pipeline_output')
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"[!] Test input file not found: {input_file}")
        print("    Please run 'tools/do_generate_samples.py' first.")
        return

    # Initialize TimeMachine
    tm = TimeMachine(input_file, output_dir, visualize=False)
    
    # Run Pipeline
    tm.run()
    
    # Verify Output
    result_file = os.path.join(output_dir, "timemachine_results.json")
    if os.path.exists(result_file):
        print(f"\n[PASS] Pipeline output generated at: {result_file}")
    else:
        print(f"\n[FAIL] Pipeline output file NOT found.")

if __name__ == "__main__":
    test_pipeline()

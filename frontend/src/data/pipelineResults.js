// Pipeline results from TimeMachine
// In production this would come from an API endpoint

export const ROOM_DIMS = { width: 5, depth: 5, height: 3 };

export const MIC_POSITIONS = [
  { id: 0, label: 'Mic 0', position: [0, 0], color: '#4da6ff' },
  { id: 1, label: 'Mic 1', position: [5, 0], color: '#4da6ff' },
  { id: 2, label: 'Mic 2', position: [5, 5], color: '#4da6ff' },
  { id: 3, label: 'Mic 3', position: [0, 5], color: '#4da6ff' },
];

export const pipelineResults = {
  source_file: 'simulation_4ch_room.wav',
  sample_rate: 44100,
  processed_segments: [
    {
      start_sample: 51200,
      end_sample: 71680,
      delays: [178, 0, -294],
    },
  ],
  locations: [
    {
      segment_idx: 0,
      position: [1.202275012435951, 3.7991919788067023],
      cost: 4.5359186875985174e-11,
    },
  ],
};

# Reference Audio Analysis Format V1

Status: required format before atomic-material production

## 1. Access classes

Every reference is assigned one access class:

- `licensed_file`: a lawful local file or provider output that can be
  analyzed, fingerprinted, and retained under its license;
- `public_domain_file`: a public-domain recording or score with a separate
  recording-rights check;
- `stream_only`: playable for human listening but not legally available for
  local machine analysis or retention;
- `temporary_analysis_copy`: an exact source stream temporarily decoded for
  internal measurement, retained only until the machine record is written;
- `unavailable`: the exact recording cannot be identified or accessed.

`licensed_file`, approved `public_domain_file`, and an explicitly documented
`temporary_analysis_copy` can produce precise machine acoustic features.
`stream_only` can produce a human listening record and high-level hypothesis
only. `unavailable` must be replaced before it can influence production
parameters.

## 2. Required analysis record

```json
{
  "referenceId": "sleep_saman",
  "source": {
    "title": "saman",
    "creator": "Ólafur Arnalds",
    "sourceUrl": "https://...",
    "accessClass": "licensed_file",
    "fileSha256": "...",
    "observedOn": "2026-07-21",
    "rightsBoundary": "internal_analysis_only",
    "licenseEvidence": "...",
    "alternateSourceIdentity": {
      "referenceSourceUrl": "https://...",
      "analysisSourceUrl": "https://...",
      "titleCreatorMatch": true,
      "first30SecondsVerificationMethod": "direct_source|acoustic_fingerprint|music_recognition|human_ab",
      "first30SecondsDetectedTitle": "...",
      "first30SecondsDetectedCreator": "...",
      "first30SecondsMatch": true,
      "verifiedOn": "2026-07-21"
    }
  },
  "audio": {
    "sourceDurationSeconds": 0,
    "analyzedDurationSeconds": 0,
    "analysisCoverage": {
      "beginning": { "startSeconds": 0, "endSeconds": 0 },
      "middle": { "startSeconds": 0, "endSeconds": 0 },
      "end": { "startSeconds": 0, "endSeconds": 0 }
    },
    "durationSeconds": 0,
    "sampleRate": 0,
    "channels": 0,
    "integratedLufs": 0,
    "loudnessRangeLu": 0,
    "truePeakDbtp": 0,
    "spectralCentroidHz": 0,
    "highFrequencyEnergyRatio": 0,
    "onsetRatePerMinute": 0,
    "silenceGaps": [],
    "voiceProbability": 0,
    "beatProbability": 0,
    "loopBoundaryScore": 0
  },
  "music": {
    "tempoBpm": { "min": 0, "max": 0, "confidence": 0 },
    "meter": { "value": "unknown", "confidence": 0 },
    "keyOrMode": { "value": "unknown", "confidence": 0 },
    "register": { "lowMidi": 0, "highMidi": 0, "centerMidi": 0, "confidence": 0 },
    "instrumentRoles": [],
    "chordChangeBars": { "min": 0, "max": 0, "confidence": 0 },
    "motifLengthNotes": { "min": 0, "max": 0, "confidence": 0 },
    "phraseLengthBars": { "min": 0, "max": 0, "confidence": 0 },
    "noteDensityPerMinute": 0,
    "melodyContour": "unknown",
    "form": []
  },
  "humanListening": {
    "voice": "none|present|uncertain",
    "sceneFit": { "sleep": 0, "calm": 0, "focus": 0 },
    "strongBeat": false,
    "emotionalLift": false,
    "largeReverb": false,
    "mechanicalOrBuzz": false,
    "startleRisk": 0,
    "notes": "...",
    "decision": "keep|contrast_only|reject|replace"
  },
  "derivedProductionParameters": {
    "allowedGoals": [],
    "instrumentFamilies": [],
    "tempoRange": [0, 0],
    "registerRangeMidi": [0, 0],
    "density": "very_low|low|medium_low|medium",
    "harmonyMotion": "static|slow|moderate",
    "environmentCompatibility": [],
    "forbiddenFeatures": [],
    "confidence": 0,
    "derivationNotes": "..."
  },
  "analysisProvenance": {
    "analysisVersion": "reference-audio-analysis-v1",
    "machineTools": [],
    "humanReviewer": "project_owner|pending",
    "analyzedFromExactAudio": false,
    "approvedForAtomicMaterialPlanning": false
  }
}
```

## 3. Analysis pipeline

1. Resolve the exact recording and analysis access path.
2. When an alternate source is used, require matching title/creator plus a
   first-30-second acoustic fingerprint, music-recognition, or human A/B
   result. Metadata alone cannot establish source identity.
3. Decode the complete track when it is shorter than 30 minutes. For a track
   longer than 30 minutes, analyze at least the first 30 minutes and include
   representative windows from the beginning, middle, and end. A 30-second
   preview is triage-only and can never become a formal analysis record.
4. Calculate SHA-256 and technical metadata for the temporary analysis copy.
5. Run `ffprobe`/`librosa`/`scipy`/`pyloudnorm` features for loudness, spectrum,
   onsets, silence, beat probability, voice probability, and loop boundaries.
6. Run music-structure analysis for tempo, key/mode, register, phrase and
   section boundaries, instrument roles, motif density, and energy arc.
7. Complete human listening fields, including scene fit and rejection risks.
8. Derive production parameter ranges with confidence and explicit exclusions.
9. Delete the temporary analysis copy after the record and reproducibility
   metadata are written.
10. Require project-owner approval before a record can influence API prompts.

## 4. Confidence rules

- Exact audio + machine feature + human listening: eligible for production
  parameter derivation.
- `analyzedDurationSeconds` must be the full source duration when the source is
  shorter than 1800 seconds, otherwise it must be at least 1800 seconds.
- `analysisCoverage.beginning`, `.middle`, and `.end` must all be non-empty;
  they are mandatory for long-form tracks and recommended for every source.
- Any alternate analysis source must have
  `alternateSourceIdentity.first30SecondsMatch=true`; title, creator, and
  duration metadata without an acoustic first-30-second check are insufficient.
- Stream-only + human listening: high-level reference only; not eligible for
  exact acoustic numbers or copied note data.
- Metadata/title only: research hypothesis only; cannot set generator values.
- Unidentified or mismatched source: replace, never infer.

No record can authorize API material generation unless
`analyzedFromExactAudio=true`, `humanListening.decision` is `keep` or
`contrast_only`, rights evidence is present, and the project owner approves the
derived parameters.

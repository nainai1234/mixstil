import { buildLyriaRequestBody, extractLyriaAudioOutput } from './lyriaProvider';

const requestBody = buildLyriaRequestBody('A seamless 30-second ambient meditation loop for sleep. Warm low drone, soft ocean-like air, slow evolving pads, no drums, no vocals. Peaceful, non-distracting, loopable.');

if (requestBody.model !== 'lyria-3-clip-preview') throw new Error('Lyria request body did not preserve the model.');
if (!Array.isArray(requestBody.input) || requestBody.input[0]?.type !== 'text') throw new Error('Lyria request body did not use the expected text input.');

const sample = extractLyriaAudioOutput({
  outputs: [
    { type: 'text', text: 'ignored' },
    { type: 'audio', data: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjE2MQAAAAAAAAAAAAAA//tQxAADBzQAAAGkAAABqAAACcQAAAnEAAAKmAAACpgAAAtUAAALVAAADMAAAMwAAAOkAAADpAAAQ9AAAEPQAAEPUAAARFAAAFRAAABVgAAAVYAAAGXAAABlwAABkAAAAYAAAAGQAAABrAAABrwAAB7gAAAe4AAAe8AAAHvQAA', mime_type: 'audio/mpeg' },
  ],
});

if (sample.type !== 'audio' || sample.mime_type !== 'audio/mpeg' || !sample.data) throw new Error('Lyria audio extraction failed.');

console.log(JSON.stringify({ passed: true, model: requestBody.model, mimeType: sample.mime_type }, null, 2));

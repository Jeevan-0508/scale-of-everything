// Conversational layer. An instruction-tuned model runs on WebGPU and answers
// in prose, but every number it is allowed to state comes from the catalogue
// rather than from the model's weights. That split is the point: the model
// supplies language, the data supplies facts.

import * as webllm from '@mlc-ai/web-llm';

const MODEL = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

let engine = null;
let history = [];
let searchFn = null;

const SYSTEM = [
  'You are a guide to a visualisation that spans ten scales, from the Earth to the',
  'edge of the observable universe and then to two clearly-labelled speculative levels.',
  '',
  'Rules you must follow:',
  '1. A CONTEXT block may be supplied with each question. Numbers in CONTEXT come from',
  '   published astronomical catalogues. Prefer them over anything you remember, and',
  '   quote them as given.',
  '2. Never invent a distance, magnitude or count. If a figure is not in CONTEXT and you',
  '   are not certain of it, say plainly that the data here does not include it.',
  '3. If CONTEXT is about something other than what was asked, say so rather than',
  '   pretending it answers the question.',
  '4. The multiverse level is a published hypothesis with no observational confirmation.',
  '   The omniverse level is not science at all. Never present either as established.',
  '5. Reply conversationally, two to four sentences, no bullet points and no headings.',
  '   Curiosity is welcome; padding is not.',
].join('\n');

export async function webgpuAvailable() {
  // navigator.gpu exists in any secure context, including where no usable
  // adapter is present, so asking for the adapter is the only real test.
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch (err) {
    return false;
  }
}

export function attachSearch(fn) { searchFn = fn; }

export async function loadEngine(onProgress) {
  if (engine) return engine;
  engine = await webllm.CreateMLCEngine(MODEL, {
    initProgressCallback: (report) => {
      if (!onProgress) return;
      const frac = report && report.progress != null ? report.progress : 0;
      onProgress(frac, report && report.text);
    },
  });
  history = [{ role: 'system', content: SYSTEM }];
  return engine;
}

// Turn a matched catalogue entry into a compact factual block. Only fields that
// actually exist are emitted, so the model is never handed a null to narrate.
function contextFor(entry) {
  if (!entry) return null;
  const p = entry.payload;
  const lines = [];
  if (entry.kind === 'star') {
    lines.push('Object: ' + p.name + ' (star)');
    lines.push('Distance: ' + p.dist_ly + ' light years, ' + p.dist_pc + ' parsecs');
    lines.push('Apparent magnitude: ' + p.mag);
    if (p.absmag != null) lines.push('Absolute magnitude: ' + p.absmag);
    if (p.spect) lines.push('Spectral type: ' + p.spect);
    if (p.lum_sun != null) lines.push('Luminosity: ' + p.lum_sun + ' times the Sun');
    if (p.con) lines.push('Constellation: ' + p.con);
    lines.push('Source: HYG v4.1 (Hipparcos, Yale, Gliese)');
  } else if (entry.kind === 'galaxy') {
    lines.push('Object: ' + p.name + ' (galaxy)');
    if (p.messier) lines.push('Messier number: ' + p.messier);
    lines.push('Catalogue designation: ' + p.desig);
    lines.push('Distance: ' + p.dist_mpc + ' Mpc, ' + p.dist_mly + ' million light years');
    if (p.morph) lines.push('Morphology: ' + p.morph);
    if (p.note) lines.push('Note: ' + p.note);
    lines.push('Source: Cosmicflows-3 (Tully et al. 2016)');
  } else if (entry.kind === 'cluster') {
    lines.push('Object: ' + p.name + ' (galaxy cluster)');
    lines.push('Distance: ' + p.dist_mpc + ' Mpc, ' + p.dist_mly + ' million light years');
    lines.push('Member galaxies with measured distances: ' + p.members);
    if (p.note) lines.push('Note: ' + p.note);
    lines.push('Source: Cosmicflows-3 group assignments');
  } else if (entry.kind === 'level') {
    lines.push('Scale level: ' + p.name + ' (' + p.scaleLabel + ')');
    lines.push('Evidence status: ' + p.evidence);
    lines.push('Summary: ' + p.summary);
    if (p.facts && p.facts.length) lines.push('Facts: ' + p.facts.join('; '));
    lines.push('Source: ' + p.source);
  }
  return lines.length ? lines.join('\n') : null;
}

export async function ask(question, onToken) {
  if (!engine) throw new Error('engine not loaded');

  let matched = null;
  if (searchFn) {
    try { matched = await searchFn(question); } catch (err) { matched = null; }
  }
  const context = contextFor(matched);

  const userContent = context
    ? 'CONTEXT (from the catalogue, authoritative):\n' + context + '\n\nQuestion: ' + question
    : 'No catalogue entry matched this question.\n\nQuestion: ' + question;

  history.push({ role: 'user', content: userContent });

  const stream = await engine.chat.completions.create({
    messages: history,
    temperature: 0.6,
    max_tokens: 320,
    stream: true,
  });

  let text = '';
  for await (const chunk of stream) {
    const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (delta && delta.content) {
      text += delta.content;
      onToken && onToken(text);
    }
  }

  history.push({ role: 'assistant', content: text });
  // Keep the system prompt plus a sliding window, so long sessions do not
  // grow past the context limit and silently start dropping the rules.
  if (history.length > 13) history = [history[0]].concat(history.slice(-10));

  return { text: text.trim(), matched, context };
}

export function resetConversation() {
  history = [{ role: 'system', content: SYSTEM }];
}

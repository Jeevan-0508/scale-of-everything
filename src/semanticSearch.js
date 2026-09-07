// Semantic search over everything on the ladder, using a sentence embedding
// model that runs entirely in the browser. This is a progressive upgrade:
// main.js keeps keyword search working from the first frame and only switches
// over once buildIndex resolves, so a slow or blocked CDN degrades quietly
// instead of breaking the page.

import { pipeline } from '@huggingface/transformers';

let extractor = null;
let vectors = null;    // Float32Array[] aligned with `entries`
let entries = null;
let ready = false;

export function isReady() { return ready; }

// Mean-pool the token embeddings, then L2-normalise, so a dot product is the
// cosine similarity. all-MiniLM-L6-v2 is trained for exactly this pooling.
function meanPool(output) {
  const data = output.data;
  const [, tokens, dims] = output.dims;
  const out = new Float32Array(dims);
  for (let t = 0; t < tokens; t++) {
    const off = t * dims;
    for (let d = 0; d < dims; d++) out[d] += data[off + d];
  }
  let norm = 0;
  for (let d = 0; d < dims; d++) { out[d] /= tokens; norm += out[d] * out[d]; }
  norm = Math.sqrt(norm) || 1;
  for (let d = 0; d < dims; d++) out[d] /= norm;
  return out;
}

async function embed(text) {
  const output = await extractor(text, { pooling: 'none', normalize: false });
  return meanPool(output);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Embed every searchable entry. Only a subset is embedded: 60,000 stars would
 * take minutes and the named objects are what anyone actually asks for.
 */
export async function buildIndex(allEntries, onProgress) {
  entries = allEntries.filter((e) => e.kind === 'level' || e.kind === 'cluster' ||
    (e.payload && (e.payload.notable || e.kind === 'star')));
  if (!entries.length) throw new Error('nothing to index');

  onProgress && onProgress(0.02);
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'q8',
    progress_callback: (p) => {
      if (p && p.progress != null) onProgress && onProgress(0.02 + (p.progress / 100) * 0.55);
    },
  });

  vectors = new Array(entries.length);
  for (let i = 0; i < entries.length; i++) {
    vectors[i] = await embed(entries[i].blurb);
    if (i % 12 === 0) onProgress && onProgress(0.57 + (i / entries.length) * 0.43);
  }
  onProgress && onProgress(1);
  ready = true;
  return { indexed: entries.length };
}

export async function search(query, minScore) {
  if (!ready) return null;
  const q = await embed(query);
  let best = -1, bestScore = -Infinity;
  for (let i = 0; i < vectors.length; i++) {
    const s = dot(q, vectors[i]);
    if (s > bestScore) { bestScore = s; best = i; }
  }
  const floor = minScore != null ? minScore : 0.24;
  if (best < 0 || bestScore < floor) return null;
  return { entry: entries[best], score: bestScore };
}

export function indexedCount() { return entries ? entries.length : 0; }

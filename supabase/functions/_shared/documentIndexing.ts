import {
  chunkText,
  deletePineconeByDocument,
  embedTexts,
  extractTextFromUrl,
  upsertPineconeVectors,
} from './assistant.ts';

export interface IndexDocumentInput {
  documentId: string;
  namespace: string;
  fileUrl: string;
  mimeType?: string | null;
  name: string;
  description?: string | null;
  extraMetadata?: Record<string, unknown>;
}

export interface IndexResult {
  vectorCount: number;
  namespace: string;
}

export async function indexDocumentToPinecone(input: IndexDocumentInput): Promise<IndexResult> {
  let text = '';
  try {
    text = await extractTextFromUrl(input.fileUrl, input.mimeType);
  } catch {
    text = [input.name, input.description].filter(Boolean).join('\n');
    if (!text) throw new Error('No text could be extracted from this document');
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    throw new Error('No text could be extracted from this document');
  }

  await deletePineconeByDocument(input.documentId, input.namespace);

  const embeddings = await embedTexts(chunks);
  if (embeddings.length !== chunks.length) {
    throw new Error('Embedding generation failed — check LLM_API_KEY');
  }

  const vectors = chunks.map((chunk, index) => ({
    id: `${input.documentId}-${index}`,
    values: embeddings[index],
    metadata: {
      document_id: input.documentId,
      chunk_index: index,
      file_name: input.name,
      text_preview: chunk.slice(0, 280),
      text: chunk.slice(0, 2000),
      ...input.extraMetadata,
    },
  }));

  const batchSize = 50;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);
    const ok = await upsertPineconeVectors(input.namespace, batch);
    if (!ok) throw new Error('Pinecone upsert failed');
  }

  return { vectorCount: vectors.length, namespace: input.namespace };
}

export function qmsNamespace(companyId: string): string {
  return `qms-${companyId}`;
}

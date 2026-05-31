import { pipeline, env } from '@xenova/transformers';

// Disable local models, we fetch from CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

class AIEngine {
  static instance = null;
  static modelName = 'Xenova/all-MiniLM-L6-v2';
  
  static async getInstance(progressCallback) {
    if (this.instance === null) {
      this.instance = await pipeline('feature-extraction', this.modelName, {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }

  static async getEmbedding(text) {
    const extractor = await this.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  static cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// Global cache for FAQ embeddings to avoid recomputing
let faqEmbeddingsCache = [];

export async function initAIEngine(faqs, onProgress) {
  await AIEngine.getInstance(onProgress);
  
  if (faqEmbeddingsCache.length === 0) {
    // We only compute embeddings once for performance
    console.log('[AI Engine] Computing dense vectors for FAQs...');
    for (const faq of faqs) {
      const textToEmbed = `Question: ${faq.q} Category: ${faq.category} Answer: ${faq.a || faq.description || ''}`;
      const embedding = await AIEngine.getEmbedding(textToEmbed);
      faqEmbeddingsCache.push({ ...faq, embedding });
    }
    console.log('[AI Engine] Dense vectors computed!');
  }
}

export async function searchAIFaqs(queryText, topK = 5) {
  if (faqEmbeddingsCache.length === 0) return [];
  
  const queryEmbedding = await AIEngine.getEmbedding(queryText);
  
  const scored = faqEmbeddingsCache.map(faq => {
    const score = AIEngine.cosineSimilarity(queryEmbedding, faq.embedding);
    return { faq, score };
  });

  scored.sort((a, b) => b.score - a.score);
  
  // Transform to match old nlp-search format
  return scored.slice(0, topK).map(s => {
    let confidence = { level: 'low', color: '#64748b', label: 'Weak Match' };
    if (s.score > 0.8) confidence = { level: 'high', color: '#10b981', label: 'High Confidence' };
    else if (s.score > 0.65) confidence = { level: 'medium', color: '#f59e0b', label: 'Good Match' };
    else if (s.score > 0.5) confidence = { level: 'low', color: '#3b82f6', label: 'Possible Match' };

    return { faq: s.faq, score: s.score, confidence };
  });
}

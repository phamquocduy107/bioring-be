/** Catalog candidates for product / package suggestion in RAG chat. */

export interface ProductCandidate {
  id: string;
  name: string;
  price?: number;
  material?: string;
  style?: string;
  purpose?: string;
  stoneName?: string;
  stoneColor?: string;
  imageUrl?: string;
  tags?: string[];
  shortDescription?: string;
  /** @deprecated Prefer shortDescription when sending to rag-engine. */
  description?: string;
  reason?: string;
}

export interface PackageCandidate {
  id: string;
  name: string;
  price?: number;
  shortDescription?: string;
  /** @deprecated Prefer shortDescription when sending to rag-engine. */
  description?: string;
  includedServices?: string[];
  estimatedDays?: number;
  warranty?: string;
}

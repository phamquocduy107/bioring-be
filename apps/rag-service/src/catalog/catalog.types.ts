/** Catalog candidates for product / package suggestion in RAG chat. */

export interface ProductCandidate {
  id: string;
  name: string;
  description?: string;
  price?: number;
  material?: string;
  style?: string;
  purpose?: string;
  stoneName?: string;
  stoneColor?: string;
  imageUrl?: string;
  tags?: string[];
  reason?: string;
}

export interface PackageCandidate {
  id: string;
  name: string;
  description?: string;
  price?: number;
  includedServices?: string[];
  estimatedDays?: number;
  warranty?: string;
}

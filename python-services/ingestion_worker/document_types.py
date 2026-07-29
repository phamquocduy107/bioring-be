"""Document/retrieval types dùng cho metadata filter Qdrant.

Phải đồng bộ giá trị với libs/common/src/constants/knowledge-document-type.constant.ts
"""

from __future__ import annotations

from typing import List, Optional

DOCUMENT_TYPES = [
    "policy",
    "package",
    "ring_guide",
    "gemstone_guide",
    "general",
]

RETRIEVAL_TYPES = list(DOCUMENT_TYPES)

DEFAULT_DOCUMENT_TYPE = "general"

DOCUMENT_TYPE_TO_RETRIEVAL_TYPES = {
    "policy": ["policy"],
    "package": ["package", "policy"],
    "ring_guide": ["ring_guide", "gemstone_guide"],
    "gemstone_guide": ["gemstone_guide", "ring_guide"],
    "general": ["general"],
}


def normalize_document_type(value: Optional[str]) -> str:
    if isinstance(value, str) and value in DOCUMENT_TYPES:
        return value
    return DEFAULT_DOCUMENT_TYPE


def normalize_retrieval_types(
    retrieval_types: Optional[List[str]],
    document_type: str,
) -> List[str]:
    filtered = [t for t in (retrieval_types or []) if t in RETRIEVAL_TYPES]
    # giữ thứ tự, loại trùng
    unique: List[str] = []
    for t in filtered:
        if t not in unique:
            unique.append(t)
    if unique:
        return unique
    return DOCUMENT_TYPE_TO_RETRIEVAL_TYPES.get(document_type, ["general"])

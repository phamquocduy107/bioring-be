"""Retrieval query building and rare rewrite gating."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from .config import settings
from .schemas import ChatMessage, ExtractedRequirements, RagIntent


AMBIGUOUS_FOLLOW_UP_PATTERNS = [
    r"^cái đó",
    r"^cái kia",
    r"^mẫu đầu",
    r"^mẫu đó",
    r"^mẫu nào",
    r"^vậy ",
    r"^còn ",
    r"^thế còn",
    r"^nó ",
    r"thì sao\??$",
    r"hợp không\??$",
    r"hợp nhất\??$",
    r"tốt hơn\??$",
    r"còn cái kia",
    r"vậy cái nào",
]

PURPOSE_LABELS = {
    "engagement": "nhẫn cầu hôn",
    "wedding": "nhẫn cưới",
    "anniversary": "nhẫn kỷ niệm",
    "daily": "nhẫn đeo hằng ngày",
}

STYLE_LABELS = {
    "minimal": "tối giản",
    "luxury": "sang trọng",
    "vintage": "cổ điển",
    "classic": "cổ điển",
    "statement": "nổi bật",
    "elegant": "thanh lịch",
}

MATERIAL_LABELS = {
    "white_gold": "vàng trắng",
    "rose_gold": "vàng hồng",
    "yellow_gold": "vàng vàng",
    "silver": "bạc",
    "platinum": "platinum",
}

COLOR_LABELS = {
    "blue": "xanh",
    "red": "đỏ",
    "white": "trắng",
    "pink": "hồng",
    "yellow": "vàng",
    "green": "xanh lục",
    "purple": "tím",
    "black": "đen",
}


def normalize_question(question: str) -> str:
    return re.sub(r"\s+", " ", (question or "").strip())


def is_ambiguous_follow_up(question: str) -> bool:
    q = normalize_question(question).lower()
    if len(q) <= 3:
        return True
    return any(re.search(pattern, q) for pattern in AMBIGUOUS_FOLLOW_UP_PATTERNS)


def _prefs_dict(
    user_preferences: Optional[Dict[str, Any]],
    extracted: Optional[ExtractedRequirements],
) -> Dict[str, Any]:
    merged: Dict[str, Any] = {}
    if user_preferences:
        merged.update({k: v for k, v in user_preferences.items() if v not in (None, "", [])})
    if extracted:
        for key, value in extracted.model_dump().items():
            if value not in (None, "", []) and key not in merged:
                merged[key] = value
    return merged


def has_useful_preferences(prefs: Dict[str, Any]) -> bool:
    keys = ("purpose", "budgetMax", "budgetMin", "style", "stoneColor", "stoneName", "material")
    return any(prefs.get(k) not in (None, "", []) for k in keys)


def should_rewrite_question(
    question: str,
    chat_history: List[ChatMessage],
    user_preferences: Optional[Dict[str, Any]],
    last_intent: Optional[str],
    current_intent: Optional[RagIntent] = None,
    extracted: Optional[ExtractedRequirements] = None,
) -> bool:
    """Return True only for rare ambiguous follow-ups that need LLM rewrite."""
    if settings.ENABLE_QUERY_REWRITE:
        return bool(chat_history)

    if not settings.ENABLE_QUERY_REWRITE_FALLBACK:
        return False

    if not chat_history:
        return False

    if not is_ambiguous_follow_up(question):
        return False

    prefs = _prefs_dict(user_preferences, extracted)
    # Preferences + last/current intent are enough to build retrieval query.
    if has_useful_preferences(prefs) and (last_intent or current_intent):
        return False

    # Rule-built retrieval query is still clear enough.
    built = build_retrieval_query(
        question=question,
        user_preferences=user_preferences,
        last_intent=last_intent,
        current_intent=current_intent,
        extracted_requirements=extracted,
    )
    if built and built.strip().lower() != normalize_question(question).lower():
        return False

    return True


def build_retrieval_query(
    question: str,
    user_preferences: Optional[Dict[str, Any]] = None,
    last_intent: Optional[str] = None,
    current_intent: Optional[RagIntent] = None,
    extracted_requirements: Optional[ExtractedRequirements] = None,
) -> str:
    q = normalize_question(question)
    prefs = _prefs_dict(user_preferences, extracted_requirements)
    intent = current_intent.value if isinstance(current_intent, RagIntent) else (
        current_intent or last_intent or ""
    )
    intent = str(intent or "")

    if not is_ambiguous_follow_up(q) and len(q) >= 12:
        # Clear standalone question — keep as-is, optionally enrich lightly.
        if intent in (RagIntent.POLICY_QA.value, "POLICY_QA"):
            return q
        if intent in (RagIntent.PACKAGE_QA.value, "PACKAGE_QA"):
            return q
        if has_useful_preferences(prefs) and intent in (
            RagIntent.RING_RECOMMENDATION.value,
            "RING_RECOMMENDATION",
            RagIntent.GEMSTONE_ADVICE.value,
            "GEMSTONE_ADVICE",
        ):
            enriched = _append_preference_phrases(q, prefs, intent)
            return enriched or q
        return q

    # Ambiguous follow-up or short question: rebuild from preferences.
    parts = [q] if q else []
    parts.extend(_preference_phrases(prefs, intent))

    if intent in (RagIntent.POLICY_QA.value, "POLICY_QA"):
        parts.append("chính sách cửa hàng")
    elif intent in (RagIntent.PACKAGE_QA.value, "PACKAGE_QA"):
        parts.append("gói dịch vụ package")
    elif intent in (RagIntent.RING_RECOMMENDATION.value, "RING_RECOMMENDATION"):
        parts.append("mẫu nhẫn phù hợp")
    elif intent in (RagIntent.GEMSTONE_ADVICE.value, "GEMSTONE_ADVICE"):
        parts.append("tư vấn đá quý")

    # Deduplicate while preserving order
    seen = set()
    unique: List[str] = []
    for part in parts:
        token = part.strip()
        if not token:
            continue
        key = token.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(token)

    return " ".join(unique).strip() or q


def _preference_phrases(prefs: Dict[str, Any], intent: str) -> List[str]:
    phrases: List[str] = []
    purpose = prefs.get("purpose")
    if purpose:
        phrases.append(PURPOSE_LABELS.get(str(purpose), str(purpose)))

    budget_max = prefs.get("budgetMax")
    budget_min = prefs.get("budgetMin")
    if budget_min and budget_max:
        phrases.append(f"ngân sách từ {budget_min} đến {budget_max}")
    elif budget_max:
        phrases.append(f"ngân sách dưới {budget_max}")
    elif budget_min:
        phrases.append(f"ngân sách từ {budget_min}")

    style = prefs.get("style")
    if style:
        phrases.append(f"phong cách {STYLE_LABELS.get(str(style), style)}")

    material = prefs.get("material")
    if material:
        phrases.append(MATERIAL_LABELS.get(str(material), str(material)))

    stone_name = prefs.get("stoneName")
    if stone_name:
        phrases.append(str(stone_name))

    stone_color = prefs.get("stoneColor")
    if stone_color:
        phrases.append(f"đá màu {COLOR_LABELS.get(str(stone_color), stone_color)}")

    if intent in (RagIntent.PACKAGE_QA.value, "PACKAGE_QA"):
        signal = prefs.get("customSignal")
        if signal:
            phrases.append(str(signal))

    return phrases


def _append_preference_phrases(question: str, prefs: Dict[str, Any], intent: str) -> str:
    extra = _preference_phrases(prefs, intent)
    if not extra:
        return question
    q_lower = question.lower()
    missing = [p for p in extra if p.lower() not in q_lower]
    if not missing:
        return question
    return f"{question} {' '.join(missing)}".strip()

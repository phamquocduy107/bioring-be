import re
from typing import Any, Dict, List, Optional, Tuple

from .config import settings
from .llm_client import LLMClient
from .query_builder import is_ambiguous_follow_up, normalize_question
from .schemas import (
    ExtractedRequirements,
    IntentDetectionRequest,
    IntentDetectionResponse,
    RagIntent,
)


INTENT_RETRIEVAL_TYPES = {
    RagIntent.RING_RECOMMENDATION: ["ring_guide", "gemstone_guide"],
    RagIntent.GEMSTONE_ADVICE: ["gemstone_guide", "ring_guide"],
    RagIntent.PACKAGE_QA: ["package", "policy"],
    RagIntent.POLICY_QA: ["policy"],
    RagIntent.CUSTOM_DESIGN_CONSULTING: ["custom_design", "package", "policy", "ring_guide"],
    RagIntent.GENERAL_RAG_QA: ["general", "policy", "package", "gemstone_guide", "ring_guide"],
}

POLICY_KEYWORDS = [
    "bảo hành",
    "đổi trả",
    "hoàn tiền",
    "giao hàng",
    "vận chuyển",
    "đặt cọc",
    "thanh toán",
    "chính sách",
    "hủy đơn",
    "bảo trì",
    "sửa chữa",
]

PACKAGE_KEYWORDS = [
    "gói",
    "package",
    "premium",
    "standard",
    "basic",
    "dịch vụ",
    "combo",
    "quyền lợi",
    "bao gồm những gì",
    "thiết kế riêng gồm",
]

CUSTOM_DESIGN_KEYWORDS = [
    "cá nhân hóa",
    "bespoke",
    "thiết kế riêng",
    "vân tay",
    "giọng nói",
    "biometric",
    "sinh trắc",
    "sóng âm",
    "waveform",
    "khắc vân tay",
    "nhẫn từ giọng nói",
]

GEMSTONE_KEYWORDS = [
    "đá",
    "sapphire",
    "ruby",
    "kim cương",
    "diamond",
    "moissanite",
    "emerald",
    "ngọc lục bảo",
    "màu đá",
    "hợp da",
    "ý nghĩa đá",
    "độ cứng",
    "độ bền",
]

RING_KEYWORDS = [
    "nhẫn",
    "mẫu",
    "gợi ý",
    "cầu hôn",
    "nhẫn cưới",
    "kỷ niệm",
    "đeo hằng ngày",
    "đeo hàng ngày",
    "ngân sách",
    "vàng trắng",
    "vàng hồng",
    "platinum",
    "tối giản",
    "sang trọng",
    "tư vấn",
    "mua nhẫn",
    "chọn nhẫn",
]

CLARIFICATION_TEMPLATE = (
    "Bạn muốn nhẫn dùng cho dịp nào ạ: cầu hôn, cưới, kỷ niệm hay đeo hằng ngày? "
    "Ngoài ra bạn có ngân sách dự kiến và thích phong cách tối giản hay nổi bật không?"
)

LOW_RULE_CONFIDENCE = 0.55


class IntentClassifier:
    def __init__(self) -> None:
        self.llm_client = LLMClient()

    def detect(self, request: IntentDetectionRequest) -> IntentDetectionResponse:
        question = normalize_question(request.question)
        rules_result = self._detect_with_rules(request)

        use_rules = settings.INTENT_RULES_FIRST or not settings.ENABLE_LLM_INTENT_FALLBACK
        if use_rules and (
            not settings.ENABLE_LLM_INTENT_FALLBACK
            or rules_result.confidence >= LOW_RULE_CONFIDENCE
        ):
            return rules_result

        if not settings.ENABLE_LLM_INTENT_FALLBACK:
            return rules_result

        try:
            raw = self._detect_with_llm(request)
            return self._normalize_llm_result(question, raw, request)
        except Exception:
            return rules_result

    def _detect_with_llm(self, request: IntentDetectionRequest) -> Dict[str, Any]:
        history_text = "\n".join(
            [f"{m.role.value}: {m.content}" for m in request.chatHistory[-8:]]
        )
        prefs = request.userPreferences or {}

        system_prompt = (
            "Bạn là bộ phân loại intent cho hệ thống tư vấn nhẫn BIORING. "
            "Chỉ trả về JSON hợp lệ, không markdown."
        )
        user_prompt = f"""
Các intent hợp lệ:
- RING_RECOMMENDATION, GEMSTONE_ADVICE, PACKAGE_QA, POLICY_QA,
  CUSTOM_DESIGN_CONSULTING, GENERAL_RAG_QA

lastIntent: {request.lastIntent or "(không có)"}
userPreferences: {prefs}
Lịch sử chat:
{history_text or "(không có)"}

Câu hỏi:
{request.question}

Trả về JSON:
{{
  "intent": "...",
  "confidence": 0.0,
  "extractedRequirements": {{}},
  "missingFields": [],
  "productFilters": {{}}
}}
"""
        return self.llm_client.invoke_json(system_prompt, user_prompt)

    def _normalize_llm_result(
        self,
        question: str,
        raw: Dict[str, Any],
        request: IntentDetectionRequest,
    ) -> IntentDetectionResponse:
        intent_value = str(raw.get("intent") or RagIntent.GENERAL_RAG_QA.value)
        try:
            intent = RagIntent(intent_value)
        except ValueError:
            intent = RagIntent.GENERAL_RAG_QA

        extracted_raw = raw.get("extractedRequirements") or {}
        extracted = ExtractedRequirements(**extracted_raw)
        extracted = self._merge_rule_extractions(question, extracted)
        extracted = self._merge_preferences(extracted, request.userPreferences)
        extracted = self._apply_follow_up_overrides(question, extracted)

        missing_fields = list(raw.get("missingFields") or [])
        missing_fields = self._normalize_missing_fields(intent, extracted, missing_fields)

        product_filters = dict(raw.get("productFilters") or {})
        product_filters.update(self._build_product_filters(extracted))

        should_ask = self._should_ask_clarifying(intent, missing_fields, extracted)

        return IntentDetectionResponse(
            intent=intent,
            confidence=float(raw.get("confidence") or 0.75),
            source="llm",
            llmUsed=True,
            extractedRequirements=extracted,
            missingFields=missing_fields,
            retrievalTypes=INTENT_RETRIEVAL_TYPES.get(intent, ["general"]),
            productFilters=product_filters,
            shouldAskClarifyingQuestion=should_ask,
            clarificationQuestion=self._build_clarification_question(intent, missing_fields)
            if should_ask
            else None,
        )

    def _detect_with_rules(self, request: IntentDetectionRequest) -> IntentDetectionResponse:
        question = normalize_question(request.question)
        q = question.lower()
        intent, confidence = self._classify_intent_rules(
            q,
            last_intent=request.lastIntent,
            user_preferences=request.userPreferences or {},
        )

        extracted = self._merge_rule_extractions(question, ExtractedRequirements())
        extracted = self._merge_preferences(extracted, request.userPreferences)
        extracted = self._apply_follow_up_overrides(question, extracted)
        missing_fields = self._normalize_missing_fields(intent, extracted, [])
        should_ask = self._should_ask_clarifying(intent, missing_fields, extracted)

        return IntentDetectionResponse(
            intent=intent,
            confidence=confidence,
            source="rules",
            llmUsed=False,
            extractedRequirements=extracted,
            missingFields=missing_fields,
            retrievalTypes=INTENT_RETRIEVAL_TYPES.get(intent, ["general"]),
            productFilters=self._build_product_filters(extracted),
            shouldAskClarifyingQuestion=should_ask,
            clarificationQuestion=self._build_clarification_question(intent, missing_fields)
            if should_ask
            else None,
        )

    def _classify_intent_rules(
        self,
        q: str,
        last_intent: Optional[str],
        user_preferences: Dict[str, Any],
    ) -> Tuple[RagIntent, float]:
        if any(k in q for k in POLICY_KEYWORDS):
            return RagIntent.POLICY_QA, 0.92

        if any(k in q for k in PACKAGE_KEYWORDS):
            return RagIntent.PACKAGE_QA, 0.9

        if any(k in q for k in CUSTOM_DESIGN_KEYWORDS):
            return RagIntent.CUSTOM_DESIGN_CONSULTING, 0.9

        # Gemstone before ring so "sapphire bền không" stays GEMSTONE.
        if any(k in q for k in GEMSTONE_KEYWORDS) and not any(
            k in q for k in ["mẫu nhẫn", "gợi ý nhẫn", "mua nhẫn", "chọn nhẫn"]
        ):
            # "nhẫn đá xanh" may be ring; if strong ring signals, ring wins below.
            gemstone_only = any(
                k in q
                for k in [
                    "sapphire",
                    "ruby",
                    "kim cương",
                    "diamond",
                    "moissanite",
                    "emerald",
                    "ý nghĩa đá",
                    "độ cứng",
                    "độ bền",
                    "hợp da",
                    "màu đá",
                ]
            )
            if gemstone_only or "đá" in q:
                # Prefer gemstone unless clear purchase/recommendation framing.
                if not any(
                    k in q
                    for k in ["gợi ý", "tư vấn nhẫn", "mẫu", "dưới", "ngân sách", "cầu hôn"]
                ):
                    return RagIntent.GEMSTONE_ADVICE, 0.88

        if any(k in q for k in RING_KEYWORDS) or re.search(
            r"dưới\s*\d+\s*(triệu|tr|m)", q
        ):
            return RagIntent.RING_RECOMMENDATION, 0.9

        if any(k in q for k in GEMSTONE_KEYWORDS):
            return RagIntent.GEMSTONE_ADVICE, 0.85

        # Ambiguous follow-up: inherit lastIntent when preferences exist.
        if is_ambiguous_follow_up(q) and last_intent:
            try:
                inherited = RagIntent(last_intent)
                if inherited != RagIntent.CLARIFICATION:
                    return inherited, 0.72
            except ValueError:
                pass

        if last_intent == RagIntent.RING_RECOMMENDATION.value and any(
            user_preferences.get(k) for k in ("purpose", "budgetMax", "style", "stoneColor")
        ):
            if is_ambiguous_follow_up(q) or len(q) < 40:
                return RagIntent.RING_RECOMMENDATION, 0.7

        return RagIntent.GENERAL_RAG_QA, 0.5

    def _merge_rule_extractions(
        self, question: str, extracted: ExtractedRequirements
    ) -> ExtractedRequirements:
        q = question.lower()
        data = extracted.model_dump()

        budget_min, budget_max, budget_approx = self._extract_budget(q)
        # Ngân sách nêu rõ trong câu hiện tại luôn ghi đè (follow-up "dưới 20 triệu").
        if budget_max:
            data["budgetMax"] = budget_max
        if budget_min:
            data["budgetMin"] = budget_min
        if budget_approx and not data.get("budgetMax"):
            data["budgetApprox"] = budget_approx
            data["budgetMax"] = budget_approx

        if not data.get("purpose"):
            if "cầu hôn" in q or "đính hôn" in q:
                data["purpose"] = "engagement"
            elif "nhẫn cưới" in q or "cưới" in q or "kết hôn" in q:
                data["purpose"] = "wedding"
            elif "kỷ niệm" in q:
                data["purpose"] = "anniversary"
            elif "đeo hằng ngày" in q or "đeo hàng ngày" in q:
                data["purpose"] = "daily"

        if not data.get("style"):
            if any(k in q for k in ["tối giản", "minimal", "đơn giản"]):
                data["style"] = "minimal"
            elif any(k in q for k in ["sang trọng", "luxury", "sang"]):
                data["style"] = "luxury"
            elif any(k in q for k in ["cổ điển", "vintage", "classic"]):
                data["style"] = "vintage"
            elif any(k in q for k in ["nổi bật", "statement"]):
                data["style"] = "statement"
            elif any(k in q for k in ["thanh lịch", "elegant"]):
                data["style"] = "elegant"

        if not data.get("material"):
            if "vàng trắng" in q:
                data["material"] = "white_gold"
            elif "vàng hồng" in q:
                data["material"] = "rose_gold"
            elif "vàng vàng" in q or (
                "vàng" in q and "vàng trắng" not in q and "vàng hồng" not in q
            ):
                data["material"] = "yellow_gold"
            elif "bạc" in q:
                data["material"] = "silver"
            elif "bạch kim" in q or "platinum" in q:
                data["material"] = "platinum"

        if not data.get("stoneColor"):
            color_map = [
                ("xanh lục", "green"),
                ("xanh lá", "green"),
                ("xanh", "blue"),
                ("đỏ", "red"),
                ("hồng", "pink"),
                ("trắng", "white"),
                ("vàng", "yellow"),
                ("lục", "green"),
                ("tím", "purple"),
                ("đen", "black"),
            ]
            for vi, en in color_map:
                if vi in q:
                    data["stoneColor"] = en
                    break

        if not data.get("stoneName"):
            for stone in [
                "sapphire",
                "ruby",
                "diamond",
                "kim cương",
                "moissanite",
                "emerald",
                "ngọc lục bảo",
            ]:
                if stone in q:
                    if stone in ("kim cương",):
                        data["stoneName"] = "diamond"
                    elif stone == "ngọc lục bảo":
                        data["stoneName"] = "emerald"
                    else:
                        data["stoneName"] = stone
                    break

        if not data.get("customSignal"):
            if "giọng nói" in q or "sóng âm" in q or "waveform" in q:
                data["customSignal"] = "voice"
            elif "vân tay" in q:
                data["customSignal"] = "fingerprint"
            elif "sinh trắc" in q or "biometric" in q:
                data["customSignal"] = "biometric"

        return ExtractedRequirements(**data)

    @staticmethod
    def _apply_follow_up_overrides(
        question: str, extracted: ExtractedRequirements
    ) -> ExtractedRequirements:
        """Nới filter khi user bấm chip / nói mở rộng — tránh kẹt cùng productFilters."""
        q = question.lower().strip()
        data = extracted.model_dump()

        if re.search(
            r"mở rộng ngân sách|nới ngân sách|tăng ngân sách|ngân sách lên",
            q,
        ):
            explicit_min, explicit_max, explicit_approx = IntentClassifier._extract_budget(q)
            if explicit_max:
                data["budgetMax"] = explicit_max
            else:
                current = data.get("budgetMax") or data.get("budgetApprox") or 5_000_000
                try:
                    current_n = int(float(current))
                except (TypeError, ValueError):
                    current_n = 5_000_000
                data["budgetMax"] = min(max(current_n * 2, 10_000_000), 50_000_000)
            data["budgetApprox"] = data.get("budgetMax")

        if re.search(
            r"đổi màu đá|bỏ màu đá|không (cần )?màu đá|bỏ lọc màu",
            q,
        ):
            data["stoneColor"] = None

        if re.search(
            r"bỏ (yêu cầu )?đá|không cần (đá|kim cương)|gần giống|bỏ lọc đá|nới hết lọc",
            q,
        ):
            data["stoneName"] = None
            data["stoneColor"] = None

        if re.search(r"gần giống|nới hết lọc", q) and not data.get("budgetMax"):
            data["budgetMax"] = 20_000_000

        return ExtractedRequirements(**data)

    @staticmethod
    def _merge_preferences(
        extracted: ExtractedRequirements,
        preferences: Optional[Dict[str, Any]],
    ) -> ExtractedRequirements:
        if not preferences:
            return extracted
        data = extracted.model_dump()
        for key in data.keys():
            if data.get(key) in (None, "", []):
                pref = preferences.get(key)
                if pref not in (None, "", []):
                    data[key] = pref
        return ExtractedRequirements(**data)

    @staticmethod
    def _extract_budget(q: str) -> Tuple[Optional[int], Optional[int], Optional[int]]:
        """Return (budgetMin, budgetMax, budgetApprox)."""
        range_match = re.search(
            r"(?:từ|tu)\s*(\d+(?:[\.,]\d+)?)\s*(?:đến|toi|tới|-)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)?",
            q,
        )
        if range_match:
            lo = float(range_match.group(1).replace(",", "."))
            hi = float(range_match.group(2).replace(",", "."))
            unit = range_match.group(3)
            mult = 1_000_000 if unit or lo < 1000 else 1
            return int(lo * mult), int(hi * mult), None

        under = re.search(
            r"(?:dưới|duoi|tối đa|toi da|<=|≤)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)",
            q,
        )
        if under:
            number = float(under.group(1).replace(",", "."))
            return None, int(number * 1_000_000), None

        approx = re.search(
            r"(?:khoảng|tam|tầm|khoang)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)",
            q,
        )
        if approx:
            number = float(approx.group(1).replace(",", "."))
            value = int(number * 1_000_000)
            return None, value, value

        plain = re.search(r"(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)\b", q)
        if plain:
            number = float(plain.group(1).replace(",", "."))
            value = int(number * 1_000_000)
            return None, value, None

        direct = re.search(r"(\d{7,})", q)
        if direct:
            return None, int(direct.group(1)), None

        return None, None, None

    def _normalize_missing_fields(
        self,
        intent: RagIntent,
        extracted: ExtractedRequirements,
        existing: List[str],
    ) -> List[str]:
        missing = set(existing)
        if intent == RagIntent.RING_RECOMMENDATION:
            if not extracted.purpose:
                missing.add("purpose")
            if not extracted.budgetMax and not extracted.budgetApprox:
                missing.add("budgetMax")
            if not extracted.style:
                missing.add("style")
        return list(missing)

    @staticmethod
    def _should_ask_clarifying(
        intent: RagIntent,
        missing_fields: List[str],
        extracted: ExtractedRequirements,
    ) -> bool:
        if intent != RagIntent.RING_RECOMMENDATION:
            return False
        important = {"purpose", "budgetMax", "style"}
        missing_important = [f for f in missing_fields if f in important]
        # Ask when too many important fields are missing (2+).
        if len(missing_important) >= 2:
            return True
        # Extremely sparse: no purpose and no budget.
        if not extracted.purpose and not extracted.budgetMax and not extracted.budgetApprox:
            return True
        return False

    @staticmethod
    def _build_clarification_question(
        intent: RagIntent, missing_fields: List[str]
    ) -> str | None:
        if intent != RagIntent.RING_RECOMMENDATION or not missing_fields:
            return None
        return CLARIFICATION_TEMPLATE

    @staticmethod
    def _build_product_filters(extracted: ExtractedRequirements) -> Dict[str, Any]:
        filters: Dict[str, Any] = {}
        for key in [
            "purpose",
            "budgetMin",
            "budgetMax",
            "budgetApprox",
            "style",
            "material",
            "stoneName",
            "stoneColor",
            "ringSize",
            "occasion",
            "recipient",
            "customSignal",
        ]:
            value = getattr(extracted, key, None)
            if value is not None:
                filters[key] = value
        return filters

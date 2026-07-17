import re
from typing import Any, Dict, List

from .config import settings
from .llm_client import LLMClient
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


class IntentClassifier:
    def __init__(self) -> None:
        self.llm_client = LLMClient()

    def detect(self, request: IntentDetectionRequest) -> IntentDetectionResponse:
        question = request.question.strip()
        if settings.INTENT_RULES_FIRST:
            return self._detect_with_rules(question)
        try:
            raw = self._detect_with_llm(request)
            return self._normalize_llm_result(question, raw)
        except Exception:
            return self._detect_with_rules(question)

    def _detect_with_llm(self, request: IntentDetectionRequest) -> Dict[str, Any]:
        history_text = "\n".join(
            [f"{m.role.value}: {m.content}" for m in request.chatHistory[-8:]]
        )

        system_prompt = (
            "Bạn là bộ phân loại intent cho hệ thống tư vấn nhẫn BIORING. "
            "Hãy phân loại câu hỏi của khách và trích xuất nhu cầu mua nhẫn/đá/gói dịch vụ. "
            "Chỉ trả về JSON hợp lệ, không markdown."
        )
        user_prompt = f"""
Các intent hợp lệ:
- RING_RECOMMENDATION: khách muốn gợi ý/chọn/mua mẫu nhẫn.
- GEMSTONE_ADVICE: khách hỏi nên chọn loại đá, màu đá, ý nghĩa đá, độ bền đá.
- PACKAGE_QA: khách hỏi gói dịch vụ, package, thiết kế riêng, giá gói, quyền lợi gói.
- POLICY_QA: khách hỏi chính sách bảo hành, đổi trả, thanh toán, giao hàng, đặt cọc.
- CUSTOM_DESIGN_CONSULTING: khách hỏi nhẫn cá nhân hóa bằng giọng nói, vân tay, sinh trắc học, thiết kế riêng.
- GENERAL_RAG_QA: câu hỏi chung còn lại về tài liệu/kiến thức cửa hàng.

Lịch sử chat:
{history_text or "(không có)"}

Câu hỏi khách:
{request.question}

Trả về JSON theo schema:
{{
  "intent": "RING_RECOMMENDATION | GEMSTONE_ADVICE | PACKAGE_QA | POLICY_QA | CUSTOM_DESIGN_CONSULTING | GENERAL_RAG_QA",
  "confidence": 0.0,
  "extractedRequirements": {{
    "purpose": null,
    "budgetMin": null,
    "budgetMax": null,
    "style": null,
    "material": null,
    "stoneName": null,
    "stoneColor": null,
    "ringSize": null,
    "occasion": null,
    "recipient": null,
    "customSignal": null,
    "notes": null
  }},
  "missingFields": [],
  "productFilters": {{}}
}}

Quy tắc:
- Nếu khách chỉ nói "tư vấn nhẫn", "gợi ý nhẫn" nhưng thiếu dịp dùng/ngân sách/phong cách thì intent vẫn là RING_RECOMMENDATION và missingFields gồm purpose, budgetMax, style.
- Ngân sách tiếng Việt như "dưới 10 triệu" phải đưa vào budgetMax = 10000000.
- "đá xanh" hoặc "màu xanh" đưa vào stoneColor = "blue".
- "cầu hôn" đưa vào purpose = "engagement".
"""
        return self.llm_client.invoke_json(system_prompt, user_prompt)

    def _normalize_llm_result(self, question: str, raw: Dict[str, Any]) -> IntentDetectionResponse:
        intent_value = str(raw.get("intent") or RagIntent.GENERAL_RAG_QA.value)
        try:
            intent = RagIntent(intent_value)
        except ValueError:
            intent = RagIntent.GENERAL_RAG_QA

        extracted_raw = raw.get("extractedRequirements") or {}
        extracted = ExtractedRequirements(**extracted_raw)
        extracted = self._merge_rule_extractions(question, extracted)

        missing_fields = list(raw.get("missingFields") or [])
        missing_fields = self._normalize_missing_fields(intent, extracted, missing_fields)

        product_filters = dict(raw.get("productFilters") or {})
        product_filters.update(self._build_product_filters(extracted))

        should_ask = self._should_ask_clarifying(intent, missing_fields)
        clarification = self._build_clarification_question(intent, missing_fields)

        return IntentDetectionResponse(
            intent=intent,
            confidence=float(raw.get("confidence") or 0.75),
            extractedRequirements=extracted,
            missingFields=missing_fields,
            retrievalTypes=INTENT_RETRIEVAL_TYPES.get(intent, ["general"]),
            productFilters=product_filters,
            shouldAskClarifyingQuestion=should_ask,
            clarificationQuestion=clarification,
        )

    def _detect_with_rules(self, question: str) -> IntentDetectionResponse:
        q = question.lower()
        intent = RagIntent.GENERAL_RAG_QA

        if any(k in q for k in ["bảo hành", "đổi trả", "hoàn tiền", "đặt cọc", "thanh toán", "giao hàng", "chính sách"]):
            intent = RagIntent.POLICY_QA
        elif any(k in q for k in ["gói", "package", "dịch vụ", "thiết kế riêng gồm", "premium", "basic"]):
            intent = RagIntent.PACKAGE_QA
        elif any(k in q for k in ["vân tay", "giọng nói", "sinh trắc", "biometric", "cá nhân hóa", "custom", "thiết kế riêng"]):
            intent = RagIntent.CUSTOM_DESIGN_CONSULTING
        elif any(k in q for k in ["đá", "kim cương", "sapphire", "ruby", "emerald", "moissanite", "màu đá", "da ngăm"]):
            intent = RagIntent.GEMSTONE_ADVICE
        if any(k in q for k in ["gợi ý", "tư vấn", "mẫu nhẫn", "nhẫn cầu hôn", "nhẫn cưới", "mua nhẫn", "chọn nhẫn"]):
            intent = RagIntent.RING_RECOMMENDATION

        extracted = self._merge_rule_extractions(question, ExtractedRequirements())
        missing_fields = self._normalize_missing_fields(intent, extracted, [])
        should_ask = self._should_ask_clarifying(intent, missing_fields)

        return IntentDetectionResponse(
            intent=intent,
            confidence=0.62,
            extractedRequirements=extracted,
            missingFields=missing_fields,
            retrievalTypes=INTENT_RETRIEVAL_TYPES.get(intent, ["general"]),
            productFilters=self._build_product_filters(extracted),
            shouldAskClarifyingQuestion=should_ask,
            clarificationQuestion=self._build_clarification_question(intent, missing_fields),
        )

    def _merge_rule_extractions(self, question: str, extracted: ExtractedRequirements) -> ExtractedRequirements:
        q = question.lower()
        data = extracted.model_dump()

        budget_max = self._extract_budget_max(q)
        if budget_max and not data.get("budgetMax"):
            data["budgetMax"] = budget_max

        if not data.get("purpose"):
            if "cầu hôn" in q or "đính hôn" in q:
                data["purpose"] = "engagement"
            elif "nhẫn cưới" in q or "kết hôn" in q:
                data["purpose"] = "wedding"
            elif "kỷ niệm" in q:
                data["purpose"] = "anniversary"
            elif "đeo hằng ngày" in q or "đeo hàng ngày" in q:
                data["purpose"] = "daily"

        if not data.get("style"):
            if any(k in q for k in ["tối giản", "minimal", "đơn giản"]):
                data["style"] = "minimal"
            elif any(k in q for k in ["sang", "luxury", "nổi bật", "lấp lánh"]):
                data["style"] = "luxury"
            elif any(k in q for k in ["vintage", "cổ điển"]):
                data["style"] = "vintage"

        if not data.get("stoneColor"):
            color_map = {
                "xanh": "blue",
                "đỏ": "red",
                "hồng": "pink",
                "trắng": "white",
                "vàng": "yellow",
                "lục": "green",
                "xanh lá": "green",
                "đen": "black",
                "champagne": "champagne",
            }
            for vi, en in color_map.items():
                if vi in q:
                    data["stoneColor"] = en
                    break

        if not data.get("stoneName"):
            for stone in ["diamond", "kim cương", "sapphire", "ruby", "emerald", "moissanite"]:
                if stone in q:
                    data["stoneName"] = "diamond" if stone == "kim cương" else stone
                    break

        if not data.get("material"):
            if "vàng trắng" in q:
                data["material"] = "white_gold"
            elif "vàng hồng" in q:
                data["material"] = "rose_gold"
            elif "vàng" in q:
                data["material"] = "yellow_gold"
            elif "bạch kim" in q or "platinum" in q:
                data["material"] = "platinum"

        if not data.get("customSignal"):
            if "giọng nói" in q:
                data["customSignal"] = "voice"
            elif "vân tay" in q:
                data["customSignal"] = "fingerprint"
            elif "sinh trắc" in q or "biometric" in q:
                data["customSignal"] = "biometric"

        return ExtractedRequirements(**data)

    @staticmethod
    def _extract_budget_max(q: str) -> int | None:
        # dưới 10 triệu, tầm 8tr, 15m, 10000000
        patterns = [
            r"(?:dưới|duoi|tối đa|toi da|khoảng|tam|tầm)\s*(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)",
            r"(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)",
        ]
        for pattern in patterns:
            match = re.search(pattern, q)
            if match:
                number = float(match.group(1).replace(",", "."))
                return int(number * 1_000_000)

        direct = re.search(r"(\d{7,})", q)
        if direct:
            return int(direct.group(1))

        return None

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
            if not extracted.budgetMax:
                missing.add("budgetMax")
            if not extracted.style:
                missing.add("style")
        return list(missing)

    @staticmethod
    def _should_ask_clarifying(intent: RagIntent, missing_fields: List[str]) -> bool:
        return intent == RagIntent.RING_RECOMMENDATION and len(missing_fields) >= 2

    @staticmethod
    def _build_clarification_question(intent: RagIntent, missing_fields: List[str]) -> str | None:
        if intent != RagIntent.RING_RECOMMENDATION or not missing_fields:
            return None
        return (
            "Mình sẵn sàng tư vấn nhẫn giúp bạn. Bạn cho mình biết nhanh giúp mình: "
            "nhẫn dùng cho dịp nào (cầu hôn, cưới, kỷ niệm hay đeo hằng ngày), "
            "ngân sách dự kiến khoảng bao nhiêu, và bạn thích phong cách tối giản, sang trọng hay cổ điển?"
        )

    @staticmethod
    def _build_product_filters(extracted: ExtractedRequirements) -> Dict[str, Any]:
        filters: Dict[str, Any] = {}
        for key in [
            "purpose",
            "budgetMin",
            "budgetMax",
            "style",
            "material",
            "stoneName",
            "stoneColor",
            "ringSize",
            "occasion",
            "recipient",
            "customSignal",
        ]:
            value = getattr(extracted, key)
            if value is not None:
                filters[key] = value
        return filters

import json
from typing import Any, Dict, List, Tuple

from .config import settings
from .schemas import (
    IntentDetectionResponse,
    PackageCandidate,
    ProductCandidate,
    QueryRequest,
    RagIntent,
)


class PromptBuilder:
    def build(
        self,
        request: QueryRequest,
        intent_result: IntentDetectionResponse,
        context: str,
    ) -> Tuple[str, str]:
        intent = intent_result.intent
        has_context = bool((context or "").strip()) and context.strip() != "(không có context phù hợp)"
        has_products = bool(request.productCandidates)
        has_packages = bool(request.packageCandidates)

        system_prompt = self._system_prompt_for_intent(
            intent,
            has_context=has_context,
            has_products=has_products,
            has_packages=has_packages,
        )
        user_prompt = self._user_prompt(
            request,
            intent_result,
            context,
            has_context=has_context,
            has_products=has_products,
            has_packages=has_packages,
        )
        return system_prompt, user_prompt

    def _system_prompt_for_intent(
        self,
        intent: RagIntent,
        *,
        has_context: bool,
        has_products: bool,
        has_packages: bool,
    ) -> str:
        if intent == RagIntent.POLICY_QA:
            return (
                "Bạn là trợ lý chính sách cửa hàng BIORING. Trả lời tiếng Việt, ngắn gọn. "
                "Chỉ dùng Context. Không suy đoán chính sách. "
                "Nếu Context trống, nói chưa tìm thấy thông tin trong tài liệu cửa hàng."
            )

        if intent == RagIntent.PACKAGE_QA:
            return (
                "Bạn tư vấn gói dịch vụ BIORING. Trả lời tiếng Việt, ngắn. "
                "Chỉ dùng Context và Package Candidates. Không bịa gói/giá/quyền lợi."
            )

        if intent == RagIntent.RING_RECOMMENDATION:
            rules = (
                "Bạn tư vấn mẫu nhẫn BIORING. Trả lời tiếng Việt, ngắn, có thể dùng bullet. "
                "Chỉ gợi ý sản phẩm trong Product Candidates. "
                "Không được tự tạo sản phẩm không có trong Product Candidates. "
                "Không đổi giá, tên, chất liệu của sản phẩm."
            )
            if not has_products:
                rules += (
                    " Nếu không có Product Candidates: tư vấn hướng chọn chung "
                    "và nói chưa tìm thấy mẫu khớp."
                )
            return rules

        if intent == RagIntent.GEMSTONE_ADVICE:
            return (
                "Bạn tư vấn đá quý BIORING. Ưu tiên Context. "
                "Có thể cá nhân hóa theo userPreferences. Không bịa chính sách/giá."
            )

        return (
            "Bạn là trợ lý kiến thức cửa hàng BIORING. "
            "Trả lời theo Context. Nếu thiếu Context, nói chưa tìm thấy trong tài liệu."
        )

    def _user_prompt(
        self,
        request: QueryRequest,
        intent_result: IntentDetectionResponse,
        context: str,
        *,
        has_context: bool,
        has_products: bool,
        has_packages: bool,
    ) -> str:
        intent = intent_result.intent
        prefs = request.userPreferences or intent_result.extractedRequirements.model_dump()
        prefs_compact = {k: v for k, v in prefs.items() if v not in (None, "", [])}

        history_limit = min(6, settings.MAX_RECENT_MESSAGES)
        # Prefer summary + prefs; keep short recent history only.
        history_lines = [
            f"{m.role.value}: {m.content}" for m in request.chatHistory[-history_limit:]
        ]
        history = "\n".join(history_lines)

        context_block = (
            context.strip()
            if has_context
            else "(không có đoạn tài liệu phù hợp)"
        )

        sections: List[str] = [
            f"Intent: {intent.value}",
            f"Câu hỏi: {request.question}",
            f"userPreferences: {json.dumps(prefs_compact, ensure_ascii=False)}",
        ]

        if request.conversationSummary:
            sections.append(f"Tóm tắt hội thoại: {request.conversationSummary}")

        if history and (not request.conversationSummary or len(history_lines) <= 4):
            sections.append(f"Chat gần nhất:\n{history}")

        if intent in (
            RagIntent.RING_RECOMMENDATION,
            RagIntent.GEMSTONE_ADVICE,
        ):
            sections.append(
                f"Product Candidates:\n{self._dump_products(request.productCandidates)}"
            )
            if not has_products:
                sections.append(
                    "Lưu ý: Không được tự tạo sản phẩm không có trong Product Candidates."
                )

        if intent in (
            RagIntent.PACKAGE_QA,
        ):
            sections.append(
                f"Package Candidates:\n{self._dump_packages(request.packageCandidates)}"
            )

        if intent != RagIntent.RING_RECOMMENDATION or has_context:
            sections.append(f"Context:\n{context_block}")

        sections.append(self._answer_hints(intent, has_context, has_products, has_packages))
        return "\n\n".join(sections).strip()

    @staticmethod
    def _answer_hints(
        intent: RagIntent,
        has_context: bool,
        has_products: bool,
        has_packages: bool,
    ) -> str:
        if intent == RagIntent.POLICY_QA:
            return "Yêu cầu: chỉ trả lời theo Context; không suy đoán."
        if intent == RagIntent.PACKAGE_QA:
            return "Yêu cầu: chỉ dùng Context/Package Candidates; không bịa gói."
        if intent == RagIntent.RING_RECOMMENDATION:
            if has_products:
                return "Yêu cầu: giải thích vì sao các mẫu phù hợp; không đổi giá/tên."
            return "Yêu cầu: tư vấn hướng chọn chung; nói chưa có mẫu khớp trong catalog."
        if intent == RagIntent.GEMSTONE_ADVICE:
            return "Yêu cầu: tư vấn đá dựa trên Context và preferences."
        if not has_context and not has_products and not has_packages:
            return "Yêu cầu: nói chưa có dữ liệu phù hợp; gợi ý bước tiếp theo ngắn."
        return "Yêu cầu: trả lời ngắn gọn theo Context."

    @staticmethod
    def _dump_products(products: List[ProductCandidate]) -> str:
        if not products:
            return "(không có)"
        slim: List[Dict[str, Any]] = []
        for product in products[: settings.MAX_PRODUCT_CANDIDATES]:
            short = product.shortDescription or product.description
            if short and len(short) > 220:
                short = short[:217] + "..."
            slim.append(
                {
                    "id": product.id,
                    "name": product.name,
                    "price": product.price,
                    "material": product.material,
                    "style": product.style,
                    "purpose": product.purpose,
                    "stoneName": product.stoneName,
                    "stoneColor": product.stoneColor,
                    "imageUrl": product.imageUrl,
                    "tags": product.tags[:8] if product.tags else [],
                    "shortDescription": short,
                }
            )
        return json.dumps(slim, ensure_ascii=False)

    @staticmethod
    def _dump_packages(packages: List[PackageCandidate]) -> str:
        if not packages:
            return "(không có)"
        slim: List[Dict[str, Any]] = []
        for pkg in packages[: settings.MAX_PACKAGE_CANDIDATES]:
            short = pkg.shortDescription or pkg.description
            if short and len(short) > 220:
                short = short[:217] + "..."
            slim.append(
                {
                    "id": pkg.id,
                    "name": pkg.name,
                    "price": pkg.price,
                    "includedServices": (pkg.includedServices or [])[:12],
                    "estimatedDays": pkg.estimatedDays,
                    "warranty": pkg.warranty,
                    "shortDescription": short,
                }
            )
        return json.dumps(slim, ensure_ascii=False)

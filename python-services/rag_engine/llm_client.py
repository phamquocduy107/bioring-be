import json
import logging
from typing import Any, Dict, List, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from .config import settings
from .schemas import ChatMessage

logger = logging.getLogger(__name__)


def _short_error(exc: Exception, limit: int = 240) -> str:
    text = str(exc).replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 3] + "..."


class LLMClient:
    def __init__(self) -> None:
        if settings.llm_provider == "openrouter" and not settings.OPENROUTER_API_KEY:
            raise ValueError(
                "LLM_PROVIDER=openrouter nhưng thiếu OPENROUTER_API_KEY trong .env"
            )
        self._models = settings.resolved_llm_models()
        self._base_url = settings.active_llm_base_url
        self._api_key = settings.active_llm_api_key
        self._default_headers = (
            settings.openrouter_default_headers
            if settings.llm_provider == "openrouter"
            else None
        )
        # Giữ attribute tương thích code cũ / health probe
        self.llm = self._build_llm(self._models[0])

    def _build_llm(self, model: str) -> ChatOpenAI:
        kwargs: Dict[str, Any] = {
            "model": model,
            "base_url": self._base_url,
            "api_key": self._api_key,
            "temperature": settings.LLM_TEMPERATURE,
            "timeout": settings.LLM_REQUEST_TIMEOUT_S,
            "max_retries": 0,
        }
        if self._default_headers:
            kwargs["default_headers"] = self._default_headers
        return ChatOpenAI(**kwargs)

    def invoke_text(self, system_prompt: str, user_prompt: str) -> str:
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt),
        ]
        last_error: Optional[Exception] = None
        for index, model in enumerate(self._models):
            try:
                llm = self._build_llm(model) if index > 0 else self.llm
                if index > 0:
                    logger.warning(
                        "LLM fallback -> model=%s (provider=%s)",
                        model,
                        settings.llm_provider,
                    )
                response = llm.invoke(messages)
                return str(response.content).strip()
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "LLM call failed model=%s provider=%s: %s",
                    model,
                    settings.llm_provider,
                    _short_error(exc),
                )
        if last_error is not None:
            raise last_error
        raise RuntimeError("No LLM models configured")

    def invoke_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        text = self.invoke_text(system_prompt, user_prompt)
        return self._parse_json_object(text)

    def rewrite_question(self, question: str, chat_history: List[ChatMessage]) -> str:
        if not chat_history:
            return question

        limited_history = chat_history[-settings.MAX_CHAT_HISTORY_MESSAGES :]
        history_text = "\n".join(
            [f"{msg.role.value}: {msg.content}" for msg in limited_history]
        )

        system_prompt = (
            "Bạn viết lại câu hỏi mới thành một câu hỏi độc lập, đầy đủ ngữ cảnh để tìm kiếm tài liệu. "
            "Không trả lời câu hỏi. Chỉ trả về câu hỏi đã viết lại bằng tiếng Việt."
        )
        user_prompt = (
            f"Lịch sử chat:\n{history_text}\n\n"
            f"Câu hỏi mới:\n{question}\n\n"
            "Câu hỏi độc lập:"
        )

        try:
            rewritten = self.invoke_text(system_prompt, user_prompt)
            return rewritten or question
        except Exception:
            return question

    @staticmethod
    def _parse_json_object(text: str) -> Dict[str, Any]:
        cleaned = text.strip()

        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.lower().startswith("json"):
                cleaned = cleaned[4:].strip()

        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end >= 0 and end > start:
            cleaned = cleaned[start : end + 1]

        return json.loads(cleaned)

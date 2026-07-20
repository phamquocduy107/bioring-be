import json
from typing import Any, Dict, List, Optional

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from .config import settings
from .schemas import ChatMessage


class LLMClient:
    def __init__(self) -> None:
        self.llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            base_url=settings.OPENAI_BASE_URL,
            api_key=settings.OPENAI_API_KEY,
            temperature=settings.LLM_TEMPERATURE,
            timeout=settings.LLM_REQUEST_TIMEOUT_S,
            max_retries=0,
        )

    def invoke_text(self, system_prompt: str, user_prompt: str) -> str:
        response = self.llm.invoke(
            [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]
        )
        return str(response.content).strip()

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

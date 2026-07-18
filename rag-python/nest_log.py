"""NestJS-style colored console logging for rag-python services."""

from __future__ import annotations

import logging
import os
import sys
from datetime import datetime


class Ansi:
    RESET = "\033[0m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    RED = "\033[31m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    GRAY = "\033[90m"


def _enable_windows_ansi() -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_uint32()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except Exception:
        pass


def _supports_color() -> bool:
    if os.getenv("NO_COLOR"):
        return False
    return True


class NestStyleFormatter(logging.Formatter):
    """Format: [ENGINE] pid  - date     LOG [Context] message"""

    LEVEL_COLOR = {
        logging.DEBUG: Ansi.GRAY,
        logging.INFO: Ansi.GREEN,
        logging.WARNING: Ansi.YELLOW,
        logging.ERROR: Ansi.RED,
        logging.CRITICAL: Ansi.RED,
    }
    LEVEL_LABEL = {
        logging.DEBUG: "DEBUG",
        logging.INFO: "LOG",
        logging.WARNING: "WARN",
        logging.ERROR: "ERROR",
        logging.CRITICAL: "ERROR",
    }

    def __init__(self, app_name: str, color: bool | None = None) -> None:
        super().__init__()
        self.app_name = app_name
        self.color = _supports_color() if color is None else color
        self.pid = os.getpid()

    def format(self, record: logging.LogRecord) -> str:
        when = datetime.fromtimestamp(record.created).strftime("%m/%d/%Y, %I:%M:%S %p")
        level = self.LEVEL_LABEL.get(record.levelno, record.levelname)
        context = record.name.split(".")[-1]
        message = record.getMessage()
        if record.exc_info:
            message = f"{message}\n{self.formatException(record.exc_info)}"

        if not self.color:
            return f"[{self.app_name}] {self.pid}  - {when}     {level} [{context}] {message}"

        level_color = self.LEVEL_COLOR.get(record.levelno, Ansi.WHITE)
        return (
            f"{Ansi.CYAN}[{self.app_name}]{Ansi.RESET} "
            f"{Ansi.GRAY}{self.pid}  - {when}{Ansi.RESET}     "
            f"{level_color}{level}{Ansi.RESET} "
            f"{Ansi.YELLOW}[{context}]{Ansi.RESET} "
            f"{level_color}{message}{Ansi.RESET}"
        )


def setup_logging(app_name: str, *, quiet_libs: bool = True) -> logging.Logger:
    """Configure root handlers once; return app logger."""
    _enable_windows_ansi()
    root = logging.getLogger()
    if not any(
        isinstance(h, logging.StreamHandler) and getattr(h, "_nest_style", False)
        for h in root.handlers
    ):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(NestStyleFormatter(app_name))
        handler._nest_style = True  # type: ignore[attr-defined]
        root.handlers.clear()
        root.addHandler(handler)
        root.setLevel(logging.INFO)

    if quiet_libs:
        for name in (
            "pika",
            "pika.adapters",
            "pika.adapters.utils",
            "pika.adapters.blocking_connection",
            "httpx",
            "httpcore",
            "urllib3",
            "openai",
            "qdrant_client",
        ):
            logging.getLogger(name).setLevel(logging.WARNING)

    return logging.getLogger(app_name.lower().replace("-", "_"))

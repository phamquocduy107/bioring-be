"""Nest-compatible HTTP response envelope for personalization_engine.

Mirrors api-gateway TransformInterceptor + AllExceptionsFilter:

Success: { statusCode, message, data }
Error:   { statusCode, message, data: null, timestamp, path }
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def nest_success(
    data: Any,
    *,
    status_code: int = 200,
    message: str = "Success",
) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "message": message,
        "data": data,
    }


def nest_error(
    *,
    status_code: int,
    message: str,
    path: str,
    data: Any = None,
) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "message": message,
        "data": data,
        "timestamp": _utc_now_iso(),
        "path": path,
    }


def _already_enveloped(payload: Any) -> bool:
    return (
        isinstance(payload, dict)
        and "statusCode" in payload
        and "data" in payload
        and "message" in payload
    )


def _detail_to_message(detail: Any) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        parts: list[str] = []
        for item in detail:
            if isinstance(item, dict):
                loc = ".".join(str(x) for x in item.get("loc", []) if x != "body")
                msg = item.get("msg", "")
                parts.append(f"{loc}: {msg}" if loc else str(msg))
            else:
                parts.append(str(item))
        return "; ".join(parts) if parts else "Validation error"
    if isinstance(detail, dict):
        if "message" in detail:
            return str(detail["message"])
        return json.dumps(detail, ensure_ascii=False)
    return str(detail)


class NestResponseMiddleware(BaseHTTPMiddleware):
    """Wrap successful JSON responses in Nest { statusCode, message, data }."""

    SKIP_PREFIXES = ("/docs", "/redoc", "/openapi.json", "/favicon.ico")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if any(path == p or path.startswith(p + "/") for p in self.SKIP_PREFIXES):
            return await call_next(request)

        response = await call_next(request)

        if response.status_code >= 400:
            return response

        content_type = (response.headers.get("content-type") or "").lower()
        if "application/json" not in content_type:
            return response

        body = b""
        async for chunk in response.body_iterator:
            body += chunk if isinstance(chunk, (bytes, bytearray)) else bytes(chunk)

        try:
            payload = json.loads(body.decode("utf-8") or "null")
        except json.JSONDecodeError:
            return Response(
                content=body,
                status_code=response.status_code,
                media_type=content_type,
                headers={
                    k: v
                    for k, v in response.headers.items()
                    if k.lower() not in ("content-length", "content-type")
                },
            )

        if _already_enveloped(payload):
            enveloped = payload
        else:
            enveloped = nest_success(payload, status_code=response.status_code)

        return JSONResponse(
            content=enveloped,
            status_code=int(enveloped.get("statusCode", response.status_code)),
            headers={
                k: v
                for k, v in response.headers.items()
                if k.lower()
                not in ("content-length", "content-type", "content-encoding")
            },
        )


def register_nest_response_layer(app: FastAPI) -> None:
    """Install middleware + exception handlers matching Nest gateway shape."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request, exc: HTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=nest_error(
                status_code=exc.status_code,
                message=_detail_to_message(exc.detail),
                path=request.url.path,
            ),
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=nest_error(
                status_code=422,
                message=_detail_to_message(exc.errors()),
                path=request.url.path,
                data={"errors": exc.errors()},
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content=nest_error(
                status_code=500,
                message=str(exc) or "Internal server error",
                path=request.url.path,
            ),
        )

    app.add_middleware(NestResponseMiddleware)

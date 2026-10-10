"""
Claude Code SDK - The SDK Way

This module demonstrates the idiomatic way to use the Claude Code Python SDK
for programmatic agent interactions. It focuses on clean, type-safe patterns
using the SDK's native abstractions.

Key Concepts:
- Use `query()` for one-shot operations
- Use `ClaudeSDKClient` for interactive sessions
- Work directly with SDK message types
- Leverage async/await for clean concurrency
- Configure options for your use case

Example Usage:
    # Simple query
    async for message in query(prompt="What is 2 + 2?"):
        if isinstance(message, AssistantMessage):
            print(extract_text(message))
    
    # With options
    options = ClaudeAgentOptions(
        model="claude-sonnet-4-20250514",
        allowed_tools=["Read", "Write"],
        permission_mode="bypassPermissions",
        setting_sources=["project", "user"],
    )
    async for message in query(prompt="Create hello.py", options=options):
        process_message(message)
    
    # Interactive session
    async with create_session() as client:
        await client.query("Debug this error")
        async for msg in client.receive_response():
            handle_message(msg)
"""

import asyncio
import logging
import random
from pathlib import Path
from typing import Any, AsyncIterator, Callable, Literal, Optional, List
from contextlib import asynccontextmanager

# Import all SDK components we'll use
from claude_agent_sdk import (
    # Main functions
    query,
    ClaudeSDKClient,
    
    # Configuration
    ClaudeAgentOptions,
    Message,
    AssistantMessage,
    ResultMessage,
    
    # Content blocks
    TextBlock,
    ToolUseBlock,
    ClaudeSDKError,
    CLIConnectionError,
    CLINotFoundError,
    ProcessError,
)

# Set up logging
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rate-limit retry
# ---------------------------------------------------------------------------

RetryOutcome = Literal["ok", "degraded_rate_limited", "degraded_other"]


async def retry_on_rate_limit(
    run_query: Callable,
    *,
    max_retries: int = 3,
    base_seconds: float = 60.0,
    cap_seconds: float = 300.0,
    jitter_seconds: float = 5.0,
    logger: logging.Logger,
    label: str,
) -> "tuple[list[str], int, RetryOutcome]":
    """Wrap an SDK message loop with exponential-backoff retry for rate-limit events.

    Args:
        run_query: Zero-arg callable returning an async iterator over SDK messages.
                   Called once per attempt; re-invoked on retry for a fresh session.
        max_retries: Maximum retry attempts after the initial.
        base_seconds: Initial sleep before the first retry.
        cap_seconds: Cap on exponential backoff growth.
        jitter_seconds: Uniform jitter range added to each sleep.
        logger: Logger for retry/degraded lines.
        label: Short descriptor for log lines (e.g. "JS agent batch=0").

    Returns:
        (text_parts, total_rate_limit_events, outcome) where:
          - text_parts: text accumulated from AssistantMessage TextBlocks +
                        ResultMessage.result across the successful attempt
          - total_rate_limit_events: cumulative rate_limit_event count
          - outcome: 'ok' | 'degraded_rate_limited' | 'degraded_other'

    Retry trigger is narrow:
      - empty text_parts AND rate_limit_events > 0  → retry up to max_retries
      - empty text_parts AND rate_limit_events == 0 → return ([], 0, 'ok')
      - non-rate-limit exception                    → return (partial, n, 'degraded_other')
      - retries exhausted                           → return ([], n, 'degraded_rate_limited')
    """
    total_rate_limit_events = 0

    for attempt in range(max_retries + 1):
        text_parts: list[str] = []
        rate_limit_events_this_attempt = 0

        try:
            _gen = run_query()
            try:
                while True:
                    try:
                        message = await _gen.__anext__()
                    except StopAsyncIteration:
                        break
                    except Exception as exc:
                        if "rate_limit_event" in str(exc):
                            rate_limit_events_this_attempt += 1
                            total_rate_limit_events += 1
                        else:
                            logger.warning(
                                "[%s] Non-rate-limit exception %s: %s — returning degraded_other",
                                label, type(exc).__name__, exc,
                            )
                            return text_parts, total_rate_limit_events, "degraded_other"
                        continue

                    if isinstance(message, AssistantMessage):
                        for block in message.content:
                            if isinstance(block, TextBlock) and block.text:
                                text_parts.append(block.text)
                    elif isinstance(message, ResultMessage):
                        if message.result:
                            text_parts.append(message.result)
                        break
            finally:
                try:
                    await _gen.aclose()  # type: ignore[attr-defined]
                except Exception:
                    pass
        except Exception as exc:
            logger.warning(
                "[%s] SDK session error %s: %s — returning degraded_other",
                label, type(exc).__name__, exc,
            )
            return text_parts, total_rate_limit_events, "degraded_other"

        # Decision: did we get content?
        if text_parts:
            return text_parts, total_rate_limit_events, "ok"

        if rate_limit_events_this_attempt == 0:
            # Genuinely empty (no throttle) — don't retry, model returned nothing
            return [], total_rate_limit_events, "ok"

        # Empty + rate-limit events → retry if budget allows
        if attempt >= max_retries:
            logger.warning(
                "[%s] Rate-limit retries exhausted after %d attempt(s) — degraded_rate_limited",
                label, max_retries + 1,
            )
            return [], total_rate_limit_events, "degraded_rate_limited"

        sleep_time = (
            min(cap_seconds, base_seconds * (2 ** attempt))
            + random.uniform(0, jitter_seconds)
        )
        logger.info(
            "[%s] Retry %d/%d after %.1fs (rate_limit_events=%d)",
            label, attempt + 1, max_retries, sleep_time, total_rate_limit_events,
        )
        await asyncio.sleep(sleep_time)

    # Unreachable — loop always returns inside the body
    return [], total_rate_limit_events, "degraded_rate_limited"


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def extract_text(message: AssistantMessage) -> str:
    """Extract all text content from an assistant message.
    
    The SDK way: Work directly with typed message objects.
    
    Args:
        message: AssistantMessage with content blocks
        
    Returns:
        Concatenated text from all text blocks
    """
    texts = []
    for block in message.content:
        if isinstance(block, TextBlock):
            texts.append(block.text)
    return "\n".join(texts)


def extract_tool_uses(message: AssistantMessage) -> List[ToolUseBlock]:
    """Extract all tool use blocks from an assistant message.
    
    Args:
        message: AssistantMessage with content blocks
        
    Returns:
        List of ToolUseBlock objects
    """
    return [
        block for block in message.content 
        if isinstance(block, ToolUseBlock)
    ]


def get_result_text(messages: List[Message]) -> str:
    """Extract final result text from a list of messages.
    
    Args:
        messages: List of messages from a query
        
    Returns:
        Result text or assistant responses
    """
    # First check for ResultMessage
    for msg in reversed(messages):
        if isinstance(msg, ResultMessage) and msg.result:
            return msg.result
    
    # Otherwise collect assistant text
    texts = []
    for msg in messages:
        if isinstance(msg, AssistantMessage):
            text = extract_text(msg)
            if text:
                texts.append(text)
    
    return "\n".join(texts)


# ============================================================================
# ONE-SHOT QUERIES (The Simple SDK Way)
# ============================================================================


# Canonical Haiku model ID used for cheap one-shot extraction queries.
HAIKU_MODEL_ID = "claude-haiku-4-5-20251001"


def query_one_shot_text_sync(
    prompt: str,
    model: str = HAIKU_MODEL_ID,
) -> Optional[str]:
    """Sync one-shot text query against `model` via the Claude Code SDK.

    Designed to replace the `anthropic.Anthropic().messages.create(...)` pattern
    for lightweight extraction tasks. Routes through the authenticated `claude` CLI session — no
    `ANTHROPIC_API_KEY` required.

    Returns the concatenated assistant text, or None on failure (caller logs
    and falls back). No tools are enabled; this is text-in/text-out only.

    Defensive behaviors:
      - rate_limit_event Exceptions (raised mid-iteration, not as SDK errors)
        are skipped rather than treated as terminal
      - the async generator is aclose()'d inside the same event loop that
        created it, so subsequent asyncio.run() callers don't hit
        "Loop is closed" warnings
    """
    import asyncio

    async def _run() -> Optional[str]:
        options = ClaudeAgentOptions(
            model=model,
            setting_sources=["project", "user"],
        )

        texts: List[str] = []
        result_text: Optional[str] = None
        _gen = query(prompt=prompt, options=options)
        try:
            while True:
                try:
                    message = await _gen.__anext__()
                except StopAsyncIteration:
                    break
                except Exception as e:
                    if "rate_limit_event" in str(e):
                        logger.info("query_one_shot_text_sync: rate_limit_event, continuing")
                        continue
                    logger.warning("query_one_shot_text_sync: unknown SDK event %s: %s",
                                   type(e).__name__, e)
                    continue
                if isinstance(message, AssistantMessage):
                    text = extract_text(message)
                    if text:
                        texts.append(text)
                elif isinstance(message, ResultMessage):
                    if message.result:
                        result_text = message.result
        finally:
            try:
                await _gen.aclose()  # type: ignore[attr-defined]
            except Exception:
                pass

        if result_text:
            return result_text
        if texts:
            return "\n".join(texts)
        return None

    try:
        return asyncio.run(_run())
    except Exception as exc:
        logger.warning("query_one_shot_text_sync failed: %s", exc)
        return None


async def simple_query(prompt: str, model: str = "claude-sonnet-4-20250514") -> str:
    """Simple one-shot query with text response.
    
    The SDK way: Direct use of query() with minimal setup.
    
    Args:
        prompt: What to ask Claude
        model: Which model to use
        
    Returns:
        Text response from Claude
        
    Example:
        response = await simple_query("What is 2 + 2?")
        print(response)  # "4" or "2 + 2 equals 4"
    """
    options = ClaudeAgentOptions(model=model, setting_sources=["project", "user"])
    
    texts = []
    _gen = query(prompt=prompt, options=options)
    try:
        while True:
            try:
                message = await _gen.__anext__()
            except StopAsyncIteration:
                break
            except ClaudeSDKError as e:
                logger.warning("Skipping unknown SDK message type: %s", e)
                continue
            if isinstance(message, AssistantMessage):
                text = extract_text(message)
                if text:
                    texts.append(text)
    finally:
        try:
            await _gen.aclose()  # type: ignore[attr-defined]
        except Exception:
            pass

    return "\n".join(texts) if texts else "No response"


async def query_with_tools(
    prompt: str,
    allowed_tools: List[str],
    working_dir: Optional[Path] = None
) -> AsyncIterator[Message]:
    """Query with specific tools enabled.
    
    The SDK way: Configure options for your use case.
    
    Args:
        prompt: What to ask Claude
        allowed_tools: List of tool names to allow
        working_dir: Optional working directory
        
    Yields:
        SDK message objects
        
    Example:
        async for msg in query_with_tools(
            "Create a Python script",
            allowed_tools=["Write", "Read"]
        ):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, ToolUseBlock):
                        print(f"Using tool: {block.name}")
    """
    options = ClaudeAgentOptions(
        allowed_tools=allowed_tools,
        cwd=str(working_dir) if working_dir else None,
        permission_mode="bypassPermissions",  # For automated workflows
        setting_sources=["project", "user"],
    )
    
    _gen = query(prompt=prompt, options=options)
    try:
        while True:
            try:
                message = await _gen.__anext__()
            except StopAsyncIteration:
                break
            except ClaudeSDKError as e:
                logger.warning("Skipping unknown SDK message type: %s", e)
                continue
            yield message
    finally:
        try:
            await _gen.aclose()  # type: ignore[attr-defined]
        except Exception:
            pass


async def collect_query_response(
    prompt: str,
    options: Optional[ClaudeAgentOptions] = None
) -> tuple[List[Message], Optional[ResultMessage]]:
    """Collect all messages from a query.
    
    The SDK way: Async iteration with type checking.
    
    Args:
        prompt: What to ask Claude
        options: Optional configuration
        
    Returns:
        Tuple of (all_messages, result_message)
        
    Example:
        messages, result = await collect_query_response("List files")
        if result and not result.is_error:
            print("Success!")
        for msg in messages:
            process_message(msg)
    """
    if options is None:
        options = ClaudeAgentOptions(setting_sources=["project", "user"])
    
    messages = []
    result = None

    _gen = query(prompt=prompt, options=options)
    try:
        while True:
            try:
                message = await _gen.__anext__()
            except StopAsyncIteration:
                break
            except ClaudeSDKError as e:
                logger.warning("Skipping unknown SDK message type: %s", e)
                continue
            messages.append(message)
            if isinstance(message, ResultMessage):
                result = message
    finally:
        try:
            await _gen.aclose()  # type: ignore[attr-defined]
        except Exception:
            pass

    return messages, result


# ============================================================================
# INTERACTIVE SESSIONS (The SDK Client Way)
# ============================================================================

@asynccontextmanager
async def create_session(
    model: str = "claude-sonnet-4-20250514",
    working_dir: Optional[Path] = None
):
    """Create an interactive session with Claude.
    
    The SDK way: Use context managers for resource management.
    
    Args:
        model: Which model to use
        working_dir: Optional working directory
        
    Yields:
        Connected ClaudeSDKClient
        
    Example:
        async with create_session() as client:
            await client.query("Hello")
            async for msg in client.receive_response():
                print(msg)
    """
    options = ClaudeAgentOptions(
        model=model,
        cwd=str(working_dir) if working_dir else None,
        permission_mode="bypassPermissions",
        setting_sources=["project", "user"],
    )

    client = ClaudeSDKClient(options=options)
    await client.connect()
    
    try:
        yield client
    finally:
        await client.disconnect()


async def interactive_conversation(prompts: List[str]) -> List[Message]:
    """Have an interactive conversation with Claude.
    
    The SDK way: Bidirectional communication with the client.
    
    Args:
        prompts: List of prompts to send in sequence
        
    Returns:
        All messages from the conversation
        
    Example:
        messages = await interactive_conversation([
            "What's the weather like?",
            "Tell me more about clouds",
            "How do they form?"
        ])
    """
    all_messages = []
    
    async with create_session() as client:
        for prompt in prompts:
            # Send prompt
            await client.query(prompt)
            
            # Collect response
            async for msg in client.receive_response():
                all_messages.append(msg)
                if isinstance(msg, ResultMessage):
                    break
    
    return all_messages


# ============================================================================
# ERROR HANDLING (The SDK Way)
# ============================================================================

async def safe_query(prompt: str) -> tuple[Optional[str], Optional[str]]:
    """Query with comprehensive error handling.
    
    The SDK way: Handle specific SDK exceptions.
    
    Args:
        prompt: What to ask Claude
        
    Returns:
        Tuple of (response_text, error_message)
        
    Example:
        response, error = await safe_query("Help me debug this")
        if error:
            print(f"Error: {error}")
        else:
            print(f"Response: {response}")
    """
    try:
        response = await simple_query(prompt)
        return response, None
        
    except CLINotFoundError:
        return None, "Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
        
    except CLIConnectionError as e:
        return None, f"Connection error: {str(e)}"
        
    except ProcessError as e:
        return None, f"Process error (exit code {e.exit_code}): {str(e)}"
        
    except ClaudeSDKError as e:
        return None, f"SDK error: {str(e)}"
        
    except Exception as e:
        return None, f"Unexpected error: {str(e)}"


# ============================================================================
# ADVANCED PATTERNS (The SDK Way)
# ============================================================================

async def stream_with_progress(
    prompt: str,
    on_text: Optional[Callable[..., Any]] = None,
    on_tool: Optional[Callable[..., Any]] = None
) -> Optional[ResultMessage]:
    """Stream query with progress callbacks.
    
    The SDK way: Process messages as they arrive.
    
    Args:
        prompt: What to ask Claude
        on_text: Callback for text blocks (optional)
        on_tool: Callback for tool use blocks (optional)
        
    Returns:
        Final ResultMessage
        
    Example:
        result = await stream_with_progress(
            "Analyze this codebase",
            on_text=lambda text: print(f"Claude: {text}"),
            on_tool=lambda tool: print(f"Using: {tool.name}")
        )
        print(f"Cost: ${result.total_cost_usd:.4f}")
    """
    result = None

    _gen = query(prompt=prompt)
    try:
        while True:
            try:
                message = await _gen.__anext__()
            except StopAsyncIteration:
                break
            except ClaudeSDKError as e:
                logger.warning("Skipping unknown SDK message type: %s", e)
                continue
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock) and on_text:
                        on_text(block.text)
                    elif isinstance(block, ToolUseBlock) and on_tool:
                        on_tool(block)
            elif isinstance(message, ResultMessage):
                result = message
    finally:
        try:
            await _gen.aclose()  # type: ignore[attr-defined]
        except Exception:
            pass

    return result


async def query_with_timeout(prompt: str, timeout_seconds: float = 30) -> Optional[str]:
    """Query with timeout protection.
    
    The SDK way: Use asyncio for timeout control.
    
    Args:
        prompt: What to ask Claude
        timeout_seconds: Maximum time to wait
        
    Returns:
        Response text or None if timeout
        
    Example:
        response = await query_with_timeout("Complex analysis", timeout_seconds=60)
        if response is None:
            print("Query timed out")
    """
    import asyncio
    
    try:
        # Create the query task
        async def _query():
            return await simple_query(prompt)
        
        # Run with timeout
        response = await asyncio.wait_for(_query(), timeout=timeout_seconds)
        return response
        
    except asyncio.TimeoutError:
        logger.warning(f"Query timed out after {timeout_seconds} seconds")
        return None


# ============================================================================
# SDK EVENT SERIALIZATION
# ============================================================================

def serialize_sdk_event(event: "Any") -> dict:
    """Serialize a claude_agent_sdk message to a JSONL-compatible dict.

    Schema matches the cc_raw_output.jsonl format used by adw_modules/agent.py.
    Each call produces exactly one JSON-serializable dict; a crash after the
    write leaves a complete line, never a partial one.
    """
    from claude_agent_sdk import (
        AssistantMessage as _AM,
        ResultMessage as _RM,
        SystemMessage as _SM,
        UserMessage as _UM,
        TextBlock as _TB,
        ToolUseBlock as _TUB,
        ToolResultBlock as _TRB,
    )
    if isinstance(event, _SM):
        return {"type": "system", "subtype": event.subtype, "data": event.data}
    if isinstance(event, _AM):
        blocks: list[dict[str, Any]] = []
        for block in event.content:
            if isinstance(block, _TB):
                blocks.append({"type": "text", "text": block.text})
            elif isinstance(block, _TUB):
                blocks.append({"type": "tool_use", "id": block.id, "name": block.name, "input": block.input})
            else:
                blocks.append({"type": "unknown", "repr": str(block)[:200]})
        return {"type": "assistant", "content": blocks}
    if isinstance(event, _UM):
        um_blocks: list[dict[str, Any]] = []
        for blk in event.content:
            if isinstance(blk, _TRB):
                content = blk.content
                if isinstance(content, str) and len(content) > 8192:
                    content = content[:8192] + f"\n... [{len(content) - 8192} bytes truncated]"
                um_blocks.append({
                    "type": "tool_result",
                    "tool_use_id": blk.tool_use_id,
                    "content": content,
                    "is_error": blk.is_error,
                })
            else:
                um_blocks.append({"type": "unknown", "repr": str(blk)[:200]})
        return {"type": "user", "content": um_blocks}
    if isinstance(event, _RM):
        return {
            "type": "result",
            "subtype": event.subtype,
            "is_error": event.is_error,
            "num_turns": event.num_turns,
            "total_cost_usd": event.total_cost_usd,
            "result": event.result,
        }
    return {"type": "unknown", "repr": str(event)[:200]}


def extract_tool_use_id(block: "Any") -> "str | None":
    """Adapter for ToolUseBlock.id — single site for a future SDK field rename."""
    return getattr(block, "id", None)


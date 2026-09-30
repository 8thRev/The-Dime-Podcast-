"""
Claude client for the Isaac Burner column: turns a question plus episode
grounding material into one structured post, then fact checks it.

Same retry shape as transcript_claude_client.py, and the same reasoning: a
dropped key or a JSON syntax slip is a stochastic formatting miss that one
repeat call usually fixes, while a max_tokens cutoff or an API error will
fail identically every time and is not retried.

Unlike the transcript client this does not stream. A post is under 1,000
words, so the whole response fits well inside the non streaming timeout, and
the token budget is a fraction of a cleaned transcript's.

Two calls per post: generate_post() writes it on ANTHROPIC_MODEL, and
check_post() fact checks it against the full transcripts on the cheaper
ISAAC_CHECK_MODEL. Each is labelled in the api-usage log ("write", "fact
check") so the cost of the check is visible on its own.
"""

import json

import anthropic
import spend_guard

from config import config
from isaac_prompts import get_answer_prompt, get_fact_check_prompt

REQUIRED_KEYS = {
    "unanswerable",
    "title",
    "metaTitle",
    "slug",
    "summary",
    "description",
    "body",
    "topics",
    "episodes",
    "faq",
    "timeSensitive",
}

MAX_GENERATION_ATTEMPTS = 2


class IsaacClaudeClient:
    """Client for generating and fact checking one Answers column post."""

    def __init__(self):
        self.client = spend_guard.make_client("isaac")
        self.model = config.ANTHROPIC_MODEL
        self.max_tokens = config.ISAAC_MAX_TOKENS
        self.check_model = config.ISAAC_CHECK_MODEL
        self.check_max_tokens = config.ISAAC_CHECK_MAX_TOKENS

    def generate_post(
        self,
        question: str,
        question_origin: str,
        sources: list[dict],
        answered_questions: list[str],
        today: str,
    ) -> tuple[bool, dict]:
        """Returns (success, data). data is {} on failure."""
        prompt = get_answer_prompt(
            question, question_origin, sources, answered_questions, today, config.ISAAC_MAX_SOURCE_AGE_MONTHS
        )
        self.client.budget.label = "write"
        return self._call_with_retry(prompt, self.model, self.max_tokens, REQUIRED_KEYS)

    def check_post(self, post: dict, sources: list[dict], today: str) -> tuple[bool, list[dict]]:
        """Returns (success, claims). A check that failed to run is not a
        pass: the caller treats (False, []) as a rejection."""
        prompt = get_fact_check_prompt(post, sources, today)
        self.client.budget.label = "fact check"
        success, data = self._call_with_retry(prompt, self.check_model, self.check_max_tokens, {"claims"})
        if not success or not isinstance(data.get("claims"), list):
            return False, []
        return True, [c for c in data["claims"] if isinstance(c, dict)]

    def _call_with_retry(self, prompt: str, model: str, max_tokens: int, required: set[str]) -> tuple[bool, dict]:
        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            success, data, retryable = self._generate_once(prompt, model, max_tokens, required, attempt)
            if success:
                return True, data
            if not retryable:
                break
        return False, {}

    def _generate_once(
        self, prompt: str, model: str, max_tokens: int, required: set[str], attempt: int
    ) -> tuple[bool, dict, bool]:
        retry_suffix = f" (attempt {attempt}/{MAX_GENERATION_ATTEMPTS})"
        try:
            message = self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )

            if message.stop_reason == "max_tokens":
                print(
                    f"Error: Claude hit the max_tokens cap ({max_tokens}) before finishing. "
                    "Raise ISAAC_MAX_TOKENS or ISAAC_CHECK_MAX_TOKENS rather than treating "
                    "this as a JSON formatting bug."
                )
                return False, {}, False

            text = "\n".join(
                block.text for block in message.content if block.type == "text"
            ).strip()

            # Claude occasionally wraps JSON in a markdown fence despite
            # instructions not to; strip it before parsing.
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
                text = text.strip()

            # strict=False for the same reason as the transcript client: a
            # literal newline inside a string value, which shows up in the
            # markdown "body" field, otherwise rejects the whole object.
            data = json.loads(text, strict=False)

            missing = required - data.keys()
            if missing:
                print(f"Error: Claude response missing expected keys: {missing}{retry_suffix}")
                return False, {}, True

            return True, data, True

        except json.JSONDecodeError as e:
            print(f"Error: Claude did not return valid JSON: {e}{retry_suffix}")
            return False, {}, True
        except anthropic.APIError as e:
            print(f"Claude API error: {e}")
            return False, {}, False
        except Exception as e:
            print(f"Unexpected error calling Claude: {e}")
            return False, {}, False

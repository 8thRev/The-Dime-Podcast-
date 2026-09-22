"""
Claude client for the Isaac Burner column: turns a question plus episode
grounding material into one structured post.

Same retry shape as transcript_claude_client.py, and the same reasoning: a
dropped key or a JSON syntax slip is a stochastic formatting miss that one
repeat call usually fixes, while a max_tokens cutoff or an API error will
fail identically every time and is not retried.

Unlike the transcript client this does not stream. A post is under 1,000
words, so the whole response fits well inside the non streaming timeout, and
the token budget is a fraction of a cleaned transcript's.
"""

import json

import anthropic

from config import config
from isaac_prompts import get_answer_prompt

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
}

MAX_GENERATION_ATTEMPTS = 2


class IsaacClaudeClient:
    """Client for generating one Answers column post via Claude."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        self.model = config.ANTHROPIC_MODEL
        self.max_tokens = config.ISAAC_MAX_TOKENS

    def generate_post(
        self,
        question: str,
        question_origin: str,
        sources: list[dict],
        answered_questions: list[str],
    ) -> tuple[bool, dict]:
        """Returns (success, data). data is {} on failure."""
        prompt = get_answer_prompt(question, question_origin, sources, answered_questions)

        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            success, data, retryable = self._generate_once(prompt, attempt)
            if success:
                return True, data
            if not retryable:
                break
        return False, {}

    def _generate_once(self, prompt: str, attempt: int) -> tuple[bool, dict, bool]:
        retry_suffix = f" (attempt {attempt}/{MAX_GENERATION_ATTEMPTS})"
        try:
            message = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )

            if message.stop_reason == "max_tokens":
                print(
                    f"Error: Claude hit the max_tokens cap ({self.max_tokens}) before "
                    "finishing the post. Raise ISAAC_MAX_TOKENS rather than treating "
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

            missing = REQUIRED_KEYS - data.keys()
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
            print(f"Unexpected error generating post: {e}")
            return False, {}, False

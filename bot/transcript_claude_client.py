"""
Claude client for turning a raw caption transcript into on-site content:
a cleaned, speaker-labeled transcript plus takeaways, FAQ, quotes, and
topic tags — returned as one structured JSON object.
"""

import json

import anthropic

from config import config
from transcript_prompts import get_transcript_prompt

REQUIRED_KEYS = {"cleaned_transcript", "summary", "takeaways", "faq", "quotes", "topics", "entities"}


class TranscriptClaudeClient:
    """Client for generating transcript-derived artifacts via Claude."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        self.model = config.ANTHROPIC_MODEL
        self.max_tokens = config.TRANSCRIPT_MAX_TOKENS

    def generate_artifacts(
        self, guest_name: str, company: str, episode_title: str, raw_transcript: str
    ) -> tuple[bool, dict]:
        """
        Returns (success, data) where data has keys: cleaned_transcript,
        takeaways, faq, quotes, topics. data is {} on failure.
        """
        prompt = get_transcript_prompt(guest_name, company, episode_title, raw_transcript)

        try:
            # Long episodes need tens of thousands of output tokens for the
            # cleaned transcript alone, so this routinely exceeds the ~16k
            # threshold where the SDK requires streaming to avoid a
            # non-streaming HTTP timeout.
            with self.client.messages.stream(
                model=self.model,
                max_tokens=self.max_tokens,
                messages=[{"role": "user", "content": prompt}],
            ) as stream:
                message = stream.get_final_message()

            if message.stop_reason == "max_tokens":
                # The response was cut off mid-generation because it hit
                # max_tokens -- this is a token-budget problem, not a
                # formatting mistake, and will always fail JSON parsing
                # (typically as an unterminated string or truncated key).
                # Surface that distinctly instead of letting it fall through
                # to the generic "did not return valid JSON" branch below.
                print(
                    f"Error: Claude hit the max_tokens cap ({self.max_tokens}) before "
                    "finishing the response -- the transcript is longer than the "
                    "configured token budget. Raise TRANSCRIPT_MAX_TOKENS rather than "
                    "treating this as a JSON formatting bug."
                )
                return False, {}

            text = "\n".join(
                block.text for block in message.content if block.type == "text"
            ).strip()

            # Claude occasionally wraps JSON in a markdown fence despite
            # instructions not to; strip it if present before parsing.
            if text.startswith("```"):
                text = text.strip("`")
                if text.lower().startswith("json"):
                    text = text[4:]
                text = text.strip()

            data = json.loads(text)

            missing = REQUIRED_KEYS - data.keys()
            if missing:
                print(f"Error: Claude response missing expected keys: {missing}")
                return False, {}

            return True, data

        except json.JSONDecodeError as e:
            print(f"Error: Claude did not return valid JSON: {e}")
            return False, {}
        except anthropic.APIError as e:
            print(f"Claude API error: {e}")
            return False, {}
        except Exception as e:
            print(f"Unexpected error generating transcript artifacts: {e}")
            return False, {}

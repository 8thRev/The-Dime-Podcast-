"""
Anthropic Claude API client for generating research documents.
"""

import anthropic
from config import config
from prompt_template import get_research_prompt


class ClaudeClient:
    """Client for interacting with Anthropic Claude API."""

    # Safety cap on continuation requests if Claude's server-side search
    # loop pauses (stop_reason "pause_turn") before it's done researching.
    MAX_CONTINUATIONS = 5

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        self.model = config.ANTHROPIC_MODEL
        self.max_tokens = config.ANTHROPIC_MAX_TOKENS
        # Server-side tools: web_search finds guest info, web_fetch pulls the
        # specific LinkedIn/company URLs passed in via links_and_notes.
        # web_search is billed per use ($10/1,000); web_fetch has no per-use
        # fee but its content still counts as input tokens.
        self.research_tools = [
            {
                "type": "web_search_20260209",
                "name": "web_search",
                "max_uses": config.ANTHROPIC_MAX_WEB_SEARCHES,
            },
            {
                "type": "web_fetch_20260209",
                "name": "web_fetch",
                "max_uses": config.ANTHROPIC_MAX_WEB_FETCHES,
                "max_content_tokens": config.ANTHROPIC_MAX_FETCH_CONTENT_TOKENS,
            },
        ]

    def generate_research(
        self,
        guest_name: str,
        company: str,
        title: str,
        links_and_notes: str = "",
    ) -> tuple[bool, str]:
        """
        Generate research document for a guest using Claude, with web search
        and web fetch enabled so Claude can look up current information
        instead of relying only on training data.

        Args:
            guest_name: Name of the guest
            company: Guest's company
            title: Guest's job title
            links_and_notes: Optional links/notes from Trello (LinkedIn, company URL, etc.) for better research.

        Returns:
            tuple: (success: bool, content: str)
        """
        try:
            print(f"Generating research for {guest_name} via Claude API...")

            # Build the prompt (includes links/notes when provided)
            prompt = get_research_prompt(
                guest_name, company, title, links_and_notes=links_and_notes
            )

            messages = [{"role": "user", "content": prompt}]
            message = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                tools=self.research_tools,
                messages=messages,
            )
            usage = [message.usage]

            # Claude's server-side search loop pauses after its default
            # iteration limit if it's still researching; resend history to
            # let it continue rather than cutting research short.
            continuations = 0
            while (
                message.stop_reason == "pause_turn"
                and continuations < self.MAX_CONTINUATIONS
            ):
                messages = [
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": message.content},
                ]
                message = self.client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    tools=self.research_tools,
                    messages=messages,
                )
                usage.append(message.usage)
                continuations += 1

            self._print_usage(usage, message.stop_reason)

            # Only an end_turn is a finished brief. max_tokens means the
            # write-up was cut off (or never started), and a pause_turn left
            # over after MAX_CONTINUATIONS means research never finished;
            # either way the text is a fragment and must not be emailed.
            if message.stop_reason != "end_turn":
                print(
                    f"Error: Claude stopped with stop_reason={message.stop_reason!r} "
                    f"after {continuations} continuation(s); no complete brief. "
                    "If this is max_tokens, raise ANTHROPIC_MAX_TOKENS."
                )
                return False, ""

            # Join every text block in order (adaptive thinking, search
            # narration, and the final write-up can each land in separate
            # blocks; concatenating avoids only capturing a preamble).
            content = "\n\n".join(
                block.text for block in message.content if block.type == "text"
            ).strip()

            if content:
                print(f"Successfully generated research ({len(content)} characters)")
                return True, content
            else:
                print("Error: Empty response from Claude")
                return False, ""

        except anthropic.APIError as e:
            print(f"Claude API error: {e}")
            return False, ""
        except Exception as e:
            print(f"Unexpected error generating research: {e}")
            return False, ""

    @staticmethod
    def _print_usage(usage: list, stop_reason: str) -> None:
        """Log what a guest's research cost, so spend shows up in the run log
        whether or not the run succeeded."""
        input_tokens = sum(u.input_tokens or 0 for u in usage)
        output_tokens = sum(u.output_tokens or 0 for u in usage)
        searches = sum(
            (getattr(u.server_tool_use, "web_search_requests", 0) or 0)
            if getattr(u, "server_tool_use", None)
            else 0
            for u in usage
        )
        print(
            f"Claude usage: {len(usage)} request(s), {input_tokens:,} input tokens, "
            f"{output_tokens:,} output tokens, {searches} web search(es), "
            f"final stop_reason={stop_reason}"
        )

    def validate_api_key(self) -> bool:
        """
        Validate that the API key works.

        Returns:
            True if API key is valid, False otherwise
        """
        try:
            # Make a minimal API call to test the key
            self.client.messages.create(
                model=self.model,
                max_tokens=10,
                messages=[{"role": "user", "content": "Test"}],
            )
            return True
        except anthropic.AuthenticationError:
            print("Error: Invalid Anthropic API key")
            return False
        except Exception as e:
            print(f"Error validating API key: {e}")
            return False

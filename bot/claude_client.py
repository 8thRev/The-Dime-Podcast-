"""
Anthropic Claude API client for generating research documents.
"""

import anthropic
from config import config
from prompt_template import get_research_prompt


class ClaudeClient:
    """Client for interacting with Anthropic Claude API."""

    def __init__(self):
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
        self.model = config.ANTHROPIC_MODEL
        self.max_tokens = config.ANTHROPIC_MAX_TOKENS
        self.temperature = config.ANTHROPIC_TEMPERATURE

    def generate_research(
        self,
        guest_name: str,
        company: str,
        title: str,
        links_and_notes: str = "",
    ) -> tuple[bool, str]:
        """
        Generate research document for a guest using Claude.

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

            # Call Claude API
            message = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                messages=[{"role": "user", "content": prompt}],
            )

            # Extract response content
            if message.content and len(message.content) > 0:
                content = message.content[0].text
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

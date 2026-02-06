"""
Trello API client for reading and updating cards.
"""

import re
import requests
from datetime import datetime, timezone
from typing import Optional
from config import config


class TrelloCard:
    """Represents a Trello card with guest information."""

    def __init__(
        self,
        card_id: str,
        name: str,
        recording_date: datetime,
        description: str,
        labels: list[str],
    ):
        self.card_id = card_id
        self.name = name
        self.recording_date = recording_date
        self.description = description
        self.labels = labels
        self.company: Optional[str] = None
        self.title: Optional[str] = None

        # Try to extract company and title from the card
        self._parse_guest_info()
        self.links_and_notes = self._get_links_and_notes()

    def _get_links_and_notes(self) -> str:
        """Return description content after the first 3 required lines (Company, Title, Recording Date). Used as context/links for Claude."""
        lines = []
        for line in self.description.splitlines():
            s = line.strip()
            if re.match(r"^Company:\s*.+", s, re.IGNORECASE):
                continue
            if re.match(r"^Title:\s*.+", s, re.IGNORECASE):
                continue
            if re.match(r"^Recording\s+Date\s*[:\s].+", s, re.IGNORECASE):
                continue
            if s:
                lines.append(s)
        return "\n".join(lines).strip()

    # Common job titles used to detect "Company Title" vs "Title Company" on one line
    _JOB_TITLE_WORDS = frozenset(
        {
            "founder", "ceo", "cto", "cfo", "coo", "president", "director",
            "vp", "vice president", "head", "lead", "manager", "chief",
            "partner", "principal", "owner", "consultant", "advisor",
        }
    )

    def _parse_guest_info(self) -> None:
        """Extract company and title from card description or name."""
        desc = self.description.strip()

        # 1) Explicit format: "Company: XYZ" and "Title: ABC"
        company_match = re.search(
            r"Company:\s*(.+?)(?:\n|$)", desc, re.IGNORECASE
        )
        title_match = re.search(
            r"Title:\s*(.+?)(?:\n|$)", desc, re.IGNORECASE
        )
        if company_match:
            self.company = company_match.group(1).strip()
        if title_match:
            self.title = title_match.group(1).strip()

        # 2) Markdown-style link: [LEVIA | The Finest Cannabis Goods](url) or [Company Name](url)
        if not self.company:
            link_match = re.search(
                r"\[([^\]\|]+)(?:\s*\|\s*[^\]]*)?\]\s*\([^)]+\)", desc
            )
            if link_match:
                self.company = link_match.group(1).strip()

        # 3) Plain link text (Trello sometimes shows as "text" without markdown) - line with |
        if not self.company:
            pipe_match = re.search(r"^([A-Za-z0-9&\s]+)\s*\|\s*.+$", desc, re.MULTILINE)
            if pipe_match:
                self.company = pipe_match.group(1).strip()

        # 4) One line like "Levia Founder" or "CompanyName Title" (title is a known job word)
        if not self.company or not self.title:
            for line in desc.splitlines():
                line = line.strip()
                if not line or re.match(r"Recording Date", line, re.I) or line.startswith("http"):
                    continue
                # Two words: "Levia Founder" or "Founder Levia"
                parts = line.split()
                if len(parts) >= 2:
                    first, second = parts[0], parts[1]
                    second_lower = second.lower()
                    first_lower = first.lower()
                    if second_lower in self._JOB_TITLE_WORDS:
                        if not self.company:
                            self.company = first
                        if not self.title:
                            self.title = second
                    elif first_lower in self._JOB_TITLE_WORDS:
                        if not self.company:
                            self.company = second
                        if not self.title:
                            self.title = first
                    elif not self.company and not self.title:
                        # Unknown pattern: treat first as company, second as title
                        self.company = first
                        self.title = second
                break  # Use first meaningful line only

        # 5) "Title at Company" or "Title, Company"
        if not self.company or not self.title:
            at_match = re.search(
                r"(.+?)\s+at\s+(.+?)(?:\n|$)", desc, re.IGNORECASE
            )
            if at_match:
                if not self.title:
                    self.title = at_match.group(1).strip()
                if not self.company:
                    self.company = at_match.group(2).strip()
            else:
                comma_match = re.search(
                    r"^([^,\n]+),\s*([^,\n]+)\s*$", desc, re.MULTILINE
                )
                if comma_match:
                    if not self.title:
                        self.title = comma_match.group(1).strip()
                    if not self.company:
                        self.company = comma_match.group(2).strip()

        # 6) Fallback: card title "Name - Title, Company"
        if not self.company or not self.title:
            name_parts = self.name.split("-")
            if len(name_parts) > 1:
                info = name_parts[1].strip()
                if "," in info:
                    parts = [p.strip() for p in info.split(",", 1)]
                    if not self.title:
                        self.title = parts[0]
                    if not self.company and len(parts) > 1:
                        self.company = parts[1]

    def is_processed(self) -> bool:
        """Check if card has already been processed."""
        return config.TRELLO_PROCESSED_LABEL in self.labels

    def __repr__(self) -> str:
        return (
            f"TrelloCard(name={self.name}, company={self.company}, "
            f"title={self.title}, recording_date={self.recording_date})"
        )


class TrelloClient:
    """Client for interacting with Trello API."""

    BASE_URL = "https://api.trello.com/1"

    def __init__(self):
        self.api_key = config.TRELLO_API_KEY
        self.token = config.TRELLO_API_TOKEN
        self.board_id = config.TRELLO_BOARD_ID
        self.auth_params = {"key": self.api_key, "token": self.token}

    def _get(self, endpoint: str, params: Optional[dict] = None) -> dict:
        """Make GET request to Trello API."""
        url = f"{self.BASE_URL}/{endpoint}"
        all_params = {**self.auth_params, **(params or {})}

        response = requests.get(url, params=all_params, timeout=30)
        response.raise_for_status()
        return response.json()

    def _post(self, endpoint: str, data: Optional[dict] = None) -> dict:
        """Make POST request to Trello API."""
        url = f"{self.BASE_URL}/{endpoint}"
        all_params = {**self.auth_params, **(data or {})}

        response = requests.post(url, params=all_params, timeout=30)
        response.raise_for_status()
        return response.json()

    def _parse_recording_date(self, description: str) -> Optional[datetime]:
        """
        Parse recording date from card description.

        Supported formats (in order of preference):
        - Recording Date: 2026-02-09
        - Recording Date: 2026-02-09 17:15
        - Recording Date: 2026-02-09 17:15:00
        - Recording Date Sch.2026-01-28T18:45:00.000000Z (legacy ISO)
        """
        desc = description.strip()
        utc = timezone.utc

        # 1) Simple: "Recording Date: 2026-02-09" or "Recording Date: 2026-02-09 17:15"
        simple = re.search(
            r"Recording\s+Date\s*[:\s]+(?:Sch\.)?\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})"
            r"(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?",
            desc,
            re.IGNORECASE,
        )
        if simple:
            y, m, d = int(simple.group(1)), int(simple.group(2)), int(simple.group(3))
            h = int(simple.group(4)) if simple.group(4) else 12
            mn = int(simple.group(5)) if simple.group(5) else 0
            sec = int(simple.group(6)) if simple.group(6) else 0
            try:
                return datetime(y, m, d, h, mn, sec, tzinfo=utc)
            except ValueError as e:
                print(f"Error parsing date '{y}-{m}-{d}': {e}")
                return None

        # 2) Legacy ISO: "Recording Date Sch.2026-01-28T18:45:00.000000Z"
        iso = re.search(
            r"Recording\s+Date[:\s]+(?:Sch\.)?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)",
            desc,
            re.IGNORECASE,
        )
        if iso:
            date_str = iso.group(1)
            if not date_str.endswith("Z"):
                date_str += "Z"
            try:
                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                return dt.replace(tzinfo=utc)
            except ValueError as e:
                print(f"Error parsing date '{date_str}': {e}")
                return None

        return None

    def get_pre_column_id(self) -> Optional[str]:
        """Get the ID of the 'Pre' column (list)."""
        lists = self._get(f"boards/{self.board_id}/lists")

        for list_item in lists:
            if list_item["name"].lower() == config.TRELLO_PRE_COLUMN_NAME.lower():
                return list_item["id"]

        print(f"Warning: Column '{config.TRELLO_PRE_COLUMN_NAME}' not found")
        return None

    def get_cards_from_pre_column(self) -> list[TrelloCard]:
        """
        Fetch all cards from the 'Pre' column.

        Returns:
            List of TrelloCard objects with valid recording dates
        """
        list_id = self.get_pre_column_id()
        if not list_id:
            return []

        cards_data = self._get(f"lists/{list_id}/cards")
        trello_cards = []

        for card in cards_data:
            recording_date = self._parse_recording_date(card.get("desc", ""))

            if recording_date:
                labels = [label["name"] for label in card.get("labels", [])]

                trello_card = TrelloCard(
                    card_id=card["id"],
                    name=card["name"],
                    recording_date=recording_date,
                    description=card.get("desc", ""),
                    labels=labels,
                )
                trello_cards.append(trello_card)
            else:
                print(f"Skipping card '{card['name']}': No valid recording date found")

        return trello_cards

    def add_label_to_card(self, card_id: str) -> bool:
        """
        Add 'AI Research Completed' label to a card.

        Args:
            card_id: Trello card ID

        Returns:
            True if successful, False otherwise
        """
        try:
            # First, get or create the label
            label_id = self._get_or_create_label()

            if not label_id:
                print("Failed to get or create label")
                return False

            # Add label to card
            self._post(f"cards/{card_id}/idLabels", {"value": label_id})
            print(f"Added label to card {card_id}")
            return True

        except requests.RequestException as e:
            print(f"Error adding label to card {card_id}: {e}")
            return False

    def _get_or_create_label(self) -> Optional[str]:
        """Get or create the 'AI Research Completed' label."""
        # Get all labels on the board
        labels = self._get(f"boards/{self.board_id}/labels")

        # Check if label already exists
        for label in labels:
            if label["name"] == config.TRELLO_PROCESSED_LABEL:
                return label["id"]

        # Create new label if it doesn't exist
        try:
            new_label = self._post(
                f"boards/{self.board_id}/labels",
                {"name": config.TRELLO_PROCESSED_LABEL, "color": "green"},
            )
            return new_label["id"]
        except requests.RequestException as e:
            print(f"Error creating label: {e}")
            return None

    def add_comment_to_card(self, card_id: str, comment: str) -> bool:
        """
        Add a comment to a card.

        Args:
            card_id: Trello card ID
            comment: Comment text

        Returns:
            True if successful, False otherwise
        """
        try:
            self._post(f"cards/{card_id}/actions/comments", {"text": comment})
            print(f"Added comment to card {card_id}")
            return True
        except requests.RequestException as e:
            print(f"Error adding comment to card {card_id}: {e}")
            return False

"""
Main orchestration script for The Dime Podcast automation.
Runs daily via GitHub Actions to generate research documents.
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from config import config
from trello_client import TrelloClient, TrelloCard
from claude_client import ClaudeClient
from doc_generator import DocGenerator
from email_client import EmailClient


def validate_configuration() -> bool:
    """
    Validate all required configuration values are set.

    Returns:
        True if valid, False otherwise
    """
    print("=" * 80)
    print("VALIDATING CONFIGURATION")
    print("=" * 80)

    is_valid, missing_vars = config.validate()

    if not is_valid:
        print("\nERROR: Missing required environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        print("\nPlease set all required environment variables before running.")
        return False

    print("✓ All required environment variables are set\n")
    return True


def filter_cards_by_date(cards: list[TrelloCard]) -> list[TrelloCard]:
    """
    Filter cards to only those with recording date exactly N days from today.

    Args:
        cards: List of TrelloCard objects

    Returns:
        Filtered list of cards
    """
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    target_date = today + timedelta(days=config.DAYS_BEFORE_RECORDING)

    print(f"Today: {today.date()}")
    print(f"Target recording date: {target_date.date()}")
    print(f"Looking for recordings exactly {config.DAYS_BEFORE_RECORDING} days from now\n")

    filtered_cards = []

    for card in cards:
        # Normalize recording date to start of day for comparison
        card_date = card.recording_date.replace(
            hour=0, minute=0, second=0, microsecond=0
        )

        if card_date == target_date:
            if card.is_processed():
                print(f"⊗ Skipping '{card.name}' - already processed")
            else:
                print(f"✓ Found match: '{card.name}' on {card.recording_date.date()}")
                filtered_cards.append(card)
        else:
            days_diff = (card_date - today).days
            print(f"  Skipping '{card.name}' - {days_diff} days away")

    return filtered_cards


def process_guest(
    card: TrelloCard,
    trello_client: TrelloClient,
    claude_client: ClaudeClient,
    doc_generator: DocGenerator,
    email_client: EmailClient,
) -> bool:
    """
    Process a single guest card: generate research, create doc, send email.

    Args:
        card: TrelloCard to process
        trello_client: Trello client instance
        claude_client: Claude client instance
        doc_generator: Document generator instance
        email_client: Email client instance

    Returns:
        True if successfully processed, False otherwise
    """
    print("\n" + "=" * 80)
    print(f"PROCESSING GUEST: {card.name}")
    print("=" * 80)
    print(f"Company: {card.company or 'Not specified'}")
    print(f"Title: {card.title or 'Not specified'}")
    print(f"Recording Date: {card.recording_date}")
    print()

    # Validate guest info
    if not card.company or not card.title:
        print("⚠ Warning: Missing company or title information")
        print("Attempting to proceed with available information...\n")

    # Use card name as guest name, fallback values for missing info
    guest_name = card.name
    company = card.company or "Company not specified"
    title = card.title or "Title not specified"

    # Step 1: Generate research via Claude (pass links/notes from card for better research)
    print("Step 1: Generating research via Claude API...")
    links_and_notes = getattr(card, "links_and_notes", "") or ""
    success, research_content = claude_client.generate_research(
        guest_name, company, title, links_and_notes=links_and_notes
    )

    if not success or not research_content:
        print("✗ Failed to generate research content")
        return False

    print("✓ Research generated successfully\n")

    # Step 2: Generate Word document
    print("Step 2: Generating Word document...")
    success, doc_path = doc_generator.generate_document(
        guest_name, company, title, research_content
    )

    if not success or not doc_path:
        print("✗ Failed to generate document")
        return False

    print(f"✓ Document generated: {doc_path}\n")

    # Step 3: Send email
    print("Step 3: Sending email with document...")
    success = email_client.send_research_document(guest_name, doc_path)

    if not success:
        print("✗ Failed to send email")
        # Don't mark as processed since email failed
        return False

    print("✓ Email sent successfully\n")

    # Step 4: Mark Trello card as processed
    print("Step 4: Marking card as processed...")
    success = trello_client.add_label_to_card(card.card_id)

    if not success:
        print("⚠ Warning: Failed to mark card as processed")
        print("Email was sent, but card should be manually marked as processed")

    print("✓ Card marked as processed\n")

    # Clean up document file
    try:
        Path(doc_path).unlink()
        print(f"✓ Cleaned up temporary file: {doc_path}\n")
    except Exception as e:
        print(f"⚠ Warning: Could not delete temporary file: {e}\n")

    print("=" * 80)
    print(f"✓ SUCCESSFULLY PROCESSED: {card.name}")
    print("=" * 80)

    return True


def main() -> int:
    """
    Main entry point for the automation.

    Returns:
        Exit code (0 = success, 1 = error)
    """
    print("\n" + "=" * 80)
    print("THE DIME PODCAST - AUTOMATED RESEARCH SYSTEM")
    print("=" * 80)
    print(f"Run time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n")

    # Validate configuration
    if not validate_configuration():
        return 1

    # Initialize clients
    print("Initializing clients...")
    trello_client = TrelloClient()
    claude_client = ClaudeClient()
    doc_generator = DocGenerator()
    email_client = EmailClient()
    print("✓ All clients initialized\n")

    # Fetch cards from Trello
    print("=" * 80)
    print("FETCHING CARDS FROM TRELLO")
    print("=" * 80)
    print(f"Board ID: {config.TRELLO_BOARD_ID}")
    print(f"Column: {config.TRELLO_PRE_COLUMN_NAME}\n")

    try:
        all_cards = trello_client.get_cards_from_pre_column()
        print(f"Found {len(all_cards)} total cards in '{config.TRELLO_PRE_COLUMN_NAME}' column\n")

        if not all_cards:
            print("No cards found. Exiting.")
            return 0

    except Exception as e:
        print(f"✗ Error fetching cards from Trello: {e}")
        return 1

    # Filter cards by date
    print("=" * 80)
    print("FILTERING CARDS BY DATE")
    print("=" * 80)
    cards_to_process = filter_cards_by_date(all_cards)

    if not cards_to_process:
        print(f"\nNo cards found with recording date exactly {config.DAYS_BEFORE_RECORDING} days from today.")
        print("Exiting.")
        return 0

    print(f"\n{len(cards_to_process)} card(s) to process\n")

    # Process each card
    successful = 0
    failed = 0

    for i, card in enumerate(cards_to_process, 1):
        print(f"\n[{i}/{len(cards_to_process)}] Processing: {card.name}")

        try:
            success = process_guest(
                card, trello_client, claude_client, doc_generator, email_client
            )

            if success:
                successful += 1
            else:
                failed += 1

        except Exception as e:
            print(f"✗ Unexpected error processing card: {e}")
            failed += 1
            # Continue to next card

    # Summary
    print("\n" + "=" * 80)
    print("EXECUTION SUMMARY")
    print("=" * 80)
    print(f"Total cards processed: {len(cards_to_process)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print("=" * 80 + "\n")

    # Return exit code
    if failed > 0:
        print("⚠ Some cards failed to process. Check logs above.")
        return 1
    else:
        print("✓ All cards processed successfully!")
        return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

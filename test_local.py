"""
Local testing script to validate configuration and connections.
Run this before deploying to GitHub Actions.
"""

import sys
from config import config
from trello_client import TrelloClient
from claude_client import ClaudeClient
from email_client import EmailClient


def test_configuration():
    """Test configuration validity."""
    print("=" * 80)
    print("TESTING CONFIGURATION")
    print("=" * 80)

    is_valid, missing = config.validate()

    if not is_valid:
        print("✗ Missing required environment variables:")
        for var in missing:
            print(f"  - {var}")
        return False

    print("✓ All required environment variables are set")
    return True


def test_trello_connection():
    """Test Trello API connection."""
    print("\n" + "=" * 80)
    print("TESTING TRELLO CONNECTION")
    print("=" * 80)

    try:
        client = TrelloClient()

        # Test getting board lists
        list_id = client.get_pre_column_id()

        if not list_id:
            print("✗ Could not find 'Pre' column")
            return False

        print(f"✓ Found 'Pre' column (ID: {list_id})")

        # Test getting cards
        cards = client.get_cards_from_pre_column()
        print(f"✓ Successfully fetched {len(cards)} cards from 'Pre' column")

        if cards:
            print("\nCards found:")
            for i, card in enumerate(cards, 1):
                print(f"  {i}. {card.name}")
                print(f"     Company: {card.company or 'Not specified'}")
                print(f"     Title: {card.title or 'Not specified'}")
                print(f"     Recording Date: {card.recording_date}")
                print(f"     Processed: {card.is_processed()}")

        return True

    except Exception as e:
        print(f"✗ Error connecting to Trello: {e}")
        return False


def test_claude_connection():
    """Test Claude API connection."""
    print("\n" + "=" * 80)
    print("TESTING CLAUDE API CONNECTION")
    print("=" * 80)

    try:
        client = ClaudeClient()

        if not client.validate_api_key():
            print("✗ Invalid Claude API key")
            return False

        print("✓ Claude API key is valid")
        print(f"✓ Using model: {client.model}")
        return True

    except Exception as e:
        print(f"✗ Error connecting to Claude: {e}")
        return False


def test_email_connection():
    """Test SMTP connection."""
    print("\n" + "=" * 80)
    print("TESTING EMAIL CONNECTION")
    print("=" * 80)

    try:
        client = EmailClient()

        if not client.validate_smtp_connection():
            print("✗ SMTP connection failed")
            return False

        print("✓ SMTP connection successful")
        print(f"✓ Will send emails to: {client.to_email}")
        return True

    except Exception as e:
        print(f"✗ Error testing email: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 80)
    print("THE DIME PODCAST - LOCAL TESTING SCRIPT")
    print("=" * 80)
    print("This script validates your configuration and API connections.\n")

    results = {
        "Configuration": test_configuration(),
        "Trello": False,
        "Claude": False,
        "Email": False,
    }

    # Only test connections if configuration is valid
    if results["Configuration"]:
        results["Trello"] = test_trello_connection()
        results["Claude"] = test_claude_connection()
        results["Email"] = test_email_connection()

    # Summary
    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{test_name:20} {status}")

    print("=" * 80)

    all_passed = all(results.values())

    if all_passed:
        print("\n✓ All tests passed! Ready to deploy to GitHub Actions.")
        return 0
    else:
        print("\n✗ Some tests failed. Fix issues before deploying.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

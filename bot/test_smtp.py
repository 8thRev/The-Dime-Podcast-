#!/usr/bin/env python3
"""
Standalone SMTP credential check. Run this locally to find out exactly why
Google is rejecting the mail credential, without deploying anything and
without the password leaving your machine.

    python bot/test_smtp.py

Reads the same EMAIL_* variables bot/config.py uses, from the environment or
from a .env file next to it. Prints the shape of what it found and Google's
verbatim response. It never prints the password.

Add --send to actually deliver a test message once auth succeeds.
"""

import os
import smtplib
import ssl
import sys
from email.mime.text import MIMEText
from pathlib import Path


def load_dotenv() -> None:
    """Minimal .env reader so this works without extra dependencies."""
    for candidate in (Path(__file__).parent / ".env", Path.cwd() / ".env", Path.cwd() / ".env.local"):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        print(f"Loaded {candidate}")
        return


def describe(name: str, value: str, secret: bool = False) -> None:
    if not value:
        print(f"  {name:<16} NOT SET")
        return
    notes = [f"len={len(value)}"]
    if value != value.strip():
        notes.append("HAS LEADING/TRAILING WHITESPACE")
    if " " in value.strip():
        notes.append("CONTAINS SPACES")
    if value.strip().upper() in {"[SENSITIVE]", "ENCRYPTED", "HIDDEN"}:
        notes.append("!! THIS IS A PLACEHOLDER, NOT A REAL VALUE !!")
    shown = "(hidden)" if secret else value
    print(f"  {name:<16} {shown}  [{', '.join(notes)}]")


def main() -> int:
    load_dotenv()

    host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    port = int(os.getenv("EMAIL_PORT", "587"))
    username = os.getenv("EMAIL_USERNAME", "")
    password = os.getenv("EMAIL_PASSWORD", "")
    sender = os.getenv("EMAIL_FROM", "")
    recipient = os.getenv("EMAIL_TO", "") or username

    print("\nWhat was found:")
    describe("EMAIL_HOST", host)
    describe("EMAIL_PORT", str(port))
    describe("EMAIL_USERNAME", username)
    describe("EMAIL_PASSWORD", password, secret=True)
    describe("EMAIL_FROM", sender)

    problems = []
    if "@" not in username:
        problems.append("EMAIL_USERNAME is not a full email address. Google needs you@domain.com.")
    if password and " " in password:
        problems.append("EMAIL_PASSWORD contains spaces. An App Password is displayed in four groups of four, but must be entered as 16 characters with the spaces removed.")
    if password and len(password) != 16:
        problems.append(f"EMAIL_PASSWORD is {len(password)} characters. A Google App Password is exactly 16.")
    if password.strip().upper() == "[SENSITIVE]":
        problems.append("EMAIL_PASSWORD is the literal string [SENSITIVE], which is the placeholder `vercel env pull` writes for values it will not reveal. The real password was never copied.")

    if problems:
        print("\nBefore even trying to connect:")
        for p in problems:
            print(f"  - {p}")

    if not username or not password:
        print("\nCannot test: username or password missing.")
        return 1

    print(f"\nConnecting to {host}:{port} ...")
    try:
        with smtplib.SMTP(host, port, timeout=30) as server:
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            print("TLS established. Authenticating ...")
            server.login(username, password)
            print("\n*** AUTH OK. The credential is valid. ***")

            if "--send" in sys.argv:
                msg = MIMEText("SMTP credential test from bot/test_smtp.py. If you are reading this, sending works.")
                msg["Subject"] = "SMTP test"
                msg["From"] = sender or username
                msg["To"] = recipient
                server.send_message(msg)
                print(f"Test message sent to {recipient}.")
                print("If it never arrives, the problem is delivery or the recipient mailbox, not auth.")
            else:
                print("Re-run with --send to deliver a test message.")
        return 0

    except smtplib.SMTPAuthenticationError as e:
        print(f"\n*** AUTH FAILED: {e.smtp_code} ***")
        print(e.smtp_error.decode(errors="replace") if isinstance(e.smtp_error, bytes) else e.smtp_error)
        print("\n535 / BadCredentials usually means one of:")
        print("  1. The value is the account password, not an App Password.")
        print("  2. The App Password was pasted with its display spaces still in it.")
        print("  3. 2-Step Verification is off on that account, so App Passwords do not exist.")
        print("  4. The App Password was revoked.")
        print("  5. A Workspace admin has disabled SMTP AUTH for the organisation.")
        print("     Admin console: Apps > Google Workspace > Gmail > End User Access.")
        return 1

    except smtplib.SMTPSenderRefused as e:
        print(f"\n*** SENDER REFUSED: {e.smtp_code} ***")
        print(e.smtp_error.decode(errors="replace") if isinstance(e.smtp_error, bytes) else e.smtp_error)
        print("\nAuth worked. The account is not allowed to send as EMAIL_FROM.")
        print("Either set EMAIL_FROM to the account's own address, or add the address")
        print("under Gmail > Settings > Accounts > Send mail as.")
        return 1

    except Exception as e:
        print(f"\n*** CONNECTION FAILED: {type(e).__name__}: {e} ***")
        print("Auth was never attempted. Check EMAIL_HOST, EMAIL_PORT, and outbound network access.")
        return 1


if __name__ == "__main__":
    sys.exit(main())

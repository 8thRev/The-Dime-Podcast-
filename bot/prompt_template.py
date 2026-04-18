"""
Research prompt template for Claude AI.
Based on The Dime Podcast research specifications.
"""


def get_research_prompt(
    guest_name: str, company: str, title: str, links_and_notes: str = ""
) -> str:
    """
    Generate the complete research prompt for Claude.

    Args:
        guest_name: Name of the guest
        company: Guest's company
        title: Guest's job title
        links_and_notes: Optional links and notes from Trello (LinkedIn, company site, etc.) for Claude to use.

    Returns:
        Formatted research prompt
    """
    links_section = ""
    if links_and_notes and links_and_notes.strip():
        links_section = f"""
Links and notes from the team (use these to inform your research; prioritize these sources when relevant):
---
{links_and_notes.strip()}
---
"""

    return f"""The Dime Podcast: Research Prompt

Objective: Research the guest deeply and produce detailed information listed cleanly in sections to find unique information and correlation that demonstrates a thorough understanding of the guest, their role, their background and thought process.

Guest Information:
- Name: {guest_name}
- Title: {title}
- Company: {company}
{links_section}
Research Requirements:
Analyze the following before writing anything:
• Company positioning, ICP, and revenue model
• Public content from the guest including podcasts, panels, LinkedIn posts, essays, tweets
• Repeated opinions, frameworks, or beliefs they consistently reference
• Contrarian takes or points of tension with industry norms
• What they are known for versus what they likely believe but say less often
• Where their incentives, experience, and worldview intersect

Provide References listed and linked to the sources.

Do not summarize generically. Extract patterns and sharp edges.

Then answer the following questions.

Opening Questions:
We want to lightly challenge the guest with a tension question with an opening questions that immediately accelerate into a substantive discussion. For each opener, provide:
• One fast follow-up question that sharpens the claim
• One directional pivot that moves from opinion into strategy or execution

Examples:
- Most teams believe X because it feels safe. You chose Y. What did that unlock that they are missing?
- People say Z drives outcomes. In your experience what actually moves the needle and why does no one want to admit it?
- If you removed one widely accepted best practice tomorrow what would improve results immediately?
- Here are two commonly held beliefs (based on his background and experience) one has to go. Which?

Section 1: Post 5 to 7 concise bullets describing in Section 1 Research:
• What this person actually believes about their domain
• What they think most people misunderstand
• Where they disagree with common industry behavior

Then list a title and 3 questions that fit for Section 1 in the output page.

Section 2: Natural expansion of concepts, background, and role in the space.

SEO:
Now imagine this episode went viral among cannabis operators and adjacent CPG executives. Identify the topics, concepts, and keywords that drove outsized discovery and sharing. Cannabis is a niche category, so show how this episode both dominates the niche (cannabis operators, MSOs, brands) and breaks out to broader audiences (CPG, alcohol, tobacco, investors, AI/tech leaders). Prioritize terms and angles that signal high intent from executives and operators looking for solutions, not just information.

Background on The Dime Podcast:
Weekly deep-dive conversations with CEOs of leading cannabis companies, world-class scientists, and influential legacy operators shaping the $100+ billion cannabis market. Bryan and Kellan unpack how guests built and scaled their businesses, navigated failures, and found sustainable success in a rapidly evolving industry. Tone is operator-centric and practical, with guests pushed to share specific tactics, mistakes, and frameworks rather than high-level narratives.

Trend and framework episodes cover industry forecasts, scalable operating playbooks, standardized systems, and data-driven decision-making for the next wave of winners. Operator-focused breakdowns of market structure, including state-by-state dynamics, regulatory shifts, capital access, M&A, and strategies for multi-state expansion and going public.

Output Document Style:
Guest Name | Title | Company

Opening Questions:
(5 of them listed)

(Section 1, title)
(Section 2, title)

---------------------------------------------------------------------------------------

Section 1: Research
(5-7 bullets)

Section 2: Research
(Natural expansion)

Background:
(Key background points)

Contrarian Held Beliefs:
(Specific contrarian positions)

SEO:
(Keywords and topics for viral discovery)

Please provide comprehensive, specific research with actual references and links where possible. Be concrete and actionable, not generic."""

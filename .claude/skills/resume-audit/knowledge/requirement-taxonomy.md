# Requirement Taxonomy

## Severity Classification

### Hard (Must-Have)
Indicators in JD text:
- "Required", "must have", "minimum X years"
- Listed under "Requirements" or "Qualifications" sections
- Core technology of the role (e.g., "TypeScript" for a TS-heavy team)
- Degree requirements or years of experience

### Soft (Expected)
Indicators:
- Implied by the role but not explicitly stated
- Listed under "Responsibilities" (doing the work implies having the skill)
- Industry-standard for the level (e.g., git proficiency for any SWE role)
- Communication, collaboration, mentoring at senior levels

### Preferred (Nice-to-Have)
Indicators:
- "Nice to have", "bonus", "preferred", "ideally"
- Listed under separate "Preferred" or "Bonus" section
- Emerging technologies or future-facing skills
- Specific tool variants (e.g., "experience with Datadog" when any APM tool applies)

## Category Classification

### Technical
- Programming languages, frameworks, tools
- System design patterns, architecture styles
- Infrastructure, deployment, CI/CD

### Domain
- Industry knowledge (fintech, healthtech, etc.)
- Business process understanding
- Regulatory/compliance knowledge

### Cultural
- Work style (async communication, pair programming)
- Values alignment (safety, open source, user focus)
- Team dynamics (cross-functional, mentoring)

## Compound Requirement Splitting

When a single bullet contains multiple requirements:
- "5+ years of TypeScript and React" → R_n: 5+ years TypeScript, R_n+1: 5+ years React
- "Experience building and maintaining CI/CD pipelines" → single requirement (building AND maintaining are both part of CI/CD)
- "Strong communication skills and ability to mentor junior engineers" → R_n: communication, R_n+1: mentoring

Rule: split when skills are independently assessable. Don't split when they describe facets of the same competency.

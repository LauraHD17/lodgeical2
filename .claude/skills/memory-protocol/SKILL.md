---
name: memory-protocol
description: Always-on global memory protocol. Teaches Claude to actively recall, reference, and build on context across all conversations — including user identity, projects, preferences, past decisions, entities, and working style. Always enabled.
user-invocable: true
---

# Memory Protocol

You have access to a persistent memory system. Follow these rules in every conversation, always.

---

## 1. Memory File Location

The user maintains a global memory file at:
```
~/.claude/memory.md
```

At the start of every conversation, if the user shares this file or its contents, treat it as ground truth about who they are, what they're working on, and how they like to work. Reference it actively — don't just passively absorb it.

In Claude Code, this file is automatically loaded if referenced in CLAUDE.md.

---

## 2. What to Remember

Track and recall across six memory categories:

### 👤 Identity & Preferences
- Name, location, profession, role
- Communication style preferences (direct, detailed, casual, formal)
- Response format preferences (bullets vs prose, short vs long)
- Tools, stack, and environment they use regularly
- Things they dislike or want Claude to avoid

### 🏗️ Projects & Context
- Active projects: name, purpose, current status, key goals
- Tech stack per project
- Architecture decisions already made
- What phase each project is in (research, design, build, ship, maintain)
- Project-specific constraints (deadlines, budget, team size)

### 🧠 Past Decisions & Rationale
- Technical decisions made and why
- Design decisions made and why
- Things tried that didn't work (and why)
- Directions deliberately ruled out
- Open questions not yet resolved

### 🤝 People & Entities
- Collaborators, clients, teammates
- Tools, services, vendors in use
- Organizations or companies involved
- Key relationships and context around them

### 📋 Working Style & Norms
- Preferred workflow patterns
- How they like to receive feedback
- Level of detail they want in explanations
- Whether they want Claude to ask clarifying questions or make assumptions
- Tone preferences per context (technical vs creative vs strategic)

### 🔁 Ongoing Threads
- Tasks in progress
- Decisions pending
- Things to follow up on
- Open loops from previous conversations

---

## 3. How to Use Memory in Conversation

**At the start of a session:**
- If a memory file is provided, read it fully before responding to anything.
- Greet by name if known.
- If context about the current project is available, briefly acknowledge it so the user knows you're oriented.

**During a conversation:**
- Reference memory actively: *"Based on your previous decision to use PostgreSQL..."* or *"Given that you're in the build phase of Lodgeical..."*
- When the user mentions something new that contradicts memory, flag it: *"This is different from what I have — should I update my understanding?"*
- When a significant new decision is made, flag it: *"Worth adding to your memory file: you've decided to use X because Y."*
- Don't ask questions you should already know the answer to from memory.

**At the end of a session (when asked to recap or when ending):**
- Offer a "Memory Update" summary: a short list of new facts, decisions, or context from this conversation that should be added to the memory file.
- Format it so the user can copy it directly into `~/.claude/memory.md`.

---

## 4. Memory File Format

When helping the user create or update their memory file, use this structure:

```markdown
# Claude Memory File
Last updated: [date]

## Identity & Preferences
- Name: 
- Location: 
- Role/Profession: 
- Communication style: 
- Response format preference: 
- Preferred stack/tools: 
- Things to avoid: 

## Active Projects
### [Project Name]
- Purpose: 
- Stack: 
- Current phase: 
- Key goals: 
- Constraints: 
- Last status: 

## Past Decisions
- [Decision]: [Rationale] — [Date]

## People & Entities
- [Name/Tool/Org]: [Context]

## Working Style
- [Preference or norm]

## Open Threads
- [ ] [Task or question still pending]
```

---

## 5. Memory Hygiene Rules

- **Never hallucinate memory.** If you don't know something, say so — don't invent plausible-sounding facts about the user.
- **Flag conflicts.** If something in the conversation contradicts the memory file, surface it.
- **Respect recency.** What the user says in the current conversation takes precedence over older memory file entries.
- **Be concise with memory references.** Don't recite the whole memory file back — reference only what's relevant to the current task.
- **Prompt updates proactively.** When a conversation produces new meaningful context, remind the user to update their memory file. Don't wait to be asked.
# Memory System Usage Instructions

## For Claude Code: How to Use This Memory System

### At the Start of EVERY Session

**ALWAYS read these files in this order:**

1. **`.claude/project-context.md`** (REQUIRED)
   - Quick project overview
   - Current state and active issues
   - Recent changes
   - Critical patterns

2. **`.claude/session-log.md`** (RECOMMENDED)
   - Detailed session history
   - Recent development activities
   - Issue resolutions

3. **`/memory.md`** (AS NEEDED)
   - Comprehensive feature documentation
   - Website architecture details
   - Scroll animation configurations

4. **`/PRD.md`** (AS NEEDED)
   - Full product requirements
   - Feature specifications
   - Database schemas

### After EVERY Significant Change

**ALWAYS update:**

1. **`.claude/project-context.md`**
   - Add entry to "Session History" section
   - Update "Active Issues & Priorities" if resolved
   - Update "Last Updated" timestamp

2. **`.claude/session-log.md`**
   - Add detailed session entry with:
     - User request
     - Actions taken
     - Files modified
     - Reasoning
     - Status

### What Counts as "Significant Change"

Update memory after:
- ✅ Any code modification (bug fix, feature add, refactor)
- ✅ Resolving an issue or bug
- ✅ Creating new files or major refactors
- ✅ User provides new requirements
- ✅ Discovering important patterns or conventions
- ✅ Making git commits

Do NOT update for:
- ❌ Just reading files
- ❌ Answering questions without changes
- ❌ Explaining existing code

---

## Update Protocol Details

### Updating project-context.md

**Location to update:** `.claude/project-context.md`

**Sections to update:**

1. **Last Updated timestamp** (always)
   ```markdown
   **Last Updated:** 2025-11-21
   ```

2. **Session History** (add new entry)
   ```markdown
   ### 2025-11-21 - [Brief Title]
   **Changes:**
   - Created X
   - Modified Y
   - Fixed Z

   **Context:**
   User requested [what and why]

   **Files Modified:**
   - `path/to/file.ts` (created/modified/deleted)
   ```

3. **Active Issues** (update if resolved or new ones found)
   ```markdown
   ### Current Focus
   [What you're working on right now]

   ### Known Issues
   1. ✅ ~~Issue 1~~ - Resolved in session YYYY-MM-DD
   2. 🔧 Issue 2 - In progress
   3. ❌ Issue 3 - New issue discovered
   ```

4. **Recent Git History** (if commits made)
   ```markdown
   ## Recent Git History

   ```
   abc1234 - Your new commit message
   5407e81 - Add conditional house characteristics filtering
   e878c93 - Add enhanced search panel and new CRM features
   ```
   ```

5. **Critical Patterns** (if new patterns discovered)
   Add to the relevant section if you discover important conventions

### Updating session-log.md

**Location to update:** `.claude/session-log.md`

**Add new session using the template:**

```markdown
## 2025-11-21

### Session: [Brief Title]

**Time:** November 21, 2025

**User Request:**
> "[Quote exact user request]"

**Actions Taken:**
1. Read project-context.md
2. [Action 2]
3. [Action 3]

**Code Changes:**
- `file/path.ts` - [What changed and why]

**Reasoning:**
[Why you made these decisions]

**Testing:**
- [x] Build successful
- [x] Dev server tested
- [ ] Feature tested manually

**Status:** ✅ Complete

**Next Steps:**
- [What should happen next]
```

---

## Memory System Architecture

```
.claude/
├── project-context.md       ← Quick reference (READ FIRST)
├── session-log.md           ← Detailed history (UPDATE AFTER CHANGES)
├── memory-instructions.md   ← This file (how-to guide)
└── settings.local.json      ← Claude Code settings

memory.md                    ← Comprehensive docs (website + CRM)
PRD.md                       ← Product requirements
IMPLEMENTATION_AUDIT.md      ← CRM completion status
```

**File Purposes:**

- **project-context.md**:
  - Quick reference for starting sessions
  - ~200 lines, easy to scan
  - Contains: current state, active issues, recent changes, critical patterns

- **session-log.md**:
  - Chronological detailed history
  - Complete record of all development sessions
  - Use template for consistency

- **memory.md**:
  - Comprehensive feature documentation
  - Website architecture (scroll animations, sections)
  - Historical context and design decisions

- **memory-instructions.md**:
  - This file
  - How-to guide for maintaining the system

- **PRD.md**:
  - Product requirements document
  - Feature specifications
  - Database schemas
  - Integration points

---

## Example Workflow

### Starting a Session

1. User asks: "Fix the carousel rotation issue"

2. You read: `.claude/project-context.md`
   - See issue listed under "Known Issues"
   - Check "Critical Patterns & Conventions" for carousel details
   - Check "Important File Locations" for relevant files

3. You read: `.claude/session-log.md` (if needed)
   - Check if there's recent context about carousel

4. You read: `/memory.md` (if needed)
   - Find section "🎠 PERFECT CAROUSEL CONFIGURATION"
   - Understand the carousel implementation

5. You work on the fix...

### After Completing Work

1. Update `.claude/project-context.md`:
   ```markdown
   ### 2025-11-21 - Fixed Carousel Rotation
   **Changes:**
   - Fixed perpetual rotation in EstateAgentHome.tsx
   - Restored requestAnimationFrame loop

   **Context:**
   Carousel stopped rotating after previous refactor

   **Files Modified:**
   - `client/src/pages/EstateAgentHome.tsx` (line 234-267)
   ```

2. Update `.claude/session-log.md`:
   ```markdown
   ## 2025-11-21

   ### Session: Fix Carousel Rotation

   **User Request:**
   > "Fix the carousel rotation issue"

   **Actions Taken:**
   1. Read project-context.md and identified issue
   2. Located carousel code in EstateAgentHome.tsx
   3. Restored perpetual rotation logic

   **Code Changes:**
   - `client/src/pages/EstateAgentHome.tsx` - Restored requestAnimationFrame loop for perpetual rotation

   **Status:** ✅ Complete
   ```

3. Mark issue as resolved in project-context.md:
   ```markdown
   ### Known Issues
   1. Navigation display - right-side nav only shows labels on hover
   2. ✅ ~~Carousel rotation - not rotating perpetually~~ - Fixed 2025-11-21
   3. Carousel controls - left/right hover controls not working
   ```

---

## Tips for Effective Memory Maintenance

### Keep It Concise
- project-context.md should stay under 500 lines
- Use bullet points, not paragraphs
- Link to detailed docs instead of duplicating

### Be Consistent
- Always use the same format for dates: YYYY-MM-DD
- Use status indicators: ✅ ❌ 🔧 🔄
- Use markdown headers consistently

### Prioritize Recent Context
- Most recent 5-10 sessions in project-context.md
- Older history can be in session-log.md only
- Move completed work to "Historical" section if needed

### Cross-Reference
- Link between files when relevant
- Mention related issues
- Note dependencies between changes

### Think About Future You
- Write clear "why" explanations
- Note non-obvious decisions
- Document gotchas and pitfalls
- Include error messages if relevant

---

## Checklist for Every Session

**At Start:**
- [ ] Read `.claude/project-context.md`
- [ ] Check "Active Issues & Priorities"
- [ ] Review "Recent Git History"
- [ ] Check "Critical Patterns" if relevant

**During Work:**
- [ ] Take notes of changes made
- [ ] Note files modified
- [ ] Document reasoning for decisions

**Before Completing:**
- [ ] Test changes (build, run, verify)
- [ ] Update `.claude/project-context.md`
- [ ] Update `.claude/session-log.md`
- [ ] Update issue status if resolved
- [ ] Note next steps if incomplete

**After Git Commit:**
- [ ] Add commit hash to session log
- [ ] Update git history in project-context.md

---

## Questions?

This memory system is designed to:
1. Give you quick context at session start
2. Track all changes systematically
3. Make project history searchable
4. Reduce repeated questions
5. Improve continuity between sessions

If something is unclear or could be improved, update this file!

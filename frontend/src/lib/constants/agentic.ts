import type { AgenticConfig } from '$lib/types/agentic';

export const ATTACHMENT_SAVED_REGEX = /\[Attachment saved: ([^\]]+)\]/;

// JSON detection: trimmed content opens with an object or array literal.
export const TOOL_RESULT_JSON_OPEN_REGEX = /^[[{]/;

// Markdown structural markers used by `looksLikeMarkdown`. Inline / line-level.
export const MARKDOWN_CODE_FENCE_REGEX = /^(```|~~~)/m;
export const MARKDOWN_ATX_HEADING_REGEX = /^#{1,6}\s+\S/;
export const MARKDOWN_BLOCKQUOTE_REGEX = /^>\s+\S/;
export const MARKDOWN_LIST_BULLET_REGEX = /^\s*[-*+]\s+\S/;
export const MARKDOWN_LIST_NUMBERED_REGEX = /^\s*\d+[.)]\s+\S/;
export const MARKDOWN_LINK_REGEX = /\[[^\]\n]+\]\([^)\s]+\)/;
export const MARKDOWN_BOLD_REGEX = /\*\*[^*\n]+\*\*|__[^_\n]+__/;
export const MARKDOWN_TABLE_SEPARATOR_REGEX = /^\s*\|?[\s:|-]+\|?\s*$/;

// Search-summary wire format used by file-glob and grep tools:
//   <matches>
//   ---
//   Total matches: N
export const SEARCH_SUMMARY_SEPARATOR = '---\n';
export const SEARCH_SUMMARY_TOTAL_REGEX = /Total matches:\s*(\d+)/;

// Separator rendered between stats in the tool-result footer (e.g. between a
// result message and the byte/edit count). Plain ASCII spaces bracket a hyphen
// so the whole " - " sits on one visual line even when the surrounding text
// wraps mid-paragraph.
export const RESULT_STAT_SEPARATOR = ' - ';

export const DEFAULT_AGENTIC_CONFIG: AgenticConfig = {
  enabled: true,
  maxTurns: 100
} as const;

export const REASONING_TAGS = {
  START: '<think>',
  END: '</think>'
} as const;

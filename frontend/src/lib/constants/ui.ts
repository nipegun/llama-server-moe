import { fTranslate } from '../i18n';
import { Search, Settings, SquarePen } from '@lucide/svelte';
import McpLogo from '$lib/components/app/mcp/McpLogo.svelte';
import type { Component } from 'svelte';
import { ROUTES } from './routes';

export const FORK_TREE_DEPTH_PADDING = 8;
export const SYSTEM_MESSAGE_PLACEHOLDER = fTranslate('text_e066e37463a8');

export const ICON_STRIP_TRANSITION_DURATION = 150;
export const ICON_STRIP_TRANSITION_DELAY_MULTIPLIER = 50;

/** Max height for tool-result code blocks (json / source / diff / streaming code). */
export const MAX_HEIGHT_CODE_BLOCK = '22rem';

export interface DesktopIconStripItem {
  icon: Component;
  tooltip: string;
  route?: string;
  activeRouteId?: string;
  activeRoutePrefix?: string;
  activeUrlIncludes?: string;
  keys?: string[];
}

export const SIDEBAR_ACTIONS_ITEMS: DesktopIconStripItem[] = [
  {
    icon: SquarePen,
    tooltip: fTranslate('text_db18382a249e'),
    route: ROUTES.NEW_CHAT,
    keys: ['shift', 'cmd', 'o']
  },
  { icon: Search, tooltip: fTranslate('text_49c266baaaa7'), keys: ['cmd', 'k'] },
  {
    icon: McpLogo,
    tooltip: fTranslate('text_aab669a72882'),
    route: ROUTES.MCP_SERVERS,
    activeRouteId: '/mcp-servers'
  },
  {
    icon: Settings,
    tooltip: fTranslate('text_74a883a037bc'),
    route: `${ROUTES.SETTINGS}/general`,
    activeUrlIncludes: '#/settings'
  }
];

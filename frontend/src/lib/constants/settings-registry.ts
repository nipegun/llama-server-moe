import { fTranslate } from '../i18n';
import { ColorMode } from '$lib/enums/ui.enums';
import { SettingsFieldType } from '$lib/enums/settings.enums';
import { SyncableParameterType } from '$lib/enums';
import {
  Funnel,
  AlertTriangle,
  Code,
  Monitor,
  ListRestart,
  Sliders,
  PencilRuler,
  Database,
  Monitor as MonitorIcon,
  Sun,
  Moon
} from '@lucide/svelte';
import type { Component } from 'svelte';
import type {
  SettingsConfigValue,
  SyncableParameter,
  SettingsEntry,
  SettingsSectionTitle,
  SettingsSectionEntry,
  SettingsSection
} from '$lib/types';
import { CLI_FLAGS, DEFAULT_MCP_CONFIG } from '$lib/constants';
import { SETTINGS_KEYS } from './settings-keys';
import { ROUTES, SETTINGS_SECTION_SLUGS } from './routes';
import { TITLE_GENERATION } from './title-generation';

export const SETTINGS_SECTION_TITLES = {
  GENERAL: fTranslate('text_c910d474dcd7'),
  DISPLAY: fTranslate('text_34e108c0896d'),
  SAMPLING: fTranslate('text_e41f08d35dd1'),
  PENALTIES: fTranslate('text_444206375e2a'),
  AGENTIC: fTranslate('text_7b1f65c25801'),
  TOOLS: fTranslate('text_ea93d6a262ec'),
  IMPORT_EXPORT: fTranslate('text_42191ef46da3'),
  DEVELOPER: fTranslate('text_3fb7b39416f1')
} as const;

const STANDALONE_SECTIONS: { title: SettingsSectionTitle; slug: string; icon: Component }[] = [
  { title: SETTINGS_SECTION_TITLES.TOOLS, slug: SETTINGS_SECTION_SLUGS.TOOLS, icon: PencilRuler },
  {
    title: SETTINGS_SECTION_TITLES.IMPORT_EXPORT,
    slug: SETTINGS_SECTION_SLUGS.IMPORT_EXPORT,
    icon: Database
  }
];

const COLOR_MODE_OPTIONS: Array<{ value: string; label: string; icon: Component }> = [
  { value: ColorMode.SYSTEM, label: fTranslate('text_6725e7bbcd28'), icon: MonitorIcon },
  { value: ColorMode.LIGHT, label: fTranslate('text_dbcd5e7bb7a0'), icon: Sun },
  { value: ColorMode.DARK, label: fTranslate('text_60acc53f13a5'), icon: Moon }
];

// Shared options for the title-generation radio group. Both paired registry entries
// (USE_FIRST_LINE, USE_LLM) reference this list so labels stay in lockstep.
const TITLE_GENERATION_RADIO_OPTIONS: Array<{
  value: string;
  label: string;
  key: string;
  isExperimental?: boolean;
}> = [
  {
    value: 'firstLine',
    label: fTranslate('text_d260b3167eca'),
    key: SETTINGS_KEYS.TITLE_GENERATION_USE_FIRST_LINE
  },
  {
    value: 'llm',
    label: fTranslate('text_979477c8d433'),
    key: SETTINGS_KEYS.TITLE_GENERATION_USE_LLM,
    isExperimental: true
  }
];

// Common shape for the conversation title radio entry.
const TITLE_GENERATION_BASE = {
  type: SettingsFieldType.RADIO,
  section: SETTINGS_SECTION_SLUGS.GENERAL,
  radioOptions: TITLE_GENERATION_RADIO_OPTIONS
} as const;

const SETTINGS_REGISTRY: Record<string, SettingsSectionEntry> = {
  [SETTINGS_SECTION_SLUGS.GENERAL]: {
    title: SETTINGS_SECTION_TITLES.GENERAL,
    slug: SETTINGS_SECTION_SLUGS.GENERAL,
    icon: Sliders,
    settings: [
      {
        key: SETTINGS_KEYS.THEME,
        label: fTranslate('text_efb52e7172b7'),
        help: fTranslate('text_d8c2701b0dce'),
        defaultValue: ColorMode.SYSTEM,
        type: SettingsFieldType.SELECT,
        section: SETTINGS_SECTION_SLUGS.GENERAL,
        options: COLOR_MODE_OPTIONS
      },
      {
        key: SETTINGS_KEYS.API_KEY,
        label: fTranslate('text_23189d55f697'),
        help: fTranslate('text_590ca5f81094', { p0: CLI_FLAGS.API_KEY }),
        defaultValue: '',
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      },
      {
        key: SETTINGS_KEYS.SYSTEM_MESSAGE,
        label: fTranslate('text_8e5a3143184d'),
        help: fTranslate('text_fbd01c02e202'),
        defaultValue: '',
        type: SettingsFieldType.TEXTAREA,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      },
      {
        key: SETTINGS_KEYS.PASTE_LONG_TEXT_TO_FILE_LEN,
        label: fTranslate('text_401b499e8e8f'),
        help: fTranslate('text_d50c4251977a'),
        defaultValue: 2500,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      },
      {
        key: SETTINGS_KEYS.SEND_ON_ENTER,
        label: fTranslate('text_7240e16f8c6b'),
        help: fTranslate('text_819c91d143be'),
        defaultValue: true,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      },
      {
        key: SETTINGS_KEYS.AUTO_MIC_ON_EMPTY,
        label: fTranslate('text_8666460b20dc'),
        help: fTranslate('text_569a6b44e53d'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.GENERAL,
        isExperimental: true
      },
      {
        key: SETTINGS_KEYS.ENABLE_CONTINUE_GENERATION,
        label: fTranslate('text_086d634416fb'),
        help: fTranslate('text_c25279367499'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.GENERAL,
        isExperimental: true
      },
      {
        ...TITLE_GENERATION_BASE,
        key: SETTINGS_KEYS.TITLE_GENERATION_USE_FIRST_LINE,
        label: fTranslate('text_5b5cd3e853ae'),
        help: fTranslate('text_2798ae6854ed'),
        defaultValue: true
      },
      {
        key: SETTINGS_KEYS.TITLE_GENERATION_PROMPT,
        label: fTranslate('text_20e4c1fbfbc0'),
        help: fTranslate('text_d737cb824eb4'),
        defaultValue: TITLE_GENERATION.DEFAULT_PROMPT,
        type: SettingsFieldType.TEXTAREA,
        section: SETTINGS_SECTION_SLUGS.GENERAL,
        dependsOn: SETTINGS_KEYS.TITLE_GENERATION_USE_LLM
      },
      {
        key: SETTINGS_KEYS.COPY_TEXT_ATTACHMENTS_AS_PLAIN_TEXT,
        label: fTranslate('text_ba488dcfbd3e'),
        help: fTranslate('text_bac76e8ab9fb'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      },
      {
        key: SETTINGS_KEYS.PDF_AS_IMAGE,
        label: fTranslate('text_9ec72f537886'),
        help: fTranslate('text_96fe65afdb37'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      },
      {
        key: SETTINGS_KEYS.MAX_IMAGE_RESOLUTION,
        label: fTranslate('text_2954877fdbea'),
        help: fTranslate('text_a9e27241ec14'),
        defaultValue: 0,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.GENERAL
      }
    ]
  },
  [SETTINGS_SECTION_SLUGS.DISPLAY]: {
    title: SETTINGS_SECTION_TITLES.DISPLAY,
    slug: SETTINGS_SECTION_SLUGS.DISPLAY,
    icon: Monitor,
    settings: [
      {
        key: SETTINGS_KEYS.SHOW_MESSAGE_STATS,
        label: fTranslate('text_58767901d07b'),
        help: fTranslate('text_1e886427b492'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.SHOW_AGENTIC_TURN_STATS,
        label: fTranslate('text_795b48b44734'),
        help: fTranslate('text_d531a39769ee'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY,
        dependsOn: SETTINGS_KEYS.SHOW_MESSAGE_STATS
      },
      {
        key: SETTINGS_KEYS.SHOW_THOUGHT_IN_PROGRESS,
        label: fTranslate('text_c699c01d5c4c'),
        help: fTranslate('text_a51f7f782ae8'),
        defaultValue: true,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.ALWAYS_SHOW_TOOL_CALL_CONTENT,
        label: fTranslate('text_9ae2d6e1f7ed'),
        help: fTranslate('text_0a711551837d'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.RENDER_USER_CONTENT_AS_MARKDOWN,
        label: fTranslate('text_11910b83c707'),
        help: fTranslate('text_c3af243c77aa'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.RENDER_THINKING_AS_MARKDOWN,
        label: fTranslate('text_047a9804886c'),
        help: fTranslate('text_3b2811cf8cbc'),
        defaultValue: true,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.FULL_HEIGHT_CODE_BLOCKS,
        label: fTranslate('text_ee7633d878e8'),
        help: fTranslate('text_7f545155cd7c'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.DISABLE_AUTO_SCROLL,
        label: fTranslate('text_1d17af5ec5f4'),
        help: fTranslate('text_3253a89f0cd9'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.ALWAYS_SHOW_SIDEBAR_ON_DESKTOP,
        label: fTranslate('text_87776621d9c2'),
        help: fTranslate('text_2d79bf0c56fd'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.SHOW_RAW_MODEL_NAMES,
        label: fTranslate('text_8dfac9650c4a'),
        help: fTranslate('text_980c9fab0818'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.SHOW_MODEL_QUANTIZATION,
        label: fTranslate('text_b1c372445053'),
        help: fTranslate('text_49aedab8ac92'),
        defaultValue: true,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.SHOW_MODEL_TAGS,
        label: fTranslate('text_68d073cd1d69'),
        help: fTranslate('text_0ed5075d0dba'),
        defaultValue: true,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      },
      {
        key: SETTINGS_KEYS.SHOW_BUILD_VERSION,
        label: fTranslate('text_4d8d312c1cf1'),
        help: fTranslate('text_216237a41c51'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DISPLAY
      }
    ]
  },
  [SETTINGS_SECTION_SLUGS.SAMPLING]: {
    title: SETTINGS_SECTION_TITLES.SAMPLING,
    slug: SETTINGS_SECTION_SLUGS.SAMPLING,
    icon: Funnel,
    settings: [
      {
        key: SETTINGS_KEYS.TEMPERATURE,
        label: fTranslate('text_b958ce8b871a'),
        help: fTranslate('text_4a6ef954759e'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: {
          serverKey: SETTINGS_KEYS.TEMPERATURE,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.DYNATEMP_RANGE,
        label: fTranslate('text_262220def130'),
        help: fTranslate('text_ff2049bb8185'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: {
          serverKey: SETTINGS_KEYS.DYNATEMP_RANGE,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.DYNATEMP_EXPONENT,
        label: fTranslate('text_e7499a75dbee'),
        help: fTranslate('text_ed4443b1e4aa'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: {
          serverKey: SETTINGS_KEYS.DYNATEMP_EXPONENT,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.TOP_K,
        label: fTranslate('text_74fc1150e902'),
        help: fTranslate('text_8dbff0f8b0d9'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: { serverKey: SETTINGS_KEYS.TOP_K, paramType: SyncableParameterType.NUMBER }
      },
      {
        key: SETTINGS_KEYS.TOP_P,
        label: fTranslate('text_c7a8872a31da'),
        help: fTranslate('text_c42b88da2f69'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: { serverKey: SETTINGS_KEYS.TOP_P, paramType: SyncableParameterType.NUMBER }
      },
      {
        key: SETTINGS_KEYS.MIN_P,
        label: fTranslate('text_b0815a3244ed'),
        help: fTranslate('text_bbd244420e7b'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: { serverKey: SETTINGS_KEYS.MIN_P, paramType: SyncableParameterType.NUMBER }
      },
      {
        key: SETTINGS_KEYS.XTC_PROBABILITY,
        label: fTranslate('text_f137399227a7'),
        help: fTranslate('text_c718b5a0c65c'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: {
          serverKey: SETTINGS_KEYS.XTC_PROBABILITY,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.XTC_THRESHOLD,
        label: fTranslate('text_d4ba9412017a'),
        help: fTranslate('text_48793e125258'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: {
          serverKey: SETTINGS_KEYS.XTC_THRESHOLD,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.TYP_P,
        label: fTranslate('text_866fba8d4873'),
        help: fTranslate('text_2a4f56aa43d8'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: { serverKey: SETTINGS_KEYS.TYP_P, paramType: SyncableParameterType.NUMBER }
      },
      {
        key: SETTINGS_KEYS.MAX_TOKENS,
        label: fTranslate('text_409e75c09fcc'),
        help: fTranslate('text_0afe6457ffaf'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: {
          serverKey: SETTINGS_KEYS.MAX_TOKENS,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.SAMPLERS,
        label: fTranslate('text_1c9adac18d8e'),
        help: fTranslate('text_0527a017301b'),
        defaultValue: '',
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.SAMPLING,
        sync: { serverKey: SETTINGS_KEYS.SAMPLERS, paramType: SyncableParameterType.STRING }
      },
      {
        key: SETTINGS_KEYS.BACKEND_SAMPLING,
        label: fTranslate('text_20d1867091ca'),
        help: fTranslate('text_d18beca92501'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.SAMPLING
      }
    ]
  },
  [SETTINGS_SECTION_SLUGS.PENALTIES]: {
    title: SETTINGS_SECTION_TITLES.PENALTIES,
    slug: SETTINGS_SECTION_SLUGS.PENALTIES,
    icon: AlertTriangle,
    settings: [
      {
        key: SETTINGS_KEYS.REPEAT_LAST_N,
        label: fTranslate('text_c917bb45649a'),
        help: fTranslate('text_ea4a39630c59'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.REPEAT_LAST_N,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.REPEAT_PENALTY,
        label: fTranslate('text_bbbc898044f9'),
        help: fTranslate('text_df8fffc1e7e8'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.REPEAT_PENALTY,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.PRESENCE_PENALTY,
        label: fTranslate('text_5891319b9abe'),
        help: fTranslate('text_1f5fec90f468'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.PRESENCE_PENALTY,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.FREQUENCY_PENALTY,
        label: fTranslate('text_7f9413709c95'),
        help: fTranslate('text_cc7e2f1ca212'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.FREQUENCY_PENALTY,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.DRY_MULTIPLIER,
        label: fTranslate('text_a473fa39828e'),
        help: fTranslate('text_e52fc11a5708'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.DRY_MULTIPLIER,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.DRY_BASE,
        label: fTranslate('text_f982fb90c90b'),
        help: fTranslate('text_29ed70517b86'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: { serverKey: SETTINGS_KEYS.DRY_BASE, paramType: SyncableParameterType.NUMBER }
      },
      {
        key: SETTINGS_KEYS.DRY_ALLOWED_LENGTH,
        label: fTranslate('text_88e074dbde59'),
        help: fTranslate('text_06ba2e536c75'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.DRY_ALLOWED_LENGTH,
          paramType: SyncableParameterType.NUMBER
        }
      },
      {
        key: SETTINGS_KEYS.DRY_PENALTY_LAST_N,
        label: fTranslate('text_c8ab732e8d70'),
        help: fTranslate('text_e804042a5e31'),
        defaultValue: undefined,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.PENALTIES,
        sync: {
          serverKey: SETTINGS_KEYS.DRY_PENALTY_LAST_N,
          paramType: SyncableParameterType.NUMBER
        }
      }
    ]
  },
  [SETTINGS_SECTION_SLUGS.AGENTIC]: {
    title: SETTINGS_SECTION_TITLES.AGENTIC,
    slug: SETTINGS_SECTION_SLUGS.AGENTIC,
    icon: ListRestart,
    settings: [
      {
        key: SETTINGS_KEYS.AGENTIC_MAX_TURNS,
        label: fTranslate('text_7e334c6eec91'),
        help: fTranslate('text_f8db79fce786'),
        defaultValue: 10,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.AGENTIC,
        isPositiveInteger: true
      },
      {
        key: SETTINGS_KEYS.MCP_REQUEST_TIMEOUT_SECONDS,
        label: fTranslate('text_ce1c49ac8a96'),
        help: fTranslate('text_eb6b3380faf2'),
        defaultValue: DEFAULT_MCP_CONFIG.requestTimeoutSeconds,
        type: SettingsFieldType.INPUT,
        section: SETTINGS_SECTION_SLUGS.AGENTIC,
        isPositiveInteger: true
      }
    ]
  },
  [SETTINGS_SECTION_SLUGS.DEVELOPER]: {
    title: SETTINGS_SECTION_TITLES.DEVELOPER,
    slug: SETTINGS_SECTION_SLUGS.DEVELOPER,
    icon: Code,
    settings: [
      {
        key: SETTINGS_KEYS.PRE_ENCODE_CONVERSATION,
        label: fTranslate('text_642329b42435'),
        help: fTranslate('text_b59a8e16b7c0'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      },
      {
        key: SETTINGS_KEYS.DISABLE_REASONING_PARSING,
        label: fTranslate('text_70edf5da9d33'),
        help: fTranslate('text_da5c0c85580d'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      },
      {
        key: SETTINGS_KEYS.EXCLUDE_REASONING_FROM_CONTEXT,
        label: fTranslate('text_1f3579b2968e'),
        help: fTranslate('text_6c6741612135'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      },
      {
        key: SETTINGS_KEYS.SHOW_RAW_OUTPUT_SWITCH,
        label: fTranslate('text_922618c6a92e'),
        help: fTranslate('text_2da37fca08fe'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      },
      {
        key: SETTINGS_KEYS.JS_SANDBOX_ENABLED,
        label: fTranslate('text_085046e2a92a'),
        help: fTranslate('text_328ff7861fd0'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      },
      {
        key: SETTINGS_KEYS.SYMBOLIC_MATH_ENABLED,
        label: fTranslate('text_072ccd309854'),
        help: fTranslate('text_03344003f473'),
        defaultValue: false,
        type: SettingsFieldType.CHECKBOX,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER,
        dependsOn: SETTINGS_KEYS.JS_SANDBOX_ENABLED
      },
      {
        key: SETTINGS_KEYS.CUSTOM_JSON,
        label: fTranslate('text_4b225723787e'),
        help: fTranslate('text_c0eecd6c7ea5'),
        defaultValue: '',
        type: SettingsFieldType.TEXTAREA,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      },
      {
        key: SETTINGS_KEYS.CUSTOM_CSS,
        label: fTranslate('text_9d3b9a0e78ea'),
        help: fTranslate('text_eddb4b393605'),
        defaultValue: '',
        type: SettingsFieldType.TEXTAREA,
        section: SETTINGS_SECTION_SLUGS.DEVELOPER
      }
    ]
  }
} as const;

const NON_UI_SETTINGS: SettingsEntry[] = [
  {
    key: SETTINGS_KEYS.SHOW_SYSTEM_MESSAGE,
    label: fTranslate('text_b710ee80506f'),
    help: fTranslate('text_8cae084b4d35'),
    defaultValue: true,
    type: SettingsFieldType.CHECKBOX
  },
  {
    key: SETTINGS_KEYS.MCP_SERVERS,
    label: fTranslate('text_22a7559f09bf'),
    help: fTranslate('text_7b544c202be9'),
    defaultValue: '[]',
    type: SettingsFieldType.INPUT
  },
  {
    key: SETTINGS_KEYS.TITLE_GENERATION_USE_LLM,
    label: fTranslate('text_979477c8d433'),
    help: fTranslate('text_0e24ac7791c3'),
    defaultValue: false,
    type: SettingsFieldType.CHECKBOX
  }
  // {
  //   key: SETTINGS_KEYS.PY_INTERPRETER_ENABLED,
  //   label: 'Python interpreter enabled',
  //   help: 'Enable Python interpreter using Pyodide. Allows running Python code in markdown code blocks.',
  //   defaultValue: false,
  //   type: SettingsFieldType.CHECKBOX,
  //   isExperimental: true,
  //
  // }
];

function getAllSettings(): SettingsEntry[] {
  const result: SettingsEntry[] = [];
  for (const section of Object.values(SETTINGS_REGISTRY)) {
    result.push(...section.settings);
  }
  result.push(...NON_UI_SETTINGS);
  return result;
}

/** Flat config object stored in localStorage. */
export const SETTING_CONFIG_DEFAULT: Record<string, SettingsConfigValue> = Object.fromEntries(
  getAllSettings().map((s) => [s.key, s.defaultValue])
) as Record<string, SettingsConfigValue>;

/** Help text for every setting (including non-UI). */
export const SETTING_CONFIG_INFO: Record<string, string> = Object.fromEntries(
  getAllSettings().map((s) => [s.key, s.help])
) as Record<string, string>;

/** Theme select options. */
export const SETTINGS_COLOR_MODES_CONFIG = COLOR_MODE_OPTIONS;

/** Sidebar sections + field configs (as consumed by UI). */
export const SETTINGS_CHAT_SECTIONS: SettingsSection[] = [
  ...Object.values(SETTINGS_REGISTRY).map((section) => ({
    title: section.title,
    slug: section.slug,
    icon: section.icon,
    fields: section.settings.map((s) => ({
      key: s.key,
      label: s.label,
      type: s.type,
      isExperimental: s.isExperimental,
      isPositiveInteger: s.isPositiveInteger,
      dependsOn: s.dependsOn,
      help: s.help,
      options: s.options,
      radioOptions: s.radioOptions
    }))
  })),
  ...STANDALONE_SECTIONS
];

/** INPUT-type settings whose value is a number. */
export const NUMERIC_FIELDS = getAllSettings()
  .filter((s) => s.type === SettingsFieldType.INPUT && typeof s.defaultValue !== 'string')
  .map((s) => s.key) as readonly string[];

/** Numeric fields clamped to ≥ 1 and rounded. */
export const POSITIVE_INTEGER_FIELDS = getAllSettings()
  .filter((s) => s.isPositiveInteger)
  .map((s) => s.key) as readonly string[];

/** Derived for the parameter sync service. */
export const SYNCABLE_PARAMETERS: SyncableParameter[] = getAllSettings()
  .filter((s) => s.sync !== undefined)
  .map((s) => ({
    key: s.key,
    serverKey: s.sync!.serverKey,
    type: s.sync!.paramType,
    canSync: true
  }));

export const SETTINGS_FALLBACK_EXIT_ROUTE = ROUTES.START;

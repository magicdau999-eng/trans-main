import JSZip from 'jszip';
import type {
  ParsedFileSummary,
  ParsedZipBundle,
  TranslationCategory,
  TranslationEntry,
} from '../types/rpgm';

const DATABASE_FILE_FIELDS: Record<string, string[]> = {
  'Actors.json': ['name', 'nickname', 'profile'],
  'Classes.json': ['name'],
  'Skills.json': ['name', 'description', 'message1', 'message2'],
  'Items.json': ['name', 'description'],
  'Weapons.json': ['name', 'description'],
  'Armors.json': ['name', 'description'],
  'Enemies.json': ['name'],
  'States.json': ['name', 'message1', 'message2', 'message3', 'message4'],
};

const SYSTEM_ARRAY_KEYS = [
  'elements',
  'equipTypes',
  'skillTypes',
  'weaponTypes',
  'armorTypes',
] as const;

const SYSTEM_TERM_ARRAY_KEYS = ['basic', 'commands', 'params'] as const;

const FIELD_LABELS: Record<string, string> = {
  name: 'Tên',
  nickname: 'Biệt danh',
  profile: 'Tiểu sử',
  description: 'Mô tả',
  message1: 'Thông báo 1',
  message2: 'Thông báo 2',
  message3: 'Thông báo 3',
  message4: 'Thông báo 4',
};

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getBaseName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

function detectCommonRootPrefix(paths: string[]): string {
  const jsonPaths = paths.filter((p) => p.toLowerCase().endsWith('.json'));
  if (jsonPaths.length === 0) return '';
  const firstSlash = jsonPaths[0].lastIndexOf('/');
  if (firstSlash === -1) return '';
  const candidate = jsonPaths[0].slice(0, firstSlash + 1);
  return jsonPaths.every((p) => p.startsWith(candidate)) ? candidate : '';
}

interface EventCommand {
  code: number;
  indent?: number;
  parameters?: unknown[];
}

function extractEventListEntries(
  list: unknown,
  filePath: string,
  baseName: string,
  pathToList: (string | number)[],
  contextPrefix: string,
  out: TranslationEntry[],
  counter: { idx: number }
) {
  if (!Array.isArray(list)) return;

  let i = 0;
  while (i < list.length) {
    const cmd = list[i] as EventCommand | null;
    if (!cmd || typeof cmd !== 'object') {
      i++;
      continue;
    }

    // Show Text Header (code 101) — MZ has optional speakerName at parameters[4]
    if (cmd.code === 101 && Array.isArray(cmd.parameters)) {
      const speaker = cmd.parameters[4];
      if (isNonEmptyText(speaker)) {
        out.push({
          id: `${filePath}::${counter.idx++}`,
          filePath,
          baseName,
          category: 'dialogue',
          contextLabel: `${contextPrefix} · Tên người nói`,
          originalText: speaker,
          translatedText: '',
          status: 'pending',
          lineCount: 1,
          locator: {
            kind: 'eventParamString',
            pathToList,
            commandIndex: i,
            paramIndex: 4,
          },
        });
      }
      i++;
      continue;
    }

    // Show Text Body (code 401) — group consecutive 401 lines into one dialogue block
    if (cmd.code === 401 && Array.isArray(cmd.parameters)) {
      const indices: number[] = [];
      const lines: string[] = [];
      while (i < list.length) {
        const nextCmd = list[i] as EventCommand | null;
        if (
          !nextCmd ||
          nextCmd.code !== 401 ||
          !Array.isArray(nextCmd.parameters) ||
          typeof nextCmd.parameters[0] !== 'string'
        ) {
          break;
        }
        indices.push(i);
        lines.push(nextCmd.parameters[0]);
        i++;
      }

      const combined = lines.join('\n');
      if (combined.trim().length > 0) {
        out.push({
          id: `${filePath}::${counter.idx++}`,
          filePath,
          baseName,
          category: 'dialogue',
          contextLabel: `${contextPrefix} · Hội thoại`,
          originalText: combined,
          translatedText: '',
          status: 'pending',
          lineCount: indices.length,
          locator: {
            kind: 'event401Group',
            pathToList,
            indices,
          },
        });
      }
      continue;
    }

    // Scrolling Text Body (code 405)
    if (cmd.code === 405 && Array.isArray(cmd.parameters)) {
      const indices: number[] = [];
      const lines: string[] = [];
      while (i < list.length) {
        const nextCmd = list[i] as EventCommand | null;
        if (
          !nextCmd ||
          nextCmd.code !== 405 ||
          !Array.isArray(nextCmd.parameters) ||
          typeof nextCmd.parameters[0] !== 'string'
        ) {
          break;
        }
        indices.push(i);
        lines.push(nextCmd.parameters[0]);
        i++;
      }

      const combined = lines.join('\n');
      if (combined.trim().length > 0) {
        out.push({
          id: `${filePath}::${counter.idx++}`,
          filePath,
          baseName,
          category: 'dialogue',
          contextLabel: `${contextPrefix} · Chữ cuộn`,
          originalText: combined,
          translatedText: '',
          status: 'pending',
          lineCount: indices.length,
          locator: {
            kind: 'event401Group',
            pathToList,
            indices,
          },
        });
      }
      continue;
    }

    // Show Choices (code 102)
    if (
      cmd.code === 102 &&
      Array.isArray(cmd.parameters) &&
      Array.isArray(cmd.parameters[0])
    ) {
      const choices = cmd.parameters[0] as unknown[];
      choices.forEach((choiceText, choiceIdx) => {
        if (isNonEmptyText(choiceText)) {
          out.push({
            id: `${filePath}::${counter.idx++}`,
            filePath,
            baseName,
            category: 'choice',
            contextLabel: `${contextPrefix} · Lựa chọn #${choiceIdx + 1}`,
            originalText: choiceText,
            translatedText: '',
            status: 'pending',
            lineCount: 1,
            locator: {
              kind: 'choice102Item',
              pathToList,
              commandIndex: i,
              choiceIndex: choiceIdx,
            },
          });
        }
      });
      i++;
      continue;
    }

    // When [Choice] branch (code 402)
    if (
      cmd.code === 402 &&
      Array.isArray(cmd.parameters) &&
      isNonEmptyText(cmd.parameters[1])
    ) {
      out.push({
        id: `${filePath}::${counter.idx++}`,
        filePath,
        baseName,
        category: 'choice',
        contextLabel: `${contextPrefix} · Nhánh lựa chọn`,
        originalText: cmd.parameters[1],
        translatedText: '',
        status: 'pending',
        lineCount: 1,
        locator: {
          kind: 'eventParamString',
          pathToList,
          commandIndex: i,
          paramIndex: 1,
        },
      });
      i++;
      continue;
    }

    // Change Actor Name / Nickname / Profile (320, 324, 325)
    if (
      (cmd.code === 320 || cmd.code === 324 || cmd.code === 325) &&
      Array.isArray(cmd.parameters) &&
      isNonEmptyText(cmd.parameters[1])
    ) {
      const label =
        cmd.code === 320
          ? 'Đổi tên nhân vật'
          : cmd.code === 324
            ? 'Đổi biệt danh'
            : 'Đổi tiểu sử';
      out.push({
        id: `${filePath}::${counter.idx++}`,
        filePath,
        baseName,
        category: 'dialogue',
        contextLabel: `${contextPrefix} · ${label}`,
        originalText: cmd.parameters[1],
        translatedText: '',
        status: 'pending',
        lineCount: 1,
        locator: {
          kind: 'eventParamString',
          pathToList,
          commandIndex: i,
          paramIndex: 1,
        },
      });
    }

    i++;
  }
}

export function extractEntriesFromJson(
  filePath: string,
  data: unknown
): TranslationEntry[] {
  const baseName = getBaseName(filePath);
  const out: TranslationEntry[] = [];
  const counter = { idx: 0 };

  // 1. Database array files (Actors, Classes, Skills, Items, Weapons, Armors, Enemies, States)
  if (baseName in DATABASE_FILE_FIELDS && Array.isArray(data)) {
    const fields = DATABASE_FILE_FIELDS[baseName];
    const entityLabel = baseName.replace('.json', '');
    data.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const record = item as Record<string, unknown>;
      fields.forEach((field) => {
        const value = record[field];
        if (isNonEmptyText(value)) {
          out.push({
            id: `${filePath}::${counter.idx++}`,
            filePath,
            baseName,
            category: 'database',
            contextLabel: `${entityLabel} #${index} · ${FIELD_LABELS[field] || field}`,
            originalText: value,
            translatedText: '',
            status: 'pending',
            lineCount: value.split('\n').length,
            locator: {
              kind: 'objectField',
              path: [index, field],
            },
          });
        }
      });
    });
    return out;
  }

  // 2. System.json
  if (baseName === 'System.json' && data && typeof data === 'object' && !Array.isArray(data)) {
    const sys = data as Record<string, unknown>;
    if (isNonEmptyText(sys.gameTitle)) {
      out.push({
        id: `${filePath}::${counter.idx++}`,
        filePath,
        baseName,
        category: 'system',
        contextLabel: 'System · Tên game',
        originalText: sys.gameTitle,
        translatedText: '',
        status: 'pending',
        lineCount: 1,
        locator: { kind: 'objectField', path: ['gameTitle'] },
      });
    }
    if (isNonEmptyText(sys.currencyUnit)) {
      out.push({
        id: `${filePath}::${counter.idx++}`,
        filePath,
        baseName,
        category: 'system',
        contextLabel: 'System · Đơn vị tiền tệ',
        originalText: sys.currencyUnit,
        translatedText: '',
        status: 'pending',
        lineCount: 1,
        locator: { kind: 'objectField', path: ['currencyUnit'] },
      });
    }

    for (const key of SYSTEM_ARRAY_KEYS) {
      const arr = sys[key];
      if (Array.isArray(arr)) {
        arr.forEach((val, idx) => {
          if (isNonEmptyText(val)) {
            out.push({
              id: `${filePath}::${counter.idx++}`,
              filePath,
              baseName,
              category: 'system',
              contextLabel: `System · ${key}[${idx}]`,
              originalText: val,
              translatedText: '',
              status: 'pending',
              lineCount: 1,
              locator: { kind: 'arrayItem', path: [key], index: idx },
            });
          }
        });
      }
    }

    if (sys.terms && typeof sys.terms === 'object') {
      const terms = sys.terms as Record<string, unknown>;
      for (const key of SYSTEM_TERM_ARRAY_KEYS) {
        const arr = terms[key];
        if (Array.isArray(arr)) {
          arr.forEach((val, idx) => {
            if (isNonEmptyText(val)) {
              out.push({
                id: `${filePath}::${counter.idx++}`,
                filePath,
                baseName,
                category: 'system',
                contextLabel: `System.terms · ${key}[${idx}]`,
                originalText: val,
                translatedText: '',
                status: 'pending',
                lineCount: 1,
                locator: { kind: 'arrayItem', path: ['terms', key], index: idx },
              });
            }
          });
        }
      }

      if (terms.messages && typeof terms.messages === 'object') {
        const msgs = terms.messages as Record<string, unknown>;
        Object.entries(msgs).forEach(([msgKey, val]) => {
          if (isNonEmptyText(val)) {
            out.push({
              id: `${filePath}::${counter.idx++}`,
              filePath,
              baseName,
              category: 'system',
              contextLabel: `System.messages · ${msgKey}`,
              originalText: val,
              translatedText: '',
              status: 'pending',
              lineCount: 1,
              locator: { kind: 'objectField', path: ['terms', 'messages', msgKey] },
            });
          }
        });
      }
    }
    return out;
  }

  // 3. CommonEvents.json
  if (baseName === 'CommonEvents.json' && Array.isArray(data)) {
    data.forEach((ev, idx) => {
      if (!ev || typeof ev !== 'object') return;
      const evRecord = ev as Record<string, unknown>;
      const evName = isNonEmptyText(evRecord.name) ? evRecord.name : `#${idx}`;
      extractEventListEntries(
        evRecord.list,
        filePath,
        baseName,
        [idx, 'list'],
        `CommonEvent ${evName}`,
        out,
        counter
      );
    });
    return out;
  }

  // 4. Troops.json
  if (baseName === 'Troops.json' && Array.isArray(data)) {
    data.forEach((troop, tIdx) => {
      if (!troop || typeof troop !== 'object') return;
      const troopRecord = troop as Record<string, unknown>;
      if (Array.isArray(troopRecord.pages)) {
        troopRecord.pages.forEach((page, pIdx) => {
          if (!page || typeof page !== 'object') return;
          const pageRecord = page as Record<string, unknown>;
          extractEventListEntries(
            pageRecord.list,
            filePath,
            baseName,
            [tIdx, 'pages', pIdx, 'list'],
            `Troop #${tIdx} · Trang ${pIdx + 1}`,
            out,
            counter
          );
        });
      }
    });
    return out;
  }

  // 5. MapXXX.json
  if (/^Map\d+\.json$/i.test(baseName) && data && typeof data === 'object' && !Array.isArray(data)) {
    const mapObj = data as Record<string, unknown>;
    if (isNonEmptyText(mapObj.displayName)) {
      out.push({
        id: `${filePath}::${counter.idx++}`,
        filePath,
        baseName,
        category: 'map',
        contextLabel: `${baseName.replace('.json', '')} · Tên hiển thị bản đồ`,
        originalText: mapObj.displayName,
        translatedText: '',
        status: 'pending',
        lineCount: 1,
        locator: { kind: 'objectField', path: ['displayName'] },
      });
    }

    if (Array.isArray(mapObj.events)) {
      mapObj.events.forEach((ev, evIdx) => {
        if (!ev || typeof ev !== 'object') return;
        const evRecord = ev as Record<string, unknown>;
        const evName = isNonEmptyText(evRecord.name) ? evRecord.name : `EV${evIdx}`;
        if (Array.isArray(evRecord.pages)) {
          evRecord.pages.forEach((page, pIdx) => {
            if (!page || typeof page !== 'object') return;
            const pageRecord = page as Record<string, unknown>;
            extractEventListEntries(
              pageRecord.list,
              filePath,
              baseName,
              ['events', evIdx, 'pages', pIdx, 'list'],
              `${baseName.replace('.json', '')} · ${evName} (P${pIdx + 1})`,
              out,
              counter
            );
          });
        }
      });
    }
    return out;
  }

  return out;
}

/**
 * Redistributes translated text into exact `targetCount` lines so that RPG Maker's
 * `list` command indices remain 100% intact (preserving mid-event save compatibility).
 */
export function redistributeLines(text: string, targetCount: number): string[] {
  if (targetCount <= 1) {
    return [text.replace(/\r?\n/g, ' ').trim()];
  }

  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return Array.from({ length: targetCount }, () => '');
  }

  if (rawLines.length === targetCount) {
    return rawLines;
  }

  if (rawLines.length < targetCount) {
    const padded = [...rawLines];
    while (padded.length < targetCount) {
      padded.push('');
    }
    return padded;
  }

  // More translated lines than original lines: wrap/merge into `targetCount` balanced lines
  const words = rawLines.join(' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return Array.from({ length: targetCount }, () => '');
  }

  const totalChars = words.reduce((acc, w) => acc + w.length + 1, 0);
  const targetCharsPerLine = Math.max(1, Math.ceil(totalChars / targetCount));
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    if (
      current.length > 0 &&
      current.length + 1 + word.length > targetCharsPerLine &&
      result.length < targetCount - 1
    ) {
      result.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) {
    result.push(current);
  }
  while (result.length < targetCount) {
    result.push('');
  }
  return result.slice(0, targetCount);
}

function getAtPath(root: unknown, path: (string | number)[]): unknown {
  let curr: unknown = root;
  for (const key of path) {
    if (curr == null || typeof curr !== 'object') return undefined;
    curr = (curr as Record<string | number, unknown>)[key];
  }
  return curr;
}

function setAtPath(root: unknown, path: (string | number)[], value: unknown): void {
  if (path.length === 0 || root == null || typeof root !== 'object') return;
  const parent = getAtPath(root, path.slice(0, -1));
  if (parent != null && typeof parent === 'object') {
    const lastKey = path[path.length - 1];
    (parent as Record<string | number, unknown>)[lastKey] = value;
  }
}

export function applyTranslationsToJson<T>(
  originalData: T,
  entriesForFile: TranslationEntry[],
  enabledCategories?: Record<TranslationCategory, boolean>
): T {
  const cloned = structuredClone(originalData);

  for (const entry of entriesForFile) {
    if (enabledCategories && !enabledCategories[entry.category]) {
      continue;
    }
    const finalText = entry.translatedText.trim();
    if (!finalText) continue;

    const { locator } = entry;
    if (locator.kind === 'objectField') {
      setAtPath(cloned, locator.path, finalText);
    } else if (locator.kind === 'arrayItem') {
      const arr = getAtPath(cloned, locator.path);
      if (Array.isArray(arr) && locator.index < arr.length) {
        arr[locator.index] = finalText;
      }
    } else if (locator.kind === 'eventParamString') {
      const list = getAtPath(cloned, locator.pathToList);
      if (Array.isArray(list)) {
        const cmd = list[locator.commandIndex] as EventCommand | undefined;
        if (cmd && Array.isArray(cmd.parameters)) {
          cmd.parameters[locator.paramIndex] = finalText;
        }
      }
    } else if (locator.kind === 'choice102Item') {
      const list = getAtPath(cloned, locator.pathToList);
      if (Array.isArray(list)) {
        const cmd = list[locator.commandIndex] as EventCommand | undefined;
        if (cmd && Array.isArray(cmd.parameters) && Array.isArray(cmd.parameters[0])) {
          const choices = cmd.parameters[0] as unknown[];
          if (locator.choiceIndex < choices.length) {
            choices[locator.choiceIndex] = finalText;
          }
        }
      }
    } else if (locator.kind === 'event401Group') {
      const list = getAtPath(cloned, locator.pathToList);
      if (Array.isArray(list)) {
        const distributed = redistributeLines(finalText, locator.indices.length);
        locator.indices.forEach((cmdIdx, lineIdx) => {
          const cmd = list[cmdIdx] as EventCommand | undefined;
          if (cmd && Array.isArray(cmd.parameters)) {
            cmd.parameters[0] = distributed[lineIdx] ?? '';
          }
        });
      }
    }
  }

  return cloned;
}

export async function parseRpgmZip(
  input: ArrayBuffer | Uint8Array,
  fileName = 'data.zip'
): Promise<ParsedZipBundle> {
  const zip = await JSZip.loadAsync(input);
  const rawFiles: Record<string, Uint8Array> = {};
  const parsedJson: Record<string, unknown> = {};
  const files: ParsedFileSummary[] = [];
  const entries: TranslationEntry[] = [];

  const filePaths = Object.keys(zip.files)
    .filter((p) => !zip.files[p].dir && !p.startsWith('__MACOSX/'))
    .sort((a, b) => a.localeCompare(b));

  for (const filePath of filePaths) {
    const zipObj = zip.files[filePath];
    const bytes = await zipObj.async('uint8array');
    rawFiles[filePath] = bytes;

    const baseName = getBaseName(filePath);
    if (filePath.toLowerCase().endsWith('.json')) {
      try {
        const text = new TextDecoder('utf-8').decode(bytes);
        const cleanText = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
        const json = JSON.parse(cleanText);
        parsedJson[filePath] = json;

        const fileEntries = extractEntriesFromJson(filePath, json);
        entries.push(...fileEntries);

        const categories = Array.from(new Set(fileEntries.map((e) => e.category)));
        files.push({
          filePath,
          baseName,
          entryCount: fileEntries.length,
          isTranslatable: fileEntries.length > 0,
          categories,
        });
      } catch {
        files.push({
          filePath,
          baseName,
          entryCount: 0,
          isTranslatable: false,
          categories: [],
        });
      }
    } else {
      files.push({
        filePath,
        baseName,
        entryCount: 0,
        isTranslatable: false,
        categories: [],
      });
    }
  }

  return {
    fileName,
    rootPrefix: detectCommonRootPrefix(filePaths),
    totalFiles: filePaths.length,
    rawFiles,
    parsedJson,
    files,
    entries,
  };
}

export async function exportRpgmZip(
  bundle: ParsedZipBundle,
  entries: TranslationEntry[],
  enabledCategories?: Record<TranslationCategory, boolean>
): Promise<Uint8Array> {
  const zip = new JSZip();

  const entriesByFile = new Map<string, TranslationEntry[]>();
  for (const entry of entries) {
    const list = entriesByFile.get(entry.filePath) ?? [];
    list.push(entry);
    entriesByFile.set(entry.filePath, list);
  }

  for (const [filePath, rawBytes] of Object.entries(bundle.rawFiles)) {
    const originalJson = bundle.parsedJson[filePath];
    const fileEntries = entriesByFile.get(filePath);

    if (originalJson !== undefined && fileEntries && fileEntries.length > 0) {
      const updated = applyTranslationsToJson(originalJson, fileEntries, enabledCategories);
      zip.file(filePath, JSON.stringify(updated));
    } else {
      zip.file(filePath, rawBytes);
    }
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function createSampleRpgmZip(): Promise<Uint8Array> {
  const zip = new JSZip();

  const systemJson = {
    gameTitle: 'Chronicles of Aethelgard',
    currencyUnit: 'G',
    elements: ['', 'Physical', 'Fire', 'Ice', 'Thunder'],
    equipTypes: ['', 'Weapon', 'Shield', 'Head', 'Body', 'Accessory'],
    skillTypes: ['', 'Magic', 'Special'],
    weaponTypes: ['', 'Dagger', 'Sword', 'Staff'],
    armorTypes: ['', 'General Armor', 'Magic Armor'],
    terms: {
      basic: ['Level', 'Lv', 'HP', 'HP', 'MP', 'MP', 'TP', 'TP', 'EXP', 'EXP'],
      commands: [
        'Fight',
        'Escape',
        'Attack',
        'Guard',
        'Item',
        'Skill',
        'Equip',
        'Status',
        'Formation',
        'Save',
        'Game End',
        'Options',
        'Weapon',
        'Armor',
        'Key Item',
        'Equip',
        'Optimize',
        'Clear',
        'New Game',
        'Continue',
      ],
      params: ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'],
      messages: {
        actionFailure: 'There was no effect on %1!',
        actorDamage: '%1 took %2 damage!',
        victory: '%1 was victorious!',
        defeat: '%1 was defeated.',
        obtainGold: '%1\\G found!',
      },
    },
    switches: ['', 'Intro_Done', 'Bridge_Open'],
    variables: ['', 'Gold_Count', 'Quest_Stage'],
  };

  const actorsJson = [
    null,
    {
      id: 1,
      name: 'Ren',
      nickname: 'Silver Blade',
      profile: 'A wandering apprentice knight searching for the lost starlight shard.',
      note: '<StartingSkill: 12>',
    },
    {
      id: 2,
      name: 'Lyra',
      nickname: 'Dawn Mage',
      profile: 'An academy scholar fluent in ancient runes and healing arts.',
      note: '',
    },
  ];

  const itemsJson = [
    null,
    {
      id: 1,
      name: 'Herb Potion',
      description: 'Restores 150 HP to one ally. Smells faintly of wild mint.',
      note: '',
    },
    {
      id: 2,
      name: 'Moonlit Key',
      description: 'An ornate silver key that unlocks the Northern Shrine.',
      note: '',
    },
  ];

  const skillsJson = [
    null,
    {
      id: 1,
      name: 'Crescent Slash',
      description: 'Deals physical damage to a single enemy.',
      message1: '%1 unleashes Crescent Slash!',
      message2: '',
      note: '',
    },
  ];

  const map001Json = {
    displayName: 'Starfall Village',
    events: [
      null,
      {
        id: 1,
        name: 'Elder',
        pages: [
          {
            list: [
              { code: 101, indent: 0, parameters: ['People1', 0, 0, 2, 'Village Elder'] },
              { code: 401, indent: 0, parameters: ['Welcome back, \\C[2]\\N[1]\\C[0]!'] },
              {
                code: 401,
                indent: 0,
                parameters: ['The northern bridge is still sealed until you gather \\V[12] crystals.'],
              },
              { code: 102, indent: 0, parameters: [['Accept the quest', 'Ask about the ruins', 'Leave'], 2] },
              { code: 402, indent: 0, parameters: [0, 'Accept the quest'] },
              { code: 101, indent: 1, parameters: ['People1', 0, 0, 2, 'Village Elder'] },
              { code: 401, indent: 1, parameters: ['May the starlight guide your blade!'] },
              { code: 355, indent: 1, parameters: ['console.log("DO_NOT_TRANSLATE_SCRIPT");'] },
              { code: 0, indent: 0, parameters: [] },
            ],
          },
        ],
      },
    ],
  };

  const commonEventsJson = [
    null,
    {
      id: 1,
      name: 'Campfire Rest',
      list: [
        { code: 101, indent: 0, parameters: ['', 0, 0, 2, ''] },
        { code: 401, indent: 0, parameters: ['The party rests warmly beside the campfire. HP and MP restored!'] },
        { code: 0, indent: 0, parameters: [] },
      ],
    },
  ];

  const tilesetsJson = [null, { id: 1, name: 'Outside', tilesetNames: ['Outside_A1', 'Outside_A2'] }];

  zip.file('data/System.json', JSON.stringify(systemJson));
  zip.file('data/Actors.json', JSON.stringify(actorsJson));
  zip.file('data/Items.json', JSON.stringify(itemsJson));
  zip.file('data/Skills.json', JSON.stringify(skillsJson));
  zip.file('data/Map001.json', JSON.stringify(map001Json));
  zip.file('data/CommonEvents.json', JSON.stringify(commonEventsJson));
  zip.file('data/Tilesets.json', JSON.stringify(tilesetsJson));

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

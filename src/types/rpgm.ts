export type TranslationCategory =
  | 'dialogue'
  | 'choice'
  | 'database'
  | 'system'
  | 'map';

export type EntryStatus = 'pending' | 'translated' | 'edited' | 'error';

export type LineLocator =
  | {
      kind: 'objectField';
      path: (string | number)[];
    }
  | {
      kind: 'arrayItem';
      path: (string | number)[];
      index: number;
    }
  | {
      kind: 'event401Group';
      pathToList: (string | number)[];
      indices: number[];
    }
  | {
      kind: 'choice102Item';
      pathToList: (string | number)[];
      commandIndex: number;
      choiceIndex: number;
    }
  | {
      kind: 'eventParamString';
      pathToList: (string | number)[];
      commandIndex: number;
      paramIndex: number;
    };

export interface TranslationEntry {
  id: string;
  filePath: string;
  baseName: string;
  category: TranslationCategory;
  contextLabel: string;
  originalText: string;
  translatedText: string;
  status: EntryStatus;
  lineCount: number;
  locator: LineLocator;
  errorMessage?: string;
}

export interface ParsedFileSummary {
  filePath: string;
  baseName: string;
  entryCount: number;
  isTranslatable: boolean;
  categories: TranslationCategory[];
}

export interface ParsedZipBundle {
  fileName: string;
  rootPrefix: string;
  totalFiles: number;
  rawFiles: Record<string, Uint8Array>;
  parsedJson: Record<string, unknown>;
  files: ParsedFileSummary[];
  entries: TranslationEntry[];
}

export type TranslationTone = 'natural' | 'faithful' | 'casual';

export interface TranslationSettings {
  targetLanguage: string;
  tone: TranslationTone;
  glossary: string;
  enabledCategories: Record<TranslationCategory, boolean>;
  apiKey?: string;
}

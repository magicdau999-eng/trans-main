import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  createSampleRpgmZip,
  exportRpgmZip,
  parseRpgmZip,
  redistributeLines,
} from './rpgmParser';

test('createSampleRpgmZip and parseRpgmZip extract all translatable RPGM entries while skipping scripts and notes', async () => {
  const sampleBytes = await createSampleRpgmZip();
  const bundle = await parseRpgmZip(sampleBytes, 'data.zip');

  assert.equal(bundle.totalFiles, 7);
  assert.equal(bundle.rootPrefix, 'data/');

  // Ensure Tilesets.json is preserved even though it has 0 translatable entries
  const tilesetSummary = bundle.files.find((f) => f.baseName === 'Tilesets.json');
  assert.ok(tilesetSummary);
  assert.equal(tilesetSummary.isTranslatable, false);

  // Script command 355 and Actor note must NOT be extracted
  const hasScript = bundle.entries.some((e) => e.originalText.includes('DO_NOT_TRANSLATE_SCRIPT'));
  const hasNote = bundle.entries.some((e) => e.originalText.includes('StartingSkill'));
  assert.equal(hasScript, false);
  assert.equal(hasNote, false);

  // Switches and variables in System.json must NOT be extracted
  const hasSwitch = bundle.entries.some((e) => e.originalText === 'Intro_Done');
  assert.equal(hasSwitch, false);

  // Consecutive 401 lines in Map001 should be grouped into one entry with lineCount = 2
  const groupedDialogue = bundle.entries.find(
    (e) => e.baseName === 'Map001.json' && e.originalText.includes('\\C[2]\\N[1]\\C[0]')
  );
  assert.ok(groupedDialogue);
  assert.equal(groupedDialogue.lineCount, 2);
  assert.equal(groupedDialogue.category, 'dialogue');

  // Choices (102) and speakerName (101) should be extracted
  const choices = bundle.entries.filter(
    (e) => e.baseName === 'Map001.json' && e.category === 'choice'
  );
  assert.ok(choices.length >= 3);
});

test('redistributeLines preserves exact command line count', () => {
  const twoLines = redistributeLines('Chào mừng trở lại!\nCây cầu phía bắc vẫn đang bị phong ấn.', 2);
  assert.equal(twoLines.length, 2);
  assert.equal(twoLines[0], 'Chào mừng trở lại!');

  const wrappedToTwo = redistributeLines('Dòng một\nDòng hai\nDòng ba rất dài nữa', 2);
  assert.equal(wrappedToTwo.length, 2);

  const paddedToThree = redistributeLines('Chỉ có một dòng thôi', 3);
  assert.equal(paddedToThree.length, 3);
  assert.equal(paddedToThree[1], '');
  assert.equal(paddedToThree[2], '');
});

test('exportRpgmZip writes translated text back with identical directory structure and command indices', async () => {
  const sampleBytes = await createSampleRpgmZip();
  const bundle = await parseRpgmZip(sampleBytes, 'data.zip');

  const updatedEntries = bundle.entries.map((entry) => {
    if (entry.baseName === 'Map001.json' && entry.category === 'map') {
      return { ...entry, translatedText: 'Làng Sao Rơi' };
    }
    if (entry.originalText.includes('\\C[2]\\N[1]\\C[0]')) {
      return {
        ...entry,
        translatedText: 'Chào mừng trở lại, \\C[2]\\N[1]\\C[0]!\nCây cầu phía bắc vẫn phong ấn cho đến khi thu thập đủ \\V[12] tinh thạch.',
      };
    }
    if (entry.baseName === 'Items.json' && entry.originalText === 'Herb Potion') {
      return { ...entry, translatedText: 'Thuốc Thảo Mộc' };
    }
    return entry;
  });

  const exportedBytes = await exportRpgmZip(bundle, updatedEntries);
  const rezipped = await JSZip.loadAsync(exportedBytes);

  // Exact file paths preserved
  assert.ok(rezipped.file('data/Map001.json'));
  assert.ok(rezipped.file('data/Tilesets.json'));

  const mapRaw = await rezipped.file('data/Map001.json')!.async('string');
  const mapJson = JSON.parse(mapRaw);
  assert.equal(mapJson.displayName, 'Làng Sao Rơi');
  // Original event list length (9 commands) is 100% preserved for save compatibility
  assert.equal(mapJson.events[1].pages[0].list.length, 9);
  assert.equal(
    mapJson.events[1].pages[0].list[1].parameters[0],
    'Chào mừng trở lại, \\C[2]\\N[1]\\C[0]!'
  );
  // Script command untouched
  assert.equal(
    mapJson.events[1].pages[0].list[7].parameters[0],
    'console.log("DO_NOT_TRANSLATE_SCRIPT");'
  );

  const itemsJson = JSON.parse(await rezipped.file('data/Items.json')!.async('string'));
  assert.equal(itemsJson[1].name, 'Thuốc Thảo Mộc');
  // Untranslated item keeps original text
  assert.equal(itemsJson[2].name, 'Moonlit Key');
});

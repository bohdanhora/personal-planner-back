import { readJsonObject } from './assistant-json';

describe('readJsonObject', () => {
  it('reads a plain object', () => {
    expect(readJsonObject('{"reply":"ok","drafts":[]}')).toEqual({ reply: 'ok', drafts: [] });
  });

  it('unwraps a fenced answer', () => {
    expect(readJsonObject('```json\n{"tips":[]}\n```')).toEqual({ tips: [] });
  });

  it('ignores text around the object', () => {
    expect(readJsonObject('Here is the plan: {"summary":"Calm day"} Hope it helps')).toEqual({
      summary: 'Calm day',
    });
  });

  it('gives up on anything that is not an object', () => {
    expect(readJsonObject('no json here')).toBeUndefined();
    expect(readJsonObject('[1, 2]')).toBeUndefined();
    expect(readJsonObject('{"broken": ')).toBeUndefined();
  });
});

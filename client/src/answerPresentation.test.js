import { describe, expect, it } from 'vitest';
import { prepareAnswer, answerPlainText } from './answerPresentation.js';
describe('source integrity', () => {
  it('uses evidence order rather than reordered display sources, deduplicates and drops unresolved citations', () => {
    const a = { title: 'A', url: 'https://www.fau.edu/a/' }, b = { title: 'B', url: 'https://www.fau.edu/b/' };
    const result = prepareAnswer({ citationSources: [b, a, b], sources: [a,b], groundedAnswer: { summary: 'First [1], second [2], same first [3], unknown [9].', facts: [{label:'A',value:'Value [2]'}] } });
    expect(result.sources).toEqual([b,a]);
    expect(result.answer.summary).toBe('First [1], second [2], same first [1], unknown .');
    expect(result.answer.facts[0].value).toBe('Value [2]');
    expect(answerPlainText(result.answer, result.sources)).toContain('[1] B: https://www.fau.edu/b/');
  });
  it('does not turn an unsafe source into an action or citation', () => {
    const data = prepareAnswer({ sources: [{title:'Unsafe',url:'javascript:alert(1)'}], groundedAnswer: {summary:'Text [1]'} });
    expect(data.sources).toEqual([]); expect(data.answer.summary).toBe('Text ');
  });
});

/**
 * BaseAIService Tests
 *
 * Tests the core helper methods in BaseAIService:
 * - calculateScore()
 * - parseZone()
 * - createSuggestion()
 * - parseAIResponse()
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { BaseAIService } from '../../../../services/ai/core/BaseAIService';
import { Suggestion } from '../../../../services/ai/core/types';

// Test implementation that exposes protected methods
class TestableBaseAIService extends BaseAIService {
  // Implement abstract execute method (not used in these tests)
  async execute(_payload: any): Promise<any> {
    return {};
  }

  public testCalculateScore(issues: {
    critical?: number;
    warnings?: number;
    minor?: number;
  }): number {
    return this.calculateScore(issues);
  }

  public testParseZone(zone: string | null): number | null {
    return this.parseZone(zone);
  }

  public testCreateSuggestion(
    type: 'improvement' | 'warning' | 'optimization',
    category: string,
    title: string,
    description: string,
    affectedIds: string[],
    priority: 'high' | 'medium' | 'low',
    actionable = true
  ): Suggestion {
    return this.createSuggestion(
      type,
      category,
      title,
      description,
      affectedIds,
      priority,
      actionable
    );
  }

  public testParseAIResponse(aiSuggestion: any): any {
    return this.parseAIResponse(aiSuggestion);
  }
}

describe('BaseAIService', () => {
  let service: TestableBaseAIService;

  beforeEach(() => {
    service = new TestableBaseAIService({ enableAICalls: false });
  });

  describe('calculateScore()', () => {
    it('should return 100 for no issues', () => {
      const score = service.testCalculateScore({});
      expect(score).to.equal(100);
    });

    it('should deduct 15 points per critical issue', () => {
      const score = service.testCalculateScore({ critical: 2 });
      expect(score).to.equal(70); // 100 - (2 * 15)
    });

    it('should deduct 5 points per warning', () => {
      const score = service.testCalculateScore({ warnings: 3 });
      expect(score).to.equal(85); // 100 - (3 * 5)
    });

    it('should deduct 2 points per minor issue', () => {
      const score = service.testCalculateScore({ minor: 5 });
      expect(score).to.equal(90); // 100 - (5 * 2)
    });

    it('should calculate combined deductions correctly', () => {
      const score = service.testCalculateScore({
        critical: 1,
        warnings: 2,
        minor: 3,
      });
      expect(score).to.equal(69); // 100 - 15 - 10 - 6
    });

    it('should never return below 0', () => {
      const score = service.testCalculateScore({ critical: 10 });
      expect(score).to.equal(0);
    });

    it('should never return above 100', () => {
      // Edge case: negative values shouldn't increase score
      const score = service.testCalculateScore({ critical: -5 });
      expect(score).to.equal(100);
    });

    it('should handle undefined issue counts as 0', () => {
      const score = service.testCalculateScore({
        critical: undefined,
        warnings: 2,
      });
      expect(score).to.equal(90); // 100 - (2 * 5)
    });
  });

  describe('parseZone()', () => {
    it('should parse numeric zone strings', () => {
      expect(service.testParseZone('5')).to.equal(5);
      expect(service.testParseZone('10')).to.equal(10);
    });

    it('should parse zone strings with letter suffix', () => {
      expect(service.testParseZone('5a')).to.equal(5);
      expect(service.testParseZone('5b')).to.equal(5);
      expect(service.testParseZone('10a')).to.equal(10);
    });

    it('should return null for null input', () => {
      expect(service.testParseZone(null)).to.be.null;
    });

    it('should return null for empty string', () => {
      expect(service.testParseZone('')).to.be.null;
    });

    it('should return null for invalid zone strings', () => {
      expect(service.testParseZone('invalid')).to.be.null;
      expect(service.testParseZone('abc')).to.be.null;
    });

    it('should extract first number from mixed format', () => {
      expect(service.testParseZone('Zone 5a')).to.equal(5);
      expect(service.testParseZone('USDA 7b')).to.equal(7);
    });

    it('should handle double-digit zones', () => {
      expect(service.testParseZone('11')).to.equal(11);
      expect(service.testParseZone('13b')).to.equal(13);
    });
  });

  describe('createSuggestion()', () => {
    it('should create a valid suggestion object with all fields', () => {
      const suggestion = service.testCreateSuggestion(
        'warning',
        'companion_planting',
        'Test Warning',
        'This is a test warning description',
        ['id-1', 'id-2'],
        'high'
      );

      expect(suggestion).to.deep.equal({
        type: 'warning',
        category: 'companion_planting',
        title: 'Test Warning',
        description: 'This is a test warning description',
        affectedIds: ['id-1', 'id-2'],
        priority: 'high',
        actionable: true,
      });
    });

    it('should default actionable to true', () => {
      const suggestion = service.testCreateSuggestion(
        'improvement',
        'spacing',
        'Test',
        'Description',
        [],
        'low'
      );
      expect(suggestion.actionable).to.be.true;
    });

    it('should allow setting actionable to false', () => {
      const suggestion = service.testCreateSuggestion(
        'optimization',
        'layout',
        'Test',
        'Description',
        [],
        'medium',
        false
      );
      expect(suggestion.actionable).to.be.false;
    });

    it('should handle empty affectedIds array', () => {
      const suggestion = service.testCreateSuggestion(
        'improvement',
        'general',
        'Test',
        'Description',
        [],
        'low'
      );
      expect(suggestion.affectedIds).to.deep.equal([]);
    });

    it('should handle multiple affectedIds', () => {
      const ids = ['id-1', 'id-2', 'id-3', 'id-4'];
      const suggestion = service.testCreateSuggestion(
        'warning',
        'zone_compatibility',
        'Test',
        'Description',
        ids,
        'high'
      );
      expect(suggestion.affectedIds).to.deep.equal(ids);
    });

    it('should create suggestions of all types', () => {
      const types: Array<'improvement' | 'warning' | 'optimization'> = [
        'improvement',
        'warning',
        'optimization',
      ];

      types.forEach((type) => {
        const suggestion = service.testCreateSuggestion(
          type,
          'test',
          'Test',
          'Description',
          [],
          'low'
        );
        expect(suggestion.type).to.equal(type);
      });
    });

    it('should create suggestions with all priority levels', () => {
      const priorities: Array<'high' | 'medium' | 'low'> = [
        'high',
        'medium',
        'low',
      ];

      priorities.forEach((priority) => {
        const suggestion = service.testCreateSuggestion(
          'improvement',
          'test',
          'Test',
          'Description',
          [],
          priority
        );
        expect(suggestion.priority).to.equal(priority);
      });
    });
  });

  describe('parseAIResponse()', () => {
    it('should parse AI response from additionalInfo.analysisData', () => {
      const aiSuggestion = {
        action: 'irrelevant',
        reason: 'irrelevant',
        additionalInfo: {
          analysisData: {
            suggestions: [{ title: 'Test' }],
            overallScore: 85,
            summary: 'Good garden',
          },
        },
      };

      const result = service.testParseAIResponse(aiSuggestion);
      expect(result).to.deep.equal({
        suggestions: [{ title: 'Test' }],
        overallScore: 85,
        summary: 'Good garden',
      });
    });

    it('should parse AI response from JSON in action field', () => {
      const data = {
        suggestions: [],
        overallScore: 90,
        summary: 'Test summary',
      };
      const aiSuggestion = {
        action: JSON.stringify(data),
        reason: 'Some reason',
      };

      const result = service.testParseAIResponse(aiSuggestion);
      expect(result).to.deep.equal(data);
    });

    it('should return default structure on parse failure', () => {
      const aiSuggestion = {
        action: 'not valid JSON',
        reason: 'The reason for failure',
      };

      const result = service.testParseAIResponse(aiSuggestion);
      expect(result).to.deep.equal({
        suggestions: [],
        overallScore: 0,
        summary: 'The reason for failure',
      });
    });

    it('should handle missing reason field', () => {
      const aiSuggestion = {
        action: 'invalid',
      };

      const result = service.testParseAIResponse(aiSuggestion);
      expect(result.summary).to.equal('Failed to parse AI response');
    });

    it('should prefer additionalInfo over action field', () => {
      const aiSuggestion = {
        action: JSON.stringify({ overallScore: 50 }),
        additionalInfo: {
          analysisData: { overallScore: 75, suggestions: [], summary: 'Test' },
        },
      };

      const result = service.testParseAIResponse(aiSuggestion);
      expect(result.overallScore).to.equal(75);
    });

    it('should handle null/undefined additionalInfo gracefully', () => {
      const aiSuggestion = {
        action: JSON.stringify({
          suggestions: [],
          overallScore: 60,
          summary: 'Test',
        }),
        additionalInfo: null,
      };

      const result = service.testParseAIResponse(aiSuggestion);
      expect(result.overallScore).to.equal(60);
    });
  });

  describe('constructor configuration', () => {
    it('should default enableAICalls to false', () => {
      const defaultService = new TestableBaseAIService();
      expect((defaultService as any).config.enableAICalls).to.be.false;
    });

    it('should default logPrompts to true', () => {
      const defaultService = new TestableBaseAIService();
      expect((defaultService as any).config.logPrompts).to.be.true;
    });

    it('should default maxRetries to 3', () => {
      const defaultService = new TestableBaseAIService();
      expect((defaultService as any).config.maxRetries).to.equal(3);
    });

    it('should allow overriding enableAICalls', () => {
      const customService = new TestableBaseAIService({ enableAICalls: true });
      expect((customService as any).config.enableAICalls).to.be.true;
    });

    it('should allow overriding logPrompts', () => {
      const customService = new TestableBaseAIService({ logPrompts: false });
      expect((customService as any).config.logPrompts).to.be.false;
    });

    it('should allow overriding maxRetries', () => {
      const customService = new TestableBaseAIService({ maxRetries: 5 });
      expect((customService as any).config.maxRetries).to.equal(5);
    });

    it('should allow overriding multiple config options', () => {
      const customService = new TestableBaseAIService({
        enableAICalls: true,
        logPrompts: false,
        maxRetries: 10,
      });
      expect((customService as any).config.enableAICalls).to.be.true;
      expect((customService as any).config.logPrompts).to.be.false;
      expect((customService as any).config.maxRetries).to.equal(10);
    });
  });
});

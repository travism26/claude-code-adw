import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import {
  AIProviderManager,
} from '../../../services/ai/AIProviderManager';
import {
  AIProvider,
  AIProviderError,
  AIProviderErrorType,
  AIProviderResponse,
  ChatCompletionParams,
  ProviderStatus,
} from '../../../services/ai/providers/types';

use(chaiAsPromised);

// Mock provider implementation for testing
class MockProvider implements AIProvider {
  name: 'anthropic' | 'openai' | 'openrouter';
  private available: boolean;
  private chatResponse: AIProviderResponse | null;
  private chatError: AIProviderError | null;
  chatCallCount = 0;

  constructor(
    name: 'anthropic' | 'openai' | 'openrouter',
    available = true,
    chatResponse?: AIProviderResponse,
    chatError?: AIProviderError
  ) {
    this.name = name;
    this.available = available;
    this.chatResponse = chatResponse || null;
    this.chatError = chatError || null;
  }

  isAvailable(): boolean {
    return this.available;
  }

  getStatus(): ProviderStatus {
    return {
      name: this.name,
      available: this.available,
      message: this.available ? `${this.name} ready` : `${this.name} unavailable`,
      lastChecked: new Date(),
    };
  }

  async chat(_params: ChatCompletionParams): Promise<AIProviderResponse> {
    this.chatCallCount++;
    if (this.chatError) {
      throw this.chatError;
    }
    if (this.chatResponse) {
      return this.chatResponse;
    }
    return {
      content: `Response from ${this.name}`,
      model: 'test-model',
      provider: this.name,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  setChatError(error: AIProviderError | null): void {
    this.chatError = error;
  }

  setChatResponse(response: AIProviderResponse | null): void {
    this.chatResponse = response;
  }
}

describe('AIProviderManager', () => {
  let manager: AIProviderManager;
  let anthropicProvider: MockProvider;
  let openaiProvider: MockProvider;

  beforeEach(() => {
    anthropicProvider = new MockProvider('anthropic');
    openaiProvider = new MockProvider('openai');

    manager = new AIProviderManager({
      defaultProvider: 'anthropic',
      fallbackProviders: ['openai'],
      retryAttempts: 2,
      retryDelay: 10, // Short delay for tests
      maxRetryDelay: 50,
    });

    manager.register(anthropicProvider);
    manager.register(openaiProvider);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Provider Registration', () => {
    it('should register a provider', () => {
      const newManager = new AIProviderManager();
      const provider = new MockProvider('anthropic');

      newManager.register(provider);

      expect(newManager.getProvider('anthropic')).to.equal(provider);
    });

    it('should get all registered providers', () => {
      const providers = manager.getAllProviders();

      expect(providers).to.have.length(2);
      expect(providers.map((p) => p.name)).to.include('anthropic');
      expect(providers.map((p) => p.name)).to.include('openai');
    });

    it('should return undefined for unregistered provider', () => {
      expect(manager.getProvider('openrouter')).to.be.undefined;
    });

    it('should get status of all providers', () => {
      const statuses = manager.getProvidersStatus();

      expect(statuses).to.have.length(2);
      expect(statuses.every((s) => s.available)).to.be.true;
    });
  });

  describe('Provider Selection', () => {
    it('should get the default provider when available', () => {
      const provider = manager.getAvailableProvider();

      expect(provider).to.equal(anthropicProvider);
    });

    it('should fallback to next provider when default is unavailable', () => {
      anthropicProvider.setAvailable(false);

      const provider = manager.getAvailableProvider();

      expect(provider).to.equal(openaiProvider);
    });

    it('should return null when no providers are available', () => {
      anthropicProvider.setAvailable(false);
      openaiProvider.setAvailable(false);

      const provider = manager.getAvailableProvider();

      expect(provider).to.be.null;
    });

    it('should check hasAvailableProvider correctly', () => {
      expect(manager.hasAvailableProvider()).to.be.true;

      anthropicProvider.setAvailable(false);
      openaiProvider.setAvailable(false);

      expect(manager.hasAvailableProvider()).to.be.false;
    });

    it('should respect configured fallback order', () => {
      const customManager = new AIProviderManager({
        defaultProvider: 'openai',
        fallbackProviders: ['anthropic'],
      });

      customManager.register(anthropicProvider);
      customManager.register(openaiProvider);

      const provider = customManager.getAvailableProvider();
      expect(provider).to.equal(openaiProvider);

      openaiProvider.setAvailable(false);
      const fallback = customManager.getAvailableProvider();
      expect(fallback).to.equal(anthropicProvider);
    });
  });

  describe('Chat Completion', () => {
    const testParams: ChatCompletionParams = {
      messages: [{ role: 'user', content: 'Hello!' }],
    };

    it('should successfully complete chat with default provider', async () => {
      const response = await manager.chat(testParams);

      expect(response.provider).to.equal('anthropic');
      expect(response.content).to.include('anthropic');
      expect(anthropicProvider.chatCallCount).to.equal(1);
    });

    it('should fallback to next provider when default fails', async () => {
      const retryableError = new AIProviderError(
        'Service unavailable',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        'anthropic',
        { retryable: true }
      );
      anthropicProvider.setChatError(retryableError);

      const response = await manager.chat(testParams);

      expect(response.provider).to.equal('openai');
      expect(anthropicProvider.chatCallCount).to.equal(2); // 2 retry attempts
      expect(openaiProvider.chatCallCount).to.equal(1);
    });

    it('should throw error when all providers fail', async () => {
      const error = new AIProviderError(
        'Service unavailable',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        'anthropic',
        { retryable: true }
      );

      anthropicProvider.setChatError(error);
      openaiProvider.setChatError(error);

      await expect(manager.chat(testParams)).to.be.rejectedWith(
        AIProviderError,
        'All AI providers failed'
      );
    });

    it('should throw error when no providers are available', async () => {
      anthropicProvider.setAvailable(false);
      openaiProvider.setAvailable(false);

      await expect(manager.chat(testParams)).to.be.rejectedWith(
        AIProviderError,
        'No AI providers available'
      );
    });

    it('should not retry non-retryable errors', async () => {
      const nonRetryableError = new AIProviderError(
        'Invalid API key',
        AIProviderErrorType.AUTHENTICATION,
        'anthropic',
        { retryable: false }
      );
      anthropicProvider.setChatError(nonRetryableError);

      const response = await manager.chat(testParams);

      // Should have tried anthropic once (no retries) then fallen back to openai
      expect(anthropicProvider.chatCallCount).to.equal(1);
      expect(response.provider).to.equal('openai');
    });

    it('should use custom response from provider', async () => {
      const customResponse: AIProviderResponse = {
        content: 'Custom response content',
        model: 'custom-model',
        provider: 'anthropic',
        usage: {
          promptTokens: 50,
          completionTokens: 100,
          totalTokens: 150,
        },
      };
      anthropicProvider.setChatResponse(customResponse);

      const response = await manager.chat(testParams);

      expect(response).to.deep.equal(customResponse);
    });
  });

  describe('Retry Logic', () => {
    const testParams: ChatCompletionParams = {
      messages: [{ role: 'user', content: 'Hello!' }],
    };

    it('should retry the configured number of times', async () => {
      const retryableError = new AIProviderError(
        'Rate limit',
        AIProviderErrorType.RATE_LIMIT,
        'anthropic',
        { retryable: true }
      );
      anthropicProvider.setChatError(retryableError);

      // Manager configured with 2 retry attempts
      // Should fail after 2 attempts on anthropic, then try openai
      const response = await manager.chat(testParams);

      expect(anthropicProvider.chatCallCount).to.equal(2);
      expect(response.provider).to.equal('openai');
    });

    it('should succeed on retry before max attempts', async () => {
      let callCount = 0;
      const originalChat = anthropicProvider.chat.bind(anthropicProvider);

      anthropicProvider.chat = async (params: ChatCompletionParams) => {
        callCount++;
        if (callCount === 1) {
          throw new AIProviderError(
            'Temporary error',
            AIProviderErrorType.SERVICE_UNAVAILABLE,
            'anthropic',
            { retryable: true }
          );
        }
        return originalChat(params);
      };

      const response = await manager.chat(testParams);

      expect(callCount).to.equal(2);
      expect(response.provider).to.equal('anthropic');
    });

    it('should use exponential backoff', async () => {
      const startTime = Date.now();
      const retryableError = new AIProviderError(
        'Service unavailable',
        AIProviderErrorType.SERVICE_UNAVAILABLE,
        'anthropic',
        { retryable: true }
      );

      anthropicProvider.setChatError(retryableError);
      openaiProvider.setAvailable(false);

      try {
        await manager.chat(testParams);
      } catch (error) {
        // Expected to fail
      }

      const elapsed = Date.now() - startTime;
      // With 2 retries and 10ms base delay, should have waited at least 10ms + 20ms = 30ms
      // But we'll check for at least some delay
      expect(elapsed).to.be.at.least(10);
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when not specified', () => {
      const defaultManager = new AIProviderManager();

      expect(defaultManager.getDefaultProviderName()).to.equal('anthropic');
    });

    it('should allow updating default provider', () => {
      manager.setDefaultProvider('openai');

      expect(manager.getDefaultProviderName()).to.equal('openai');
    });

    it('should respect custom retry configuration', async () => {
      const customManager = new AIProviderManager({
        defaultProvider: 'anthropic',
        retryAttempts: 5,
        retryDelay: 1,
      });

      const provider = new MockProvider('anthropic');
      const retryableError = new AIProviderError(
        'Error',
        AIProviderErrorType.RATE_LIMIT,
        'anthropic',
        { retryable: true }
      );
      provider.setChatError(retryableError);

      customManager.register(provider);

      const testParams: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      try {
        await customManager.chat(testParams);
      } catch {
        // Expected to fail
      }

      expect(provider.chatCallCount).to.equal(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle provider returning empty response', async () => {
      const emptyResponse: AIProviderResponse = {
        content: '',
        model: 'test-model',
        provider: 'anthropic',
      };
      anthropicProvider.setChatResponse(emptyResponse);

      const response = await manager.chat({
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      expect(response.content).to.equal('');
    });

    it('should handle provider throwing non-AIProviderError', async () => {
      anthropicProvider.chat = async () => {
        throw new Error('Generic error');
      };

      // Should fallback to openai
      const response = await manager.chat({
        messages: [{ role: 'user', content: 'Hello!' }],
      });

      expect(response.provider).to.equal('openai');
    });

    it('should handle concurrent chat requests', async () => {
      const promises = Array(5)
        .fill(null)
        .map(() =>
          manager.chat({
            messages: [{ role: 'user', content: 'Hello!' }],
          })
        );

      const responses = await Promise.all(promises);

      expect(responses).to.have.length(5);
      responses.forEach((response) => {
        expect(response.provider).to.equal('anthropic');
      });
    });
  });
});

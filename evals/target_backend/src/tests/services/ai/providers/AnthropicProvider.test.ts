import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import Anthropic from '@anthropic-ai/sdk';
import {
  AnthropicProvider,
  AnthropicProviderConfig,
} from '../../../../services/ai/providers/AnthropicProvider';
import {
  AIProviderError,
  AIProviderErrorType,
  ChatCompletionParams,
} from '../../../../services/ai/providers/types';

use(chaiAsPromised);

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let anthropicStub: sinon.SinonStub;

  const validConfig: AnthropicProviderConfig = {
    name: 'anthropic',
    apiKey: 'test-api-key',
    defaultModel: 'claude-3-5-sonnet-20241022',
    maxTokens: 1024,
    temperature: 0.7,
  };

  const mockSuccessResponse = {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    content: [
      {
        type: 'text',
        text: '{"action": "Water the plant", "reason": "Soil is dry", "confidence": 0.9}',
      },
    ],
    model: 'claude-3-5-sonnet-20241022',
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };

  beforeEach(() => {
    provider = new AnthropicProvider(validConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(provider.name).to.equal('anthropic');
    });

    it('should throw error if default model is not provided', () => {
      const invalidConfig = {
        name: 'anthropic' as const,
        apiKey: 'test-key',
        defaultModel: '',
      };

      expect(() => new AnthropicProvider(invalidConfig)).to.throw(
        'Default model is required'
      );
    });

    it('should not initialize client without API key', () => {
      const noKeyConfig: AnthropicProviderConfig = {
        name: 'anthropic',
        apiKey: '',
        defaultModel: 'claude-3-5-sonnet-20241022',
      };

      const providerNoKey = new AnthropicProvider(noKeyConfig);
      expect(providerNoKey.isAvailable()).to.be.false;
    });
  });

  describe('isAvailable()', () => {
    it('should return true when API key is configured', () => {
      expect(provider.isAvailable()).to.be.true;
    });

    it('should return false when API key is missing', () => {
      const noKeyProvider = new AnthropicProvider({
        ...validConfig,
        apiKey: '',
      });
      expect(noKeyProvider.isAvailable()).to.be.false;
    });
  });

  describe('getStatus()', () => {
    it('should return available status when configured', () => {
      const status = provider.getStatus();

      expect(status.name).to.equal('anthropic');
      expect(status.available).to.be.true;
      expect(status.message).to.include('ready');
      expect(status.lastChecked).to.be.instanceOf(Date);
    });

    it('should return unavailable status when not configured', () => {
      const noKeyProvider = new AnthropicProvider({
        ...validConfig,
        apiKey: '',
      });
      const status = noKeyProvider.getStatus();

      expect(status.available).to.be.false;
      expect(status.message).to.include('not available');
    });
  });

  describe('chat()', () => {
    beforeEach(() => {
      // Stub the Anthropic client's messages.create method
      anthropicStub = sinon.stub();
      (provider as any).client = {
        messages: {
          create: anthropicStub,
        },
      };
    });

    it('should successfully make a chat request', async () => {
      anthropicStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
        systemPrompt: 'You are a helpful assistant.',
      };

      const response = await provider.chat(params);

      expect(response.content).to.include('Water the plant');
      expect(response.provider).to.equal('anthropic');
      expect(response.model).to.equal('claude-3-5-sonnet-20241022');
      expect(response.usage).to.deep.equal({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('should use default model from config', async () => {
      anthropicStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await provider.chat(params);

      expect(anthropicStub.calledOnce).to.be.true;
      const callArgs = anthropicStub.firstCall.args[0];
      expect(callArgs.model).to.equal('claude-3-5-sonnet-20241022');
    });

    it('should allow model override in params', async () => {
      anthropicStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
        model: 'claude-3-opus-20240229',
      };

      await provider.chat(params);

      const callArgs = anthropicStub.firstCall.args[0];
      expect(callArgs.model).to.equal('claude-3-opus-20240229');
    });

    it('should separate system messages correctly', async () => {
      anthropicStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [
          { role: 'system', content: 'System message 1' },
          { role: 'system', content: 'System message 2' },
          { role: 'user', content: 'User message' },
        ],
      };

      await provider.chat(params);

      const callArgs = anthropicStub.firstCall.args[0];
      expect(callArgs.system).to.include('System message 1');
      expect(callArgs.system).to.include('System message 2');
      expect(callArgs.messages).to.have.length(1);
      expect(callArgs.messages[0].role).to.equal('user');
    });

    it('should throw error when provider is not available', async () => {
      const unavailableProvider = new AnthropicProvider({
        ...validConfig,
        apiKey: '',
      });

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(unavailableProvider.chat(params)).to.be.rejectedWith(
        AIProviderError,
        'not available'
      );
    });

    it('should throw error when no user messages provided', async () => {
      const params: ChatCompletionParams = {
        messages: [{ role: 'system', content: 'System only' }],
      };

      await expect(provider.chat(params)).to.be.rejectedWith(
        AIProviderError,
        'At least one user message is required'
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      anthropicStub = sinon.stub();
      (provider as any).client = {
        messages: {
          create: anthropicStub,
        },
      };
    });

    it('should handle authentication errors (401)', async () => {
      const authError = Object.assign(new Error('Invalid API key'), {
        status: 401,
        message: 'Invalid API key',
      });
      Object.setPrototypeOf(authError, Anthropic.APIError.prototype);
      anthropicStub.rejects(authError);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      try {
        await provider.chat(params);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(AIProviderError);
        expect((error as AIProviderError).type).to.equal(AIProviderErrorType.AUTHENTICATION);
        expect((error as AIProviderError).statusCode).to.equal(401);
        expect((error as AIProviderError).retryable).to.be.false;
      }
    });

    it('should handle rate limit errors (429)', async () => {
      const rateLimitError = Object.assign(new Error('Rate limit exceeded'), {
        status: 429,
        message: 'Rate limit exceeded',
      });
      Object.setPrototypeOf(rateLimitError, Anthropic.APIError.prototype);
      anthropicStub.rejects(rateLimitError);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      try {
        await provider.chat(params);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(AIProviderError);
        expect((error as AIProviderError).type).to.equal(AIProviderErrorType.RATE_LIMIT);
        expect((error as AIProviderError).statusCode).to.equal(429);
        expect((error as AIProviderError).retryable).to.be.true;
      }
    });

    it('should handle server errors (500)', async () => {
      const serverError = Object.assign(new Error('Internal server error'), {
        status: 500,
        message: 'Internal server error',
      });
      Object.setPrototypeOf(serverError, Anthropic.APIError.prototype);
      anthropicStub.rejects(serverError);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      try {
        await provider.chat(params);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(AIProviderError);
        expect((error as AIProviderError).type).to.equal(AIProviderErrorType.SERVICE_UNAVAILABLE);
        expect((error as AIProviderError).statusCode).to.equal(500);
        expect((error as AIProviderError).retryable).to.be.true;
      }
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      anthropicStub.rejects(networkError);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      try {
        await provider.chat(params);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(AIProviderError);
        expect((error as AIProviderError).type).to.equal(AIProviderErrorType.NETWORK);
        expect((error as AIProviderError).retryable).to.be.true;
      }
    });

    it('should handle missing text content in response', async () => {
      const noTextResponse = {
        ...mockSuccessResponse,
        content: [{ type: 'image', data: 'base64data' }],
      };
      anthropicStub.resolves(noTextResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(provider.chat(params)).to.be.rejectedWith(
        AIProviderError,
        'No text content'
      );
    });
  });
});

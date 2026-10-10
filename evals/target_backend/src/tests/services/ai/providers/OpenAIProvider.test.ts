import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import OpenAI from 'openai';
import {
  OpenAIProvider,
  OpenAIProviderConfig,
} from '../../../../services/ai/providers/OpenAIProvider';
import {
  AIProviderError,
  AIProviderErrorType,
  ChatCompletionParams,
} from '../../../../services/ai/providers/types';

use(chaiAsPromised);

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let openaiStub: sinon.SinonStub;

  const validConfig: OpenAIProviderConfig = {
    name: 'openai',
    apiKey: 'test-api-key',
    defaultModel: 'gpt-4-turbo-preview',
    maxTokens: 1024,
    temperature: 0.7,
  };

  const mockSuccessResponse = {
    id: 'chatcmpl-123',
    object: 'chat.completion',
    created: Date.now(),
    model: 'gpt-4-turbo-preview',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: '{"action": "Water the plant", "reason": "Soil is dry", "confidence": 0.9}',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };

  beforeEach(() => {
    provider = new OpenAIProvider(validConfig);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(provider.name).to.equal('openai');
    });

    it('should throw error if default model is not provided', () => {
      const invalidConfig = {
        name: 'openai' as const,
        apiKey: 'test-key',
        defaultModel: '',
      };

      expect(() => new OpenAIProvider(invalidConfig)).to.throw(
        'Default model is required'
      );
    });

    it('should not initialize client without API key', () => {
      const noKeyConfig: OpenAIProviderConfig = {
        name: 'openai',
        apiKey: '',
        defaultModel: 'gpt-4-turbo-preview',
      };

      const providerNoKey = new OpenAIProvider(noKeyConfig);
      expect(providerNoKey.isAvailable()).to.be.false;
    });
  });

  describe('isAvailable()', () => {
    it('should return true when API key is configured', () => {
      expect(provider.isAvailable()).to.be.true;
    });

    it('should return false when API key is missing', () => {
      const noKeyProvider = new OpenAIProvider({
        ...validConfig,
        apiKey: '',
      });
      expect(noKeyProvider.isAvailable()).to.be.false;
    });
  });

  describe('getStatus()', () => {
    it('should return available status when configured', () => {
      const status = provider.getStatus();

      expect(status.name).to.equal('openai');
      expect(status.available).to.be.true;
      expect(status.message).to.include('ready');
      expect(status.lastChecked).to.be.instanceOf(Date);
    });

    it('should return unavailable status when not configured', () => {
      const noKeyProvider = new OpenAIProvider({
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
      // Stub the OpenAI client's chat.completions.create method
      openaiStub = sinon.stub();
      (provider as any).client = {
        chat: {
          completions: {
            create: openaiStub,
          },
        },
      };
    });

    it('should successfully make a chat request', async () => {
      openaiStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
        systemPrompt: 'You are a helpful assistant.',
      };

      const response = await provider.chat(params);

      expect(response.content).to.include('Water the plant');
      expect(response.provider).to.equal('openai');
      expect(response.model).to.equal('gpt-4-turbo-preview');
      expect(response.usage).to.deep.equal({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('should use default model from config', async () => {
      openaiStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await provider.chat(params);

      expect(openaiStub.calledOnce).to.be.true;
      const callArgs = openaiStub.firstCall.args[0];
      expect(callArgs.model).to.equal('gpt-4-turbo-preview');
    });

    it('should allow model override in params', async () => {
      openaiStub.resolves({
        ...mockSuccessResponse,
        model: 'gpt-4o',
      });

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
        model: 'gpt-4o',
      };

      await provider.chat(params);

      const callArgs = openaiStub.firstCall.args[0];
      expect(callArgs.model).to.equal('gpt-4o');
    });

    it('should include system messages inline', async () => {
      openaiStub.resolves(mockSuccessResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'User message' }],
        systemPrompt: 'You are a helpful assistant.',
      };

      await provider.chat(params);

      const callArgs = openaiStub.firstCall.args[0];
      // OpenAI accepts system messages inline in the messages array
      expect(callArgs.messages[0].role).to.equal('system');
      expect(callArgs.messages[0].content).to.equal('You are a helpful assistant.');
      expect(callArgs.messages[1].role).to.equal('user');
    });

    it('should throw error when provider is not available', async () => {
      const unavailableProvider = new OpenAIProvider({
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

    it('should handle empty choices in response', async () => {
      const emptyChoicesResponse = {
        ...mockSuccessResponse,
        choices: [],
      };
      openaiStub.resolves(emptyChoicesResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(provider.chat(params)).to.be.rejectedWith(
        AIProviderError,
        'No content'
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      openaiStub = sinon.stub();
      (provider as any).client = {
        chat: {
          completions: {
            create: openaiStub,
          },
        },
      };
    });

    it('should handle authentication errors (401)', async () => {
      const authError = Object.assign(new Error('Invalid API key'), {
        status: 401,
        message: 'Invalid API key',
      });
      Object.setPrototypeOf(authError, OpenAI.APIError.prototype);
      openaiStub.rejects(authError);

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
      Object.setPrototypeOf(rateLimitError, OpenAI.APIError.prototype);
      openaiStub.rejects(rateLimitError);

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
      Object.setPrototypeOf(serverError, OpenAI.APIError.prototype);
      openaiStub.rejects(serverError);

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

    it('should handle model not found errors', async () => {
      const modelError = Object.assign(new Error('The model `invalid-model` does not exist'), {
        status: 400,
        message: 'The model `invalid-model` does not exist',
      });
      Object.setPrototypeOf(modelError, OpenAI.APIError.prototype);
      openaiStub.rejects(modelError);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
        model: 'invalid-model',
      };

      try {
        await provider.chat(params);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(AIProviderError);
        expect((error as AIProviderError).type).to.equal(AIProviderErrorType.MODEL_NOT_FOUND);
        expect((error as AIProviderError).retryable).to.be.false;
      }
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      openaiStub.rejects(networkError);

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

    it('should handle missing content in response', async () => {
      const noContentResponse = {
        ...mockSuccessResponse,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
            },
            finish_reason: 'stop',
          },
        ],
      };
      openaiStub.resolves(noContentResponse);

      const params: ChatCompletionParams = {
        messages: [{ role: 'user', content: 'Hello!' }],
      };

      await expect(provider.chat(params)).to.be.rejectedWith(
        AIProviderError,
        'No content'
      );
    });
  });
});

/**
 * AI Services
 *
 * Modular AI services following the separation of concerns pattern.
 * Each service domain includes: ContextBuilder, PromptBuilder, and Service classes.
 *
 * Service Domains:
 * - core/ - Base classes and utilities shared across all AI services
 * - garden/ - Garden layout analysis and optimization recommendations
 * - plant/ - Individual plant care recommendations
 * - weather/ - Weather-based action recommendations
 * - care/ - Comprehensive care schedule generation
 * - pest/ - Pest and disease diagnosis with treatment plans
 *
 * To add a new service: Follow the pattern in .claude/ai-services-standards.md
 */

// Core exports
export * from './core';

// Domain-specific service exports
export * from './garden';
export * from './plant';
export * from './weather';
export * from './care';
export * from './pest';

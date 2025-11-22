/**
 * Base PromptBuilder class with fluent API
 */

import { defaultContext, loadTemplate, templateNames } from "./loader.js";
import type {
  CompileOptions,
  CompiledPrompt,
  ModelType,
  PromptContext,
  PromptSection,
  RoleType,
  SectionPriority,
} from "./types.js";

/**
 * Estimate tokens from text (simple approximation: ~4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Base class for building prompts with fluent API
 */
export class PromptBuilder {
  protected sections: PromptSection[] = [];
  protected context: PromptContext = {
    botName: "@duyetbot",
    creator: "Duyet Le",
  };
  protected constraints: string[] = [];
  protected model: ModelType = "sonnet";

  /**
   * Get template context for interpolation
   */
  protected getTemplateContext(): { botName: string; creator: string } {
    return {
      botName: this.context.botName ?? defaultContext.botName ?? "@duyetbot",
      creator: this.context.creator ?? defaultContext.creator ?? "Duyet Le",
    };
  }

  /**
   * Set the assistant role
   */
  addRole(role: RoleType): this {
    const roleTemplates: Record<RoleType, string> = {
      assistant: templateNames.roleAssistant,
      researcher: templateNames.roleResearcher,
      reviewer: templateNames.roleReviewer,
      explainer: templateNames.roleExplainer,
    };

    this.addSection({
      name: "role",
      content: loadTemplate(roleTemplates[role], this.getTemplateContext()),
      priority: "critical",
    });

    return this;
  }

  /**
   * Add capabilities section
   */
  addCapabilities(): this {
    this.addSection({
      name: "capabilities",
      content: loadTemplate(
        templateNames.capabilities,
        this.getTemplateContext(),
      ),
      priority: "important",
    });
    return this;
  }

  /**
   * Add creator info section
   */
  addCreatorInfo(): this {
    this.addSection({
      name: "creator_info",
      content: loadTemplate(
        templateNames.creatorInfo,
        this.getTemplateContext(),
      ),
      priority: "optional",
    });
    return this;
  }

  /**
   * Add code guidelines section
   */
  addCodeGuidelines(): this {
    this.addSection({
      name: "code_guidelines",
      content: loadTemplate(
        templateNames.codeGuidelines,
        this.getTemplateContext(),
      ),
      priority: "important",
    });
    return this;
  }

  /**
   * Add response guidelines section
   */
  addResponseGuidelines(): this {
    this.addSection({
      name: "response_guidelines",
      content: loadTemplate(
        templateNames.responseGuidelines,
        this.getTemplateContext(),
      ),
      priority: "important",
    });
    return this;
  }

  /**
   * Add context variables
   */
  addContext(ctx: PromptContext): this {
    this.context = { ...this.context, ...ctx };
    return this;
  }

  /**
   * Add behavioral constraints
   */
  addConstraints(constraints: string[]): this {
    this.constraints.push(...constraints);
    return this;
  }

  /**
   * Add a single constraint
   */
  addConstraint(constraint: string): this {
    this.constraints.push(constraint);
    return this;
  }

  /**
   * Add a custom section
   */
  addSection(section: PromptSection): this {
    section.tokenEstimate = estimateTokens(section.content);
    this.sections.push(section);
    return this;
  }

  /**
   * Add custom text as a section
   */
  addText(
    name: string,
    content: string,
    priority: SectionPriority = "important",
  ): this {
    return this.addSection({ name, content, priority });
  }

  /**
   * Set the target model
   */
  withModel(model: ModelType): this {
    this.model = model;
    this.context.model = model;
    return this;
  }

  /**
   * Get current model
   */
  getModel(): ModelType {
    return this.model;
  }

  /**
   * Compile the prompt into a string
   */
  compile(options: CompileOptions = {}): string {
    const result = this.compileWithMetadata(options);
    return result.text;
  }

  /**
   * Compile with full metadata
   */
  compileWithMetadata(options: CompileOptions = {}): CompiledPrompt {
    const { maxTokens, truncateOptional = true, separator = "\n\n" } = options;

    const sections = [...this.sections];
    const truncated: string[] = [];

    // Add constraints as a section if any exist
    if (this.constraints.length > 0) {
      const constraintsContent = this.constraints
        .map((c) => `- ${c}`)
        .join("\n");
      sections.push({
        name: "constraints",
        content: constraintsContent,
        priority: "important",
        tokenEstimate: estimateTokens(constraintsContent),
      });
    }

    // Sort by priority: critical > important > optional
    const priorityOrder: Record<SectionPriority, number> = {
      critical: 0,
      important: 1,
      optional: 2,
    };
    sections.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );

    // Truncate if over token limit
    if (maxTokens && truncateOptional) {
      let totalTokens = sections.reduce(
        (sum, s) => sum + (s.tokenEstimate || 0),
        0,
      );

      while (totalTokens > maxTokens && sections.length > 0) {
        // Remove optional sections first, then important
        const optionalIdx = sections.findIndex(
          (s) => s.priority === "optional",
        );
        if (optionalIdx !== -1) {
          const section = sections[optionalIdx];
          if (section) {
            truncated.push(section.name);
            totalTokens -= section.tokenEstimate || 0;
            sections.splice(optionalIdx, 1);
          }
        } else {
          const importantIdx = sections.findIndex(
            (s) => s.priority === "important",
          );
          if (importantIdx !== -1) {
            const section = sections[importantIdx];
            if (section) {
              truncated.push(section.name);
              totalTokens -= section.tokenEstimate || 0;
              sections.splice(importantIdx, 1);
            }
          } else {
            break; // Don't remove critical sections
          }
        }
      }
    }

    const text = sections.map((s) => s.content).join(separator);

    return {
      text,
      tokenEstimate: estimateTokens(text),
      sections: sections.map((s) => s.name),
      truncated,
    };
  }

  /**
   * Estimate total tokens
   */
  estimateTokens(): number {
    return this.compileWithMetadata().tokenEstimate;
  }

  /**
   * Clone this builder
   */
  clone(): PromptBuilder {
    const builder = new PromptBuilder();
    builder.sections = [...this.sections];
    builder.context = { ...this.context };
    builder.constraints = [...this.constraints];
    builder.model = this.model;
    return builder;
  }

  /**
   * Clear all sections
   */
  clear(): this {
    this.sections = [];
    this.constraints = [];
    return this;
  }
}

/**
 * Create a new PromptBuilder instance
 */
export function createPromptBuilder(): PromptBuilder {
  return new PromptBuilder();
}

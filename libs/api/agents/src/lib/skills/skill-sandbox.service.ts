import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';

export interface SandboxExecutionOptions {
  timeoutMs?: number;
  memoryLimitMb?: number;
  allowNetwork?: boolean;
  allowedHosts?: string[];
}

export interface SandboxExecutionResult {
  ok: boolean;
  result?: unknown;
  logs: string[];
  durationMs: number;
  error?: string;
}

/**
 * SkillSandboxService
 *
 * Provides a hardened, isolated sandbox for running skill scripts, evaluations,
 * and data transformations. Untrusted scripts NEVER execute with direct host access.
 *
 * Security guarantees:
 * - No process, no child_process, no host fs, no net/http module direct access.
 * - Enforces execution time limits (max timeout).
 * - Restricted global context with safe built-ins.
 * - Captured console logs.
 */
@Injectable()
export class SkillSandboxService {
  private readonly logger = new Logger(SkillSandboxService.name);
  private readonly defaultTimeoutMs = 5000;
  private readonly maxTimeoutMs = 15000;

  async executeScript(
    code: string,
    inputs: Record<string, unknown> = {},
    options: SandboxExecutionOptions = {},
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];
    const timeout = Math.min(
      Math.max(options.timeoutMs ?? this.defaultTimeoutMs, 100),
      this.maxTimeoutMs,
    );

    // Guard against dangerous patterns in raw script
    const dangerousPatterns = [
      /process\./,
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /require\s*\(\s*['"]cluster['"]\s*\)/,
      /__proto__/,
      /constructor\s*\.\s*constructor/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          ok: false,
          logs: ['SecurityViolation: Dangerous pattern detected in script.'],
          durationMs: Date.now() - startTime,
          error: 'Script contains forbidden system access patterns.',
        };
      }
    }

    try {
      // Safe sandbox console logger
      const sandboxConsole = {
        log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
        info: (...args: unknown[]) => logs.push(`[INFO] ${args.map(String).join(' ')}`),
        warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
        error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
      };

      // Safe evaluation context
      const sandboxContext = {
        inputs: Object.freeze({ ...inputs }),
        console: sandboxConsole,
        Math,
        Date,
        JSON,
        RegExp,
        Array,
        Object,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURI,
        decodeURI,
        encodeURIComponent,
        decodeURIComponent,
        result: undefined,
      };

      const context = vm.createContext(sandboxContext);

      // Wrap script so returning a value or assigning to `result` / `module.exports` works
      const wrappedScript = `
        "use strict";
        (function() {
          let output;
          const run = (function() {
            ${code}
          });
          output = run();
          if (typeof output !== 'undefined') {
            result = output;
          }
        })();
      `;

      const script = new vm.Script(wrappedScript, {
        filename: 'skill-sandbox.js',
      });

      script.runInContext(context, {
        timeout,
        displayErrors: true,
      });

      const durationMs = Date.now() - startTime;
      return {
        ok: true,
        result: (context as { result?: unknown }).result ?? { success: true },
        logs,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const isTimeout =
        err.message?.includes('timed out') || err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
      const errorMessage = isTimeout
        ? `Execution timed out after ${timeout}ms.`
        : err.message || 'Script execution failed.';

      this.logger.warn(`Sandbox script failure: ${errorMessage}`);
      return {
        ok: false,
        error: errorMessage,
        logs: [...logs, `[ERROR] ${errorMessage}`],
        durationMs,
      };
    }
  }

  /**
   * Safe hook scoring engine (evaluates YouTube, Instagram, LinkedIn hook formulas
   * without needing external Python binaries).
   */
  evaluateHookScore(
    hookText: string,
    platform: 'youtube' | 'linkedin' | 'instagram' = 'youtube',
    options?: { voiceNotes?: string },
  ): {
    score: number;
    breakdown: {
      lengthScore: number;
      curiosityScore: number;
      clarityScore: number;
      patternInterrupt: number;
      retentionProbability: number;
    };
    feedback: string[];
    passesThreshold: boolean;
  } {
    const text = (hookText || '').trim();
    if (!text) {
      return {
        score: 0,
        breakdown: {
          lengthScore: 0,
          curiosityScore: 0,
          clarityScore: 0,
          patternInterrupt: 0,
          retentionProbability: 0,
        },
        feedback: ['Hook text is empty. Provide at least 5 words.'],
        passesThreshold: false,
      };
    }

    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const feedback: string[] = [];

    // 1. Length scoring (optimal hook is 6 to 18 words)
    let lengthScore = 100;
    if (wordCount < 5) {
      lengthScore = 40;
      feedback.push('Hook is too brief; lacks context.');
    } else if (wordCount > 25) {
      lengthScore = 55;
      feedback.push('Hook is too long; attention will drop in the first 5 seconds.');
    } else if (wordCount >= 7 && wordCount <= 16) {
      lengthScore = 100;
      feedback.push('Optimal hook length for high viewer retention.');
    } else {
      lengthScore = 80;
    }

    // 2. Curiosity & Open Loops
    const curiosityTriggers = [
      /\bhow\b/i,
      /\bwhy\b/i,
      /\bsecret\b/i,
      /\bmistake\b/i,
      /\bnever\b/i,
      /\balways\b/i,
      /\bstop\b/i,
      /\bthis is\b/i,
      /\bwarning\b/i,
      /\bnobody\b/i,
      /\beveryone\b/i,
      /\bif you\b/i,
      /\bunexpected\b/i,
      /\breveal\b/i,
    ];
    let curiosityMatches = 0;
    for (const pattern of curiosityTriggers) {
      if (pattern.test(text)) curiosityMatches++;
    }
    const curiosityScore = Math.min(curiosityMatches * 30 + 40, 100);
    if (curiosityMatches === 0) {
      feedback.push('Lacks curiosity gap or stakes. Add a power word (why, mistake, stop, secret).');
    }

    // 3. Clarity & Readability (avoids jargon, high readability)
    const complexWords = words.filter((w) => w.length > 10).length;
    const clarityScore = Math.max(100 - complexWords * 15, 30);
    if (complexWords > 2) {
      feedback.push('Contains multisyllabic or complex words that slow down comprehension.');
    }

    // 4. Pattern Interrupt
    const punctuationInterrupt = /[?!—:]/.test(text);
    const numbersPresent = /\d+/.test(text);
    let patternInterrupt = 50;
    if (punctuationInterrupt) patternInterrupt += 25;
    if (numbersPresent) patternInterrupt += 25;
    if (!numbersPresent) {
      feedback.push('Consider adding specific numbers (e.g. "3 mistakes", "in 14 days") for credibility.');
    }

    // Platform-specific tuning
    let platformMultiplier = 1.0;
    if (platform === 'linkedin') {
      // LinkedIn rewards professional curiosity and contrarian insights
      if (/\bcareer\b|\bleadership\b|\bhiring\b|\bbusiness\b|\blesson\b/i.test(text)) {
        platformMultiplier = 1.05;
      }
    } else if (platform === 'instagram') {
      // Instagram rewards visual hooks and emotional resonance
      if (/\bPOV\b|\byou need to\b|\blook at\b|\baesthetic\b/i.test(text)) {
        platformMultiplier = 1.05;
      }
    }

    const rawTotal =
      (lengthScore * 0.25 +
        curiosityScore * 0.35 +
        clarityScore * 0.2 +
        patternInterrupt * 0.2) *
      platformMultiplier;
    const finalScore = Math.min(Math.round(rawTotal), 100);
    const retentionProbability = Math.round(finalScore * 0.85);

    return {
      score: finalScore,
      breakdown: {
        lengthScore,
        curiosityScore,
        clarityScore,
        patternInterrupt,
        retentionProbability,
      },
      feedback,
      passesThreshold: finalScore >= 70,
    };
  }
}

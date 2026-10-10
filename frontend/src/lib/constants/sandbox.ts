import { fTranslate } from '../i18n';
import { BuiltInTool, JsonSchemaType, ToolCallType } from '$lib/enums';
import type { OpenAIToolDefinition } from '$lib/types';

export const SANDBOX_TOOL_NAME = BuiltInTool.RUN_JAVASCRIPT;

export const SANDBOX_TIMEOUT_MS_DEFAULT = 10000;

export const SANDBOX_TIMEOUT_MS_MAX = 30000;

export const SANDBOX_OUTPUT_MAX_CHARS = 8192;

export const SANDBOX_EMPTY_OUTPUT = '(no output)';

export const SANDBOX_TRUNCATION_NOTICE = '[output truncated]';

const NERDAMER_DESCRIPTION = `
Symbolic/numeric math via \`nerdamer\`
nerdamer(expr,subs?,opts?)/nerdamer.func(...)→Expression Format via .text(fmt?) (fmt: 'decimals'|'fractions'|'scientific') eval via .evaluate(subs?)
nerdamer(expr,{x:2}) substitutes numeric via opts 'numer' or .evaluate()
simplify/expand/factor(expr) div/gcd/lcm(...) coeffs/partfrac(expr,var)
diff/integrate(expr,var) defint(expr,lo,hi,var?) sum/product(expr,var,lo,hi) limit(expr,var,pt)
solve(expr,var) solveEquations([eq1,eq2],[var1,var2])
polarform/rectform/arg/realpart/imagpart(z)
set/get Var/Constant(name,val?) setFunction(name,[params],body)
IMPORTANT:Identifier 'nerdamer' has already been declared, use it directly`;

/**
 * Build the sandbox tool definition. When `includeSymbolicMath` is true,
 * the description includes nerdamer API documentation; otherwise it
 * describes a plain JavaScript sandbox.
 */
export function buildSandboxToolDefinition(includeSymbolicMath: boolean): OpenAIToolDefinition {
  return {
    type: ToolCallType.FUNCTION,
    function: {
      name: SANDBOX_TOOL_NAME,
      description: includeSymbolicMath
        ? fTranslate('text_999011ebffd3', { p0: NERDAMER_DESCRIPTION })
        : fTranslate('text_871bcbcae6f4'),
      parameters: {
        type: JsonSchemaType.OBJECT,
        properties: {
          code: {
            type: JsonSchemaType.STRING,
            description: fTranslate('text_8b54c4c622a2')
          },
          timeout_ms: {
            type: JsonSchemaType.NUMBER,
            description: fTranslate('text_d0cd0e2ee0fc', {
              p0: SANDBOX_TIMEOUT_MS_DEFAULT,
              p1: SANDBOX_TIMEOUT_MS_MAX
            })
          }
        },
        required: ['code']
      }
    }
  };
}

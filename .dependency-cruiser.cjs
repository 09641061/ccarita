// Layer and bounded-context rules from the ccarita-ddd skill; `pnpm arch` runs them, as pibble's ArchitectureTest does.
// CONTEXT_MAP mirrors the table in docs/architecture.md; change both in the same commit.

/** Each context and the contexts it may import (through their public-api.ts). Imports go down, never in a cycle. */
const CONTEXT_MAP = {
  iam: [],
  organization: ['iam'],
  customers: [],
  booking: ['organization', 'customers'],
  conversations: ['organization', 'customers', 'booking'],
  assistant: ['organization', 'customers', 'booking', 'conversations'],
  platform: ['iam'],
};

const CONTEXTS = Object.keys(CONTEXT_MAP);
const APP = '^src/app/';
const NOT_SPEC = '\\.spec\\.ts$';
const any = (names) => `(${names.join('|')})`;

const contextMapRules = CONTEXTS.map((context) => {
  const forbidden = CONTEXTS.filter(
    (other) => other !== context && !CONTEXT_MAP[context].includes(other),
  );
  return {
    name: `context-map-${context}`,
    comment: `${context} may import only ${CONTEXT_MAP[context].join(', ') || 'shared'} (docs/architecture.md)`,
    severity: 'error',
    from: { path: `${APP}${context}/` },
    to: { path: `${APP}${any(forbidden.length ? forbidden : ['^$'])}/` },
  };
});

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Imports form no cycle, inside a context or between contexts',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-imports-no-context',
      comment: 'shared is the kernel every context builds on; it never knows a context',
      severity: 'error',
      from: { path: `${APP}shared/` },
      to: { path: `${APP}${any(CONTEXTS)}/` },
    },
    ...contextMapRules,
    {
      name: 'contexts-meet-through-public-api',
      comment: 'Another context is reached only through its public-api.ts, never its folders',
      severity: 'error',
      from: { path: `${APP}${any(CONTEXTS)}/` },
      to: {
        path: `${APP}${any(CONTEXTS)}/`,
        pathNot: [`${APP}$1/`, `${APP}[^/]+/public-api\\.ts$`],
      },
    },
    {
      name: 'domain-is-framework-free',
      comment: 'The domain is plain TypeScript: no Angular, RxJS or translation library',
      severity: 'error',
      from: { path: '/domain/', pathNot: NOT_SPEC },
      to: { pathNot: '^src/' },
    },
    {
      name: 'domain-depends-on-no-outer-layer',
      comment: 'Dependencies point inwards: the domain imports only the domain',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '/(application|infrastructure|presentation)/' },
    },
    {
      name: 'infrastructure-ignores-application-and-presentation',
      comment:
        'Endpoints and assemblers turn pibble resources into domain objects; they know no store or screen',
      severity: 'error',
      from: { path: '/infrastructure/' },
      to: { path: '/(application|presentation)/' },
    },
    {
      name: 'application-ignores-presentation',
      comment: 'Stores hold state and run use cases; they know no component',
      severity: 'error',
      from: { path: '/application/' },
      to: { path: '/presentation/' },
    },
    {
      name: 'presentation-ignores-infrastructure',
      comment:
        'Components read stores and domain objects; HTTP and resources stay behind the store',
      severity: 'error',
      from: { path: '/presentation/', pathNot: NOT_SPEC },
      to: { path: '/infrastructure/' },
    },
    {
      name: 'generated-schema-stays-in-infrastructure',
      comment: 'pibble.schema.ts types are resources; the rest of the app uses domain objects',
      severity: 'error',
      from: { pathNot: ['/infrastructure/', NOT_SPEC] },
      to: { path: 'shared/infrastructure/api/pibble\\.schema\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    exclude: { path: '^src/(main|environments/)' },
  },
};

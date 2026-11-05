/**
 * Valida o adaptador da API configurada em VEHICLE_PROVIDER, chamando-o DIRETO
 * (sem cache) e conferindo se a resposta está no formato que o sistema espera.
 *
 *   npm run provider:check                  # provedor mock, placas de teste
 *   npm run provider:check -- ABC1D23       # placas específicas
 *   npm run provider:check -- ABC1D23 --basic   # só a consulta básica
 *
 * ATENÇÃO: com uma API paga, cada placa testada é uma consulta cobrada.
 * Por isso, fora do mock, é obrigatório informar as placas.
 */
import { createServer, loadEnv } from 'vite';

Object.assign(process.env, { ...loadEnv('development', process.cwd(), ''), ...process.env });

const args = process.argv.slice(2);
const onlyBasic = args.includes('--basic');
const plates = args.filter((a) => !a.startsWith('--')).map((p) => p.toUpperCase().replace(/[^A-Z0-9]/g, ''));

const vite = await createServer({ server: { middlewareMode: true }, logLevel: 'error', appType: 'custom' });
let failed = false;
try {
  const { getProvider } = await vite.ssrLoadModule('/server/providers/index.ts');
  const { validateBasic, validateReport } = await vite.ssrLoadModule('/server/providers/validate.ts');
  const { TEST_PLATES } = await vite.ssrLoadModule('/shared/testPlates.ts');
  const provider = getProvider();

  if (plates.length === 0) {
    if (provider.name !== 'mock') {
      console.error(`\n✖ Informe as placas para testar o provedor "${provider.name}" (cada consulta pode ser cobrada).`);
      console.error('  Ex.: npm run provider:check -- ABC1D23\n');
      process.exit(1);
    }
    plates.push(...TEST_PLATES.map((t) => t.plate));
  }

  console.log(`\nProvedor: ${provider.name} (modo ${provider.mode})\n`);
  for (const plate of plates) {
    const started = Date.now();
    try {
      let basic = null;
      let report = null;
      if (provider.mode === 'full') {
        const full = await provider.getFull(plate);
        basic = full?.basic ?? null;
        report = onlyBasic ? null : (full?.report ?? null);
      } else {
        basic = await provider.getBasic(plate);
        if (!onlyBasic) report = await provider.getReport(plate);
      }
      const ms = Date.now() - started;
      if (!basic) {
        console.log(`• ${plate}: não encontrado (404) — ${ms}ms`);
        continue;
      }
      const problems = [...validateBasic(basic), ...(onlyBasic ? [] : report ? validateReport(report) : ['report: ausente'])];
      if (problems.length) {
        failed = true;
        console.log(`✖ ${plate}: ${problems.length} problema(s) — ${ms}ms`);
        problems.slice(0, 15).forEach((p) => console.log(`    - ${p}`));
      } else {
        console.log(`✔ ${plate}: ${basic.brand} ${basic.model} ${basic.yearModel} — formato OK — ${ms}ms`);
      }
    } catch (err) {
      failed = true;
      console.log(`✖ ${plate}: erro — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
} finally {
  await vite.close();
}
console.log(failed ? '\nResultado: o adaptador PRECISA de ajustes.\n' : '\nResultado: adaptador pronto.\n');
process.exit(failed ? 1 : 0);

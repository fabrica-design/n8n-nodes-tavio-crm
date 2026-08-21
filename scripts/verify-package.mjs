import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedAsset = 'dist/nodes/TavioCrm/tavio-crm-icon.png';
const expectedHash = 'ddb71bf763a7574b9de4e0b00d573a7a6c992ec5120ab44310c1a406cf59c7ac';
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const destination = mkdtempSync(join(tmpdir(), 'tavio-crm-pack-'));
const npmCli = process.env.npm_execpath;

assert(npmCli, 'npm_execpath não está disponível; execute via npm run verify:package');

try {
	const output = execFileSync(
		process.execPath,
		[npmCli, 'pack', '--json', '--pack-destination', destination],
		{
			cwd: packageRoot,
			encoding: 'utf8',
		},
	);
	const [metadata] = JSON.parse(output);

	assert(metadata, 'npm pack não retornou metadados do pacote');
	assert(
		metadata.files.some(({ path }) => path === expectedAsset),
		`${expectedAsset} não foi incluído no pacote`,
	);
	assert(
		!metadata.files.some(({ path }) => path === 'dist/nodes/TavioCrm/tavio-crm.png'),
		'o ícone antigo não pode ser incluído no pacote',
	);

	const archive = join(destination, metadata.filename);
	assert(existsSync(archive), `arquivo .tgz não encontrado em ${archive}`);

	const packagedIcon = readFileSync(join(packageRoot, expectedAsset));
	const packagedHash = createHash('sha256').update(packagedIcon).digest('hex');
	assert.equal(packagedHash, expectedHash, 'o build alterou os bytes do PNG oficial');

	console.log(`OK: ${expectedAsset} presente em ${metadata.filename} com SHA-256 ${packagedHash}`);
} finally {
	rmSync(destination, { recursive: true, force: true });
}

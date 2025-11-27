// scripts/setup-plonk-keys.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

const KEYS_DIR = path.join(__dirname, '../backend/keys/plonk');
const CIRCUIT_NAME = 'transfer';

async function runCommand(command, description) {
  console.log(`\n🔵 ${description}...`);
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: KEYS_DIR });
    if (stderr && !stderr.includes('Everything went okay')) {
      console.log('stderr:', stderr);
    }
    console.log(`✅ ${description} complete`);
    return stdout;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

async function fileExists(filepath) {
  try {
    await fs.promises.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔐 zkUlt PLONK Universal Setup');
  console.log('================================\n');

  // Check if already setup
  const zkeyPath = path.join(KEYS_DIR, `${CIRCUIT_NAME}_final.zkey`);
  if (await fileExists(zkeyPath)) {
    console.log('⚠️  Keys already exist!');
    console.log('Delete them from backend/keys/plonk/ to regenerate.\n');
    return;
  }

  const startTime = Date.now();

  // Step 1: Powers of Tau
  if (!(await fileExists(path.join(KEYS_DIR, 'pot14_0000.ptau')))) {
    await runCommand(
      'snarkjs powersoftau new bn128 14 pot14_0000.ptau -v',
      'Step 1: Generating Powers of Tau'
    );
  } else {
    console.log('⏭️  Using existing pot14_0000.ptau');
  }

  // Step 2: First contribution
  if (!(await fileExists(path.join(KEYS_DIR, 'pot14_0001.ptau')))) {
    await runCommand(
      `snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="zkUlt First" --entropy="${Date.now()}" -v`,
      'Step 2: First contribution'
    );
  } else {
    console.log('⏭️  Using existing pot14_0001.ptau');
  }

  // Step 3: Second contribution
  if (!(await fileExists(path.join(KEYS_DIR, 'pot14_0002.ptau')))) {
    await runCommand(
      `snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau --name="zkUlt Second" --entropy="${Math.random()}" -v`,
      'Step 3: Second contribution'
    );
  } else {
    console.log('⏭️  Using existing pot14_0002.ptau');
  }

  // Step 4: Prepare phase 2
  if (!(await fileExists(path.join(KEYS_DIR, 'pot14_final.ptau')))) {
    await runCommand(
      'snarkjs powersoftau prepare phase2 pot14_0002.ptau pot14_final.ptau -v',
      'Step 4: Preparing phase 2'
    );
  } else {
    console.log('⏭️  Using existing pot14_final.ptau');
  }

  // Step 5: Verify Powers of Tau
  await runCommand(
    'snarkjs powersoftau verify pot14_final.ptau',
    'Step 5: Verifying Powers of Tau'
  );

  // Step 6: PLONK Setup
  await runCommand(
    `snarkjs plonk setup ${CIRCUIT_NAME}.r1cs pot14_final.ptau ${CIRCUIT_NAME}_final.zkey`,
    'Step 6: Generating PLONK proving key'
  );

  // Step 7: Export verification key
  await runCommand(
    `snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json`,
    'Step 7: Exporting verification key'
  );

  // Step 8: Generate Solidity verifier
  const verifierPath = path.join(__dirname, '../contracts/plonk/PlonkVerifier.sol');
  await runCommand(
    `snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey ${verifierPath}`,
    'Step 8: Generating Solidity verifier'
  );

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================');
  console.log('✅ PLONK Setup Complete!');
  console.log('================================\n');
  console.log(`⏱️  Total time: ${duration}s\n`);
  console.log('Generated files:');
  console.log(`  📄 ${CIRCUIT_NAME}_final.zkey (proving key)`);
  console.log('  📄 verification_key.json');
  console.log('  📄 contracts/plonk/PlonkVerifier.sol\n');

  // Show file sizes
  const files = [
    `${CIRCUIT_NAME}_final.zkey`,
    'verification_key.json',
    'pot14_final.ptau'
  ];

  console.log('Key sizes:');
  for (const file of files) {
    const filepath = path.join(KEYS_DIR, file);
    if (await fileExists(filepath)) {
      const stats = await fs.promises.stat(filepath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`  ${file}: ${sizeMB} MB`);
    }
  }

  console.log('\n🚀 Ready to generate proofs!');
}

main().catch((error) => {
  console.error('\n❌ Setup failed:', error.message);
  process.exit(1);
});
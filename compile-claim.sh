#!/bin/bash

echo "🔨 Compiling Claim Circuit for PLONK..."

# Create output directory
mkdir -p circuits/plonk/claim_build

# Step 1: Compile circuit
echo "📝 Step 1: Compiling claim.circom..."
circom circuits/plonk/claim.circom \
  --r1cs \
  --wasm \
  --sym \
  --c \
  -l node_modules \
  -o circuits/plonk/claim_build

if [ $? -ne 0 ]; then
  echo "❌ Circuit compilation failed"
  exit 1
fi

# Step 2: Generate witness calculator
echo "🧮 Step 2: Witness calculator generated"

# Step 3: Generate powers of tau (need pot14 for 9981 constraints)
echo "⚡ Step 3: Generating powers of tau..."
if [ ! -f circuits/plonk/claim_build/pot14_final.ptau ]; then
  npx snarkjs powersoftau new bn128 14 circuits/plonk/claim_build/pot14_0000.ptau -v
  npx snarkjs powersoftau contribute circuits/plonk/claim_build/pot14_0000.ptau circuits/plonk/claim_build/pot14_0001.ptau --name="First contribution" -v -e="random entropy"
  npx snarkjs powersoftau prepare phase2 circuits/plonk/claim_build/pot14_0001.ptau circuits/plonk/claim_build/pot14_final.ptau -v
fi

# Step 4: Setup PLONK
echo "🔑 Step 4: PLONK setup..."
npx snarkjs plonk setup circuits/plonk/claim_build/claim.r1cs circuits/plonk/claim_build/pot14_final.ptau circuits/plonk/claim_build/claim_final.zkey

# Step 5: Export verification key
echo "📤 Step 5: Exporting verification key..."
npx snarkjs zkey export verificationkey circuits/plonk/claim_build/claim_final.zkey circuits/plonk/claim_build/verification_key.json

# Step 6: Generate Solidity verifier
echo "📜 Step 6: Generating Solidity verifier..."
npx snarkjs zkey export solidityverifier circuits/plonk/claim_build/claim_final.zkey contracts/plonk/ClaimVerifier.sol

# Step 7: Print circuit info
echo "📊 Step 7: Circuit info..."
npx snarkjs r1cs info circuits/plonk/claim_build/claim.r1cs

echo "✅ Claim circuit compilation complete!"
echo "📁 Outputs:"
echo "   - WASM: circuits/plonk/claim_build/claim_js/claim.wasm"
echo "   - zkey: circuits/plonk/claim_build/claim_final.zkey"
echo "   - Verifier: contracts/plonk/ClaimVerifier.sol"

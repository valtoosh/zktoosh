#!/bin/bash
# scripts/setup-plonk-keys.sh
# PLONK Universal Setup Script

set -e  # Exit on error

echo "🔐 zkUlt PLONK Universal Setup"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
KEYS_DIR="backend/keys/plonk"
CIRCUIT_NAME="transfer"

cd "$KEYS_DIR"

# Check if keys already exist
if [ -f "${CIRCUIT_NAME}_final.zkey" ]; then
    echo -e "${YELLOW}⚠️  Keys already exist. Delete them to regenerate.${NC}"
    exit 0
fi

# Step 1: Powers of Tau (Universal Setup)
echo -e "${BLUE}Step 1: Generating Powers of Tau (this is universal for ALL circuits)${NC}"
if [ ! -f "pot14_0000.ptau" ]; then
    snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
    echo -e "${GREEN}✓ Initial ceremony file created${NC}"
else
    echo -e "${YELLOW}Using existing pot14_0000.ptau${NC}"
fi

# Step 2: Contribute to ceremony
echo ""
echo -e "${BLUE}Step 2: Contributing randomness${NC}"
if [ ! -f "pot14_0001.ptau" ]; then
    snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau \
        --name="zkUlt First Contribution" \
        --entropy="$(date +%s)" \
        -v
    echo -e "${GREEN}✓ Randomness contributed${NC}"
else
    echo -e "${YELLOW}Using existing pot14_0001.ptau${NC}"
fi

# Step 3: Second contribution (for security)
echo ""
echo -e "${BLUE}Step 3: Second contribution${NC}"
if [ ! -f "pot14_0002.ptau" ]; then
    snarkjs powersoftau contribute pot14_0001.ptau pot14_0002.ptau \
        --name="zkUlt Second Contribution" \
        --entropy="$(openssl rand -base64 32)" \
        -v
    echo -e "${GREEN}✓ Second contribution added${NC}"
else
    echo -e "${YELLOW}Using existing pot14_0002.ptau${NC}"
fi

# Step 4: Prepare phase 2
echo ""
echo -e "${BLUE}Step 4: Preparing phase 2${NC}"
if [ ! -f "pot14_final.ptau" ]; then
    snarkjs powersoftau prepare phase2 pot14_0002.ptau pot14_final.ptau -v
    echo -e "${GREEN}✓ Phase 2 prepared${NC}"
else
    echo -e "${YELLOW}Using existing pot14_final.ptau${NC}"
fi

# Step 5: Verify Powers of Tau
echo ""
echo -e "${BLUE}Step 5: Verifying Powers of Tau${NC}"
snarkjs powersoftau verify pot14_final.ptau

# Step 6: Setup PLONK-specific keys
echo ""
echo -e "${BLUE}Step 6: Generating PLONK proving key${NC}"
snarkjs plonk setup ${CIRCUIT_NAME}.r1cs pot14_final.ptau ${CIRCUIT_NAME}_final.zkey

# Step 7: Export verification key
echo ""
echo -e "${BLUE}Step 7: Exporting verification key${NC}"
snarkjs zkey export verificationkey ${CIRCUIT_NAME}_final.zkey verification_key.json

# Step 8: Generate Solidity verifier
echo ""
echo -e "${BLUE}Step 8: Generating Solidity verifier contract${NC}"
snarkjs zkey export solidityverifier ${CIRCUIT_NAME}_final.zkey \
    ../../../contracts/plonk/PlonkVerifier.sol

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ PLONK Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Generated files:"
echo "  📄 ${CIRCUIT_NAME}_final.zkey (proving key)"
echo "  📄 verification_key.json"
echo "  📄 contracts/plonk/PlonkVerifier.sol"
echo ""
echo "Key sizes:"
ls -lh ${CIRCUIT_NAME}_final.zkey verification_key.json pot14_final.ptau
echo ""
echo "🚀 Ready to generate proofs!"
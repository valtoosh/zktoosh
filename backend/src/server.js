// backend/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // PHASE 4: HTTP security headers
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const proofRoutes = require('./routes/proof.routes');
const proofPhase6Routes = require('./routes/proof-phase6.routes'); // Phase 6: Advanced privacy features
const claimRoutes = require('./routes/claim.routes'); // Phase 6: ZK claiming proofs
const merkleRoutes = require('./routes/merkle.routes'); // Merkle tree synchronization routes
const { generalLimiter } = require('./middleware/rateLimiter'); // PHASE 4: Rate limiting
const MerkleSync = require('./services/merkleSync'); // Merkle tree synchronization

const app = express();

// Global Merkle sync instance (will be initialized on startup)
let merkleSyncService = null;

// PHASE 4: Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API
  crossOriginEmbedderPolicy: false
}));

// General rate limiting for all endpoints
app.use('/api/', generalLimiter);

// CORS middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/proof', proofRoutes);
app.use('/api/proof-phase6', proofPhase6Routes); // Phase 6: Stealth, Merkle, Range, Memo
app.use('/api/claim', claimRoutes); // Phase 6: ZK claiming proofs
app.use('/api/merkle', merkleRoutes); // Merkle tree synchronization

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    proofSystem: 'PLONK',
    version: '2.0.0-phase6',
    features: ['Phase5B', 'Phase6B', 'Phase6C', 'Phase6D', 'Phase6E']
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5001;

// Initialize Merkle sync on server startup
async function initializeMerkleSync() {
  try {
    const PHASE6_CONFIG = require('../../frontend/src/contracts/plonk/config-phase6.json');
    const PROVIDER_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161';

    // Get the prover service instance to access its Merkle tree
    const proverService = require('./services/plonkProverPhase6');
    await proverService.initialize();

    // Initialize Merkle sync service
    merkleSyncService = new MerkleSync(
      PHASE6_CONFIG.transferAddress,
      PROVIDER_URL,
      proverService.merkleTree
    );

    // Perform initial sync
    console.log('🔄 Performing initial Merkle tree synchronization...');
    const syncResult = await merkleSyncService.syncWithContract();

    if (syncResult.synced) {
      console.log('✅ Merkle tree synchronized successfully');
      console.log(`   Root: ${syncResult.root}`);
      console.log(`   Size: ${syncResult.size}`);
      console.log(`   Action: ${syncResult.action}`);
    } else {
      console.warn('⚠️  Merkle tree sync incomplete');
    }

    // Store global reference for routes to use
    global.merkleSyncService = merkleSyncService;
    global.plonkProverPhase6 = proverService;

  } catch (error) {
    console.error('❌ Failed to initialize Merkle sync:', error.message);
    console.warn('⚠️  Continuing without Merkle sync - proofs may fail');
  }
}

app.listen(PORT, async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🔐 zkUlt PLONK Phase 6 Proof Server');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  🚀 Server: http://localhost:${PORT}`);
  console.log(`  🏥 Health: http://localhost:${PORT}/health`);
  console.log('');
  console.log('  📊 Phase 5B Stats:  http://localhost:${PORT}/api/proof/stats');
  console.log('  📊 Phase 6 Stats:   http://localhost:${PORT}/api/proof-phase6/stats');
  console.log('  🌳 Merkle State:    http://localhost:${PORT}/api/proof-phase6/merkle-state');
  console.log('');
  console.log('  🎯 Phase 6 Features:');
  console.log('     ✅ 6B: Stealth Addresses');
  console.log('     ✅ 6C: Merkle Anonymity (1M capacity)');
  console.log('     ✅ 6D: Range Proofs (64-bit)');
  console.log('     ✅ 6E: Encrypted Memos');
  console.log('═══════════════════════════════════════════════════════\n');

  // Initialize Merkle sync after server starts
  await initializeMerkleSync();
});
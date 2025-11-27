// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Note: The original file had IncrementalBinaryMerkleProof.sol import.
// We are removing it as it's not directly used in Poseidon.sol itself
// and might not be available in our project context.

uint256 constant GOLDILOCKS_PRIME = 0xffffffff00000001;

contract Poseidon {
    uint256[8][2] internal C; // MDS matrix and round constants for Poseidon hash function
    uint256[8][2] internal M; // C is 2x8 matrix, M is 2x8 matrix.
    uint256[2][8] internal P; // P is 8x2 matrix.

    constructor() {
        // Initialize constants (these would typically be generated off-chain
        // and hardcoded here). For this example, we'll use placeholder values.
        // In a real scenario, you'd populate these with the actual Poseidon
        // round constants and MDS matrix values.
        // C (Round Constants)
        C = [
            [
                5086888497673516905,
                7264871987550385966,
                7862788501258673752,
                11940905477817088491,
                14959074092593674665,
                16666874404070008404,
                18434449909289569766,
                8254880509657065971
            ],
            [
                10515159013095034608,
                7607310574751433069,
                3818305091764669868,
                14958189561081682390,
                14674681347649557452,
                17112001962387796918,
                14371424727187146522,
                18231267440051185368
            ]
        ];

        // M (MDS Matrix)
        M = [
            [
                13567786483582457993,
                15102556277983177995,
                14798363765103437197,
                18360699049755498870,
                2135967916960814986,
                12961803700045230985,
                760868953185397441,
                13564998781912953248
            ],
            [
                14798363765103437197,
                17937409893922378943,
                16834168673623724213,
                3140594967389140417,
                13256191490916604810,
                1649914717173873439,
                16781295982859132147,
                2409748611136473108
            ]
        ];

        // P (MDS Matrix)
        P = [
            [
                13567786483582457993,
                14798363765103437197
            ],
            [
                15102556277983177995,
                17937409893922378943
            ],
            [
                14798363765103437197,
                16834168673623724213
            ],
            [
                18360699049755498870,
                3140594967389140417
            ],
            [
                2135967916960814986,
                13256191490916604810
            ],
            [
                12961803700045230985,
                1649914717173873439
            ],
            [
                760868953185397441,
                16781295982859132147
            ],
            [
                13564998781912953248,
                2409748611136473108
            ]
        ];
    }

    /**
     * @dev Calculates the Poseidon hash of two inputs.
     * @param a The first input.
     * @param b The second input.
     * @return The Poseidon hash.
     */
    function poseidon(
        uint256 a,
        uint256 b
    ) public view returns (uint256) {
        uint256[2] memory state;
        state[0] = a;
        state[1] = b;

        uint256 fullRounds = 8;
        uint256 partialRounds = 57; // This value is for t=3, d=8. For t=2, d=8 this needs to be checked.
        uint256 NR = fullRounds + partialRounds;

        for (uint256 r = 0; r < NR; r++) {
            // Add round constants
            state[0] = (state[0] + C[0][r]) % GOLDILOCKS_PRIME;
            state[1] = (state[1] + C[1][r]) % GOLDILOCKS_PRIME;

            // S-box layer
            if (r < fullRounds / 2 || r >= fullRounds / 2 + partialRounds) {
                // Full S-box
                state[0] = sBox(state[0]);
                state[1] = sBox(state[1]);
            } else {
                // Partial S-box
                state[0] = sBox(state[0]);
            }

            // MDS Matrix multiplication
            uint256 s0 = state[0];
            uint256 s1 = state[1];

            state[0] = (M[0][0] * s0 + M[0][1] * s1) % GOLDILOCKS_PRIME;
            state[1] = (M[1][0] * s0 + M[1][1] * s1) % GOLDILOCKS_PRIME;
        }

        return state[0];
    }

    /**
     * @dev S-box function (x^8).
     * @param x The input to the S-box.
     * @return x^8 mod GOLDILOCKS_PRIME.
     */
    function sBox(uint256 x) internal pure returns (uint256) {
        // x^8 mod GOLDILOCKS_PRIME
        uint256 x2 = (x * x) % GOLDILOCKS_PRIME;
        uint256 x4 = (x2 * x2) % GOLDILOCKS_PRIME;
        uint256 x8 = (x4 * x4) % GOLDILOCKS_PRIME;
        return x8;
    }
}

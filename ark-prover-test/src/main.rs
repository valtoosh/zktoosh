use ark_bn254::{Bn254, Fr};
use ark_circom::{CircomBuilder, CircomConfig};
use ark_groth16::Groth16;
use ark_snark::SNARK; // Import the SNARK trait
use ark_std::rand::thread_rng;
use color_eyre::Result;

fn main() -> Result<()> {
    // Note: The CircomConfig is generic over the PrimeField, which is Fr.
    let cfg = CircomConfig::<Fr>::new(
        "./multiplier.r1cs",
        "./multiplier_js/multiplier.wasm",
    )?;
    let mut builder = CircomBuilder::new(cfg);

    println!("Setting inputs: a=3, b=5");
    builder.push_input("a", 3);
    builder.push_input("b", 5);

    // The Groth16 struct is generic over the Curve, which is Bn254.
    let circuit = builder.build()?;
    println!("Circuit built successfully.");

    let mut rng = thread_rng();
    println!("Generating Groth16 parameters (proving and verifying keys)...");
    // Destructure the tuple returned by circuit_specific_setup
    let (pk, vk) = Groth16::<Bn254>::circuit_specific_setup(circuit.clone(), &mut rng)?;
    println!("Parameters generated.");

    println!("Generating proof...");
    // Pass the proving key (pk) to the prove function
    let proof = Groth16::<Bn254>::prove(&pk, circuit, &mut rng)?;
    println!("Proof generated successfully.");

    // Process the verifying key for efficient verification
    let pvk = Groth16::<Bn254>::process_vk(&vk)?;
    let expected_output = Fr::from(15u8);
    let public_inputs = vec![expected_output];

    println!("Verifying proof against output c=15...");
    // Pass the processed verifying key (pvk) to the verify function
    let verified = Groth16::<Bn254>::verify_with_processed_vk(&pvk, &public_inputs, &proof)?;

    if verified {
        println!("✅ SUCCESS: The proof is valid!");
    } else {
        println!("❌ FAILURE: The proof is invalid.");
    }

    Ok(())
}
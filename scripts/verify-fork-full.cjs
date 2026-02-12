const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🚀 Starting Mainnet Fork Verification Sequence...");
    console.log("Network:", hre.network.name);

    if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
        throw new Error("❌ Safety Check Failed: This script should only be run on localhost/hardhat fork!");
    }

    // 1. Phase 1: Pre-Launch
    console.log("\n--- [Step 1] Running Phase 1 (Pre-Launch) ---");
    await hre.run("run", { script: "deploy/deploy-pre-launch.cjs" });

    // 2. Mock Token Deployment
    console.log("\n--- [Step 2] Deploying Mock WISH Token ---");
    // We can't use hre.run easily if the script doesn't export main or if we need the return value.
    // deploy-mock-token.cjs prints the address but doesn't return it in a standard way for hre.run to capture easily via stdout isolation (complex).
    // Instead, let's just deploy it inline here or modify the mock script.
    // Simpler: Just deploy it here.
    const WishPowerToken = await hre.ethers.getContractFactory("WishPowerToken");
    const token = await WishPowerToken.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log("✅ Mock Token Deployed at:", tokenAddress);

    // 3. Phase 2: Post-Launch
    console.log("\n--- [Step 3] Running Phase 2 (Post-Launch) ---");
    console.log("Overriding WISH_TOKEN_ADDRESS via env var...");

    // Set env var for process
    process.env.WISH_TOKEN_ADDRESS = tokenAddress;

    await hre.run("run", { script: "deploy/deploy-post-launch.cjs" });

    // 4. Verification / Simulation
    console.log("\n--- [Step 4] Running Tax Simulation ---");
    await hre.run("run", { script: "scripts/simulate-tax.cjs" });

    console.log("\n✅ Verification Sequence Completed Successfully!");
    console.log("If you see the Tax Simulation success message above, the logic is sound.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

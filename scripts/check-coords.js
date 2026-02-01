const hre = require("hardhat");

const COORD_V2 = "0x6A2AAd07396B36Fe02a22b33cf443582f682c82f";
const COORD_V2_5 = "0xda3b641d438362c440ac5458c57e00e716446700";

async function main() {
    console.log(`\n🔍 Network Diagnostics`);

    // 1. Check Chain ID
    const network = await hre.ethers.provider.getNetwork();
    console.log(`📡 Connected to Chain ID: ${network.chainId}`);
    console.log(`🌐 RPC URL: ${hre.network.config.url}`);

    // 2. Check V2 Coordinator (Known Benchmark)
    console.log(`\nChecking VRF v2 Coordinator (${COORD_V2})...`);
    const codeV2 = await hre.ethers.provider.getCode(COORD_V2);
    if (codeV2 === "0x") {
        console.log("❌ NO CODE (RPC might be syncing or wrong chain)");
    } else {
        console.log(`✅ CODE FOUND (${codeV2.length} bytes)`);
    }

    // 3. Check V2.5 Coordinator (Target)
    console.log(`\nChecking VRF v2.5 Coordinator (${COORD_V2_5})...`);
    const codeV25 = await hre.ethers.provider.getCode(COORD_V2_5);
    if (codeV25 === "0x") {
        console.log("❌ NO CODE - Critical Issue!");
    } else {
        console.log(`✅ CODE FOUND (${codeV25.length} bytes)`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

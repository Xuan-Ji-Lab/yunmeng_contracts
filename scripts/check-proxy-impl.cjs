const hre = require("hardhat");

async function main() {
    const contracts = {
        CloudDreamCore: "0xb05933bB187A44f5A07dab81472F071fd4333707",
        DreamTreasury: "0x4BA7ACf83AF75657c0Cdaa66310499CAf2775d8F",
        DreamDrifter: "0xA21f64B178aA5C1AF0AA2183AdA1DcD5E28A846C",
        DreamOracle: "0x13e36C573c7a61FAf25B4485008582D29eE2c615",
        DreamSeeker: "0x72AE4f0Ac240b3501Ebe61cC3AB807Eca435E2Cf"
    };

    console.log("Checking implementation addresses...");

    for (const [name, address] of Object.entries(contracts)) {
        try {
            // EIP-1967 Implementation Slot: 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
            const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
            const storage = await hre.ethers.provider.getStorage(address, implSlot);
            // Convert storage (32 bytes) to address (20 bytes)
            const implAddress = "0x" + storage.slice(26); // last 40 hex chars (20 bytes)
            console.log(`${name}: Proxy ${address} -> Impl ${implAddress}`);
        } catch (e) {
            console.log(`${name}: Error fetching storage - ${e.message}`);
        }
    }
}

main().catch(console.error);

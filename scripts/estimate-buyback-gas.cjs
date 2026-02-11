const hre = require("hardhat");

async function main() {
    const treasuryAddress = "0x0272d8f15322041e5ed0dd7015708b9F620f2BDf";
    const DreamTreasury = await hre.ethers.getContractFactory("DreamTreasury");
    const treasury = DreamTreasury.attach(treasuryAddress);

    // Impersonate the forwarder or just use a random account (since performUpkeep is usually checked via checkUpkeep, 
    // but the actual function called 'executePendingTaxBuyback' prevents unauthorized access)
    // Actually performUpkeep doesn't have permissions?
    // check: function performUpkeep(bytes calldata) external override { executePendingTaxBuyback(); }
    // check: function executePendingTaxBuyback() public { require(..., "Treasury: unauthorized"); }
    // So we need to be the forwarder.

    const forwarderAddress = "0xaae48A61bfb4ddbcCF5d32B7A108561f24f3D51E";

    // We can't easily impersonate on testnet.
    // But we can try to estimate gas from the deployer account, acting as "OPERATOR" which is allowed.
    // The deployer has OPERATOR_ROLE.

    const [deployer] = await hre.ethers.getSigners();
    console.log("Estimating gas for executePendingTaxBuyback from:", deployer.address);

    try {
        const gasEstimate = await treasury.executePendingTaxBuyback.estimateGas();
        console.log("Estimated Gas:", gasEstimate.toString());
    } catch (e) {
        console.error("Gas estimation failed:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

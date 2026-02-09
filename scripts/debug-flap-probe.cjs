const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    const deploymentPath = path.join(__dirname, "../deploy/deployment-modular.json");
    if (!fs.existsSync(deploymentPath)) {
        console.error("❌ Deployment file not found");
        return;
    }
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const wishTokenAddress = deploymentInfo.contracts.WishPowerToken;

    console.log(`Using WISH Token: ${wishTokenAddress}`);
    const FLAP_PORTAL_ADDRESS = "0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9";

    const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");

    // Probing for Factory or Token info
    const flapInterface = [
        "function factory() external view returns (address)",
        "function getTokenV5(address token) external view returns (tuple(uint256 price, uint256 reserve, uint256 circulatingSupply, uint256 r, uint256 h, uint256 k))", // Structure guess from docs
        "function getTokenV6(address token) external view returns (tuple(address creator, uint256 tokenId, uint256 supply, uint256 reserve, bool launched, uint256 price))",
        "function tokens(address token) external view returns (bool, uint256, uint256, uint256, uint256, uint256, uint256, bool, address)"
    ];

    const flapContract = new ethers.Contract(FLAP_PORTAL_ADDRESS, flapInterface, provider);

    console.log(`\nProbing Flap Portal Methods...`);

    // 1. Check for Factory
    try {
        const factory = await flapContract.factory();
        console.log(`✅ Factory Address: ${factory}`);
    } catch (e) {
        console.log(`⚠️ factory() failed: ${e.message}`);
    }

    // 2. Check getTokenV5 (Docs mention this)
    try {
        console.log("Calling getTokenV5(address)...");
        const tokenInfo = await flapContract.getTokenV5(wishTokenAddress);
        console.log(`✅ Token Info (V5):`, tokenInfo);
        if (tokenInfo.price) {
            console.log(`💰 Price found: ${ethers.formatUnits(tokenInfo.price, 18)}`);
        }
    } catch (e) {
        console.log(`⚠️ getTokenV5() failed: ${e.message}`);
    }

    // 3. Check getTokenV6
    try {
        console.log("Calling getTokenV6(address)...");
        const tokenInfo = await flapContract.getTokenV6(wishTokenAddress);
        console.log(`✅ Token Info (V6):`, tokenInfo);
    } catch (e) {
        console.log(`⚠️ getTokenV6() failed: ${e.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

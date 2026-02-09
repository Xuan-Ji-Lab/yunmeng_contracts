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
    const NATIVE_BNB = ethers.ZeroAddress;
    const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

    // Extended Interface to probe for token info
    const flapInterface = [
        "function quoteExactInput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)",
        // Hypothetical / Common factory methods
        "function tokens(address token) external view returns (bool listed, uint256 marketCap, uint256 virtualReserve, uint256 realReserve, uint256 virtualSupply, uint256 realSupply, uint256 k, bool launched, address pair)",
        "function getToken(address token) external view returns (tuple(address creator, uint256 tokenId, uint256 supply, uint256 reserve, bool launched, uint256 price))",
        "function getSpotPrice(address token) external view returns (uint256)"
    ];

    const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
    const flapContract = new ethers.Contract(FLAP_PORTAL_ADDRESS, flapInterface, provider);

    console.log(`\nChecking Token Info on Flap...`);

    // 1. Try tokens() mapping (Common in bonding curve factories)
    try {
        console.log("Calling tokens(address)...");
        // We don't know the exact return struct, so we might need to decode raw data if this fails with decoding error.
        // But let's try standard call first.
        const tokenInfo = await flapContract.tokens(wishTokenAddress);
        console.log(`✅ Token Info (tokens mapping):`, tokenInfo);
    } catch (e) {
        console.log(`⚠️ tokens() failed: ${e.message}`);
    }

    // 2. Try getToken()
    try {
        console.log("Calling getToken(address)...");
        const tokenInfo = await flapContract.getToken(wishTokenAddress);
        console.log(`✅ Token Info (getToken):`, tokenInfo);
    } catch (e) {
        console.log(`⚠️ getToken() failed: ${e.message}`);
    }

    // 3. Try quote with Native BNB again (just in case)
    const amountIn = ethers.parseEther("0.1");
    try {
        console.log("\nRetrying Quote Native BNB -> WISH...");
        const wishOut = await flapContract.quoteExactInput(NATIVE_BNB, wishTokenAddress, amountIn);
        console.log(`✅ 0.1 BNB = ${ethers.formatUnits(wishOut, 18)} WISH`);
    } catch (e) {
        console.log(`❌ Native BNB Quote failed: ${e.message}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

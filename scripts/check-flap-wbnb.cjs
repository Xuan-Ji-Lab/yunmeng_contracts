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
    const WBNB_ADDRESS = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";

    const flapInterface = [
        "function quoteExactInput(address tokenIn, address tokenOut, uint256 amountIn) external view returns (uint256 amountOut)"
    ];

    const provider = new ethers.JsonRpcProvider("https://data-seed-prebsc-1-s1.binance.org:8545/");
    const flapContract = new ethers.Contract(FLAP_PORTAL_ADDRESS, flapInterface, provider);

    const amountIn = ethers.parseEther("1"); // 1 WBNB

    console.log(`\nTesting WBNB -> WISH...`);
    try {
        const wishOut = await flapContract.quoteExactInput(WBNB_ADDRESS, wishTokenAddress, amountIn);
        console.log(`✅ 1 WBNB = ${ethers.formatUnits(wishOut, 18)} WISH`);
    } catch (e) {
        console.log(`❌ WBNB -> WISH failed: ${e.message}`);
        // Try WISH -> WBNB
        console.log(`\nTesting WISH -> WBNB...`);
        try {
            const wbnbOut = await flapContract.quoteExactInput(wishTokenAddress, WBNB_ADDRESS, amountIn);
            console.log(`✅ 1 WISH = ${ethers.formatUnits(wbnbOut, 18)} WBNB`);
        } catch (e2) {
            console.log(`❌ WISH -> WBNB failed: ${e2.message}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
